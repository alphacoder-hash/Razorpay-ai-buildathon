import uuid
import logging
import time
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models.database import Payment, BatchRun, PaymentStatus
from agent import classifier, recovery, audit
from data.synthetic_batch import generate_batch

logger = logging.getLogger(__name__)


def run_batch(db: Session, count: int = 60) -> dict:
    run_id = f"run_{uuid.uuid4().hex[:8]}"

    try:
        payments_data = generate_batch(count)
    except Exception as e:
        logger.error(f"[run_batch] Failed to generate batch: {e}")
        return {"error": f"Batch generation failed: {str(e)}"}

    try:
        for p in payments_data:
            payment = Payment(**{k: v for k, v in p.items() if k not in ("created_at",)})
            db.add(payment)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[run_batch] Failed to persist payments to DB: {e}")
        return {"error": f"DB write failed: {str(e)}"}

    try:
        batch_run = BatchRun(run_id=run_id, total=len(payments_data))
        db.add(batch_run)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[run_batch] Failed to create batch run record: {e}")
        return {"error": f"Batch run record failed: {str(e)}"}

    recovered = 0
    escalated = 0
    failed = 0
    skipped = 0
    money_recovered = 0.0
    consecutive_failures = 0
    agent_stopped = False
    stopped_at_index = None

    for idx, p in enumerate(payments_data):
        # Stopping rule triggered — log every skipped payment explicitly
        if agent_stopped:
            skipped += 1
            try:
                payment = db.query(Payment).filter(Payment.id == p["id"]).first()
                if payment:
                    payment.status = PaymentStatus.FAILED
                    db.commit()
                    audit.log(db, p["id"], "SKIPPED", "STOPPED",
                              f"Batch halted at index {stopped_at_index} by consecutive-failure stopping rule — "
                              f"this payment was not processed")
            except Exception as e:
                logger.warning(f"[run_batch] Failed to log skipped payment {p.get('id')}: {e}")
            continue

        try:
            payment = db.query(Payment).filter(Payment.id == p["id"]).first()
            if not payment:
                logger.warning(f"[run_batch] Payment {p['id']} not found in DB, skipping")
                continue

            # Step 1: Classify root cause via Grok
            try:
                audit.log(db, payment.id, "CLASSIFY", "STARTED",
                          f"Classifying error: {payment.error_code} — {payment.error_description} (Amount: ₹{payment.amount:,.2f})")
                classification = classifier.classify(payment.error_code, payment.error_description, amount=payment.amount)
                payment.root_cause = classification["root_cause"]
                payment.gemini_reasoning = classification.get("reasoning", "")  # persist for UI
                payment.recovery_message = classification.get("customer_message", "")  # tailored customer copy
                db.commit()
                audit.log(db, payment.id, "CLASSIFY", "DONE",
                          f"Root cause: {classification['root_cause']} "
                          f"(confidence: {classification.get('confidence', 0.9):.0%}) — {classification['reasoning']}")
            except Exception as e:
                logger.error(f"[run_batch] Classification failed for {payment.id}: {e}")
                payment.root_cause = "UNKNOWN"
                payment.gemini_reasoning = f"Classification failed: {str(e)}"  # ai_reasoning
                db.commit()
                audit.log(db, payment.id, "CLASSIFY", "ERROR", f"Classification error: {str(e)}")


            # Step 2: Execute bounded recovery action
            try:
                result = recovery.execute(db, payment)
            except Exception as e:
                logger.error(f"[run_batch] Recovery execution failed for {payment.id}: {e}")
                audit.log(db, payment.id, "RECOVERY", "ERROR", f"Recovery execution error: {str(e)}")
                result = {"status": "FAILED"}

            # Step 3: Track metrics
            if result["status"] == "RECOVERED":
                recovered += 1
                money_recovered += payment.amount
                consecutive_failures = 0
            elif result["status"] in ("PENDING",):
                # PENDING = payment link sent, recovery in-flight; count as recovered-in-progress
                consecutive_failures = 0
            elif result["status"] == "ESCALATED":
                escalated += 1
                consecutive_failures = 0
            else:
                failed += 1
                consecutive_failures += 1

            # Stopping rule: 2 consecutive FAILED recoveries → halt batch
            if consecutive_failures >= 2:
                try:
                    audit.log(db, payment.id, "STOPPING_RULE", "TRIGGERED",
                              f"2 consecutive recovery failures detected at index {idx} — "
                              f"agent halting batch to prevent cascade. Remaining {count - idx - 1} payments will be skipped.")
                except Exception as e:
                    logger.warning(f"[run_batch] Failed to log stopping rule: {e}")
                consecutive_failures = 0
                stopped_at_index = idx
                agent_stopped = True

            time.sleep(0.1)  # Throttle to respect Razorpay API rate limits

        except Exception as e:
            logger.error(f"[run_batch] Unexpected error processing payment {p.get('id')}: {e}")
            failed += 1
            continue

    # Update batch run metrics
    try:
        total = len(payments_data)
        batch_run.recovered = recovered
        batch_run.escalated = escalated
        batch_run.failed = failed
        batch_run.skipped = skipped
        batch_run.money_recovered = round(money_recovered, 2)
        batch_run.recovery_rate = round((recovered / total) * 100, 2) if total > 0 else 0
        batch_run.stopped_early = 1 if agent_stopped else 0
        batch_run.stopped_at_index = stopped_at_index
        batch_run.completed_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[run_batch] Failed to update batch run metrics: {e}")

    return {
        "run_id": run_id,
        "total": len(payments_data),
        "recovered": recovered,
        "escalated": escalated,
        "failed": failed,
        "skipped": skipped,
        "money_recovered": round(money_recovered, 2),
        "recovery_rate": batch_run.recovery_rate,
        "stopped_early": bool(agent_stopped),
        "stopped_at_index": stopped_at_index,
    }


def process_single(db: Session, payment_id: str) -> dict:
    try:
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        if not payment:
            return {"error": "Payment not found"}

        # Guard: don't re-process already resolved payments
        if payment.status in (PaymentStatus.RECOVERED, PaymentStatus.ESCALATED):
            return {"error": f"Payment already {payment.status}, cannot re-process", "payment_id": payment_id}

        # Classify if root_cause not already set
        if not payment.root_cause:
            try:
                classification = classifier.classify(payment.error_code, payment.error_description, amount=payment.amount or 0.0)
                payment.root_cause = classification["root_cause"]
                payment.gemini_reasoning = classification.get("reasoning", "")
                payment.recovery_message = classification.get("customer_message", "")
                db.commit()
            except Exception as e:
                logger.error(f"[process_single] Classification failed for {payment_id}: {e}")
                payment.root_cause = "UNKNOWN"
                payment.gemini_reasoning = f"Classification failed: {str(e)}"  # ai_reasoning
                db.commit()

        try:
            return recovery.execute(db, payment)
        except Exception as e:
            logger.error(f"[process_single] Recovery failed for {payment_id}: {e}")
            return {"error": f"Recovery execution failed: {str(e)}", "payment_id": payment_id}

    except Exception as e:
        logger.error(f"[process_single] Unexpected error for {payment_id}: {e}")
        return {"error": f"Unexpected error: {str(e)}", "payment_id": payment_id}


def ingest_live_payment(db: Session, payment_data: dict) -> dict:
    """
    Ingests a live payment detected from Razorpay API or Webhook,
    adds it to the database, and triggers the autonomous recovery pipeline.
    """
    payment_id = payment_data.get("id")
    if not payment_id:
        return {"error": "Missing payment id"}

    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        payment = Payment(
            id=payment_id,
            order_id=payment_data.get("order_id") or f"order_{payment_id[:10]}",
            merchant_id=payment_data.get("merchant_id") or "merchant_live",
            customer_email=payment_data.get("email") or "customer@example.com",
            customer_phone=payment_data.get("contact") or "9999999999",
            amount=float(payment_data.get("amount", 0.0)),
            currency=payment_data.get("currency", "INR"),
            status=PaymentStatus.FAILED,
            error_code=payment_data.get("error_code") or "GATEWAY_ERROR",
            error_description=payment_data.get("error_description") or "Live payment failure detected via Razorpay API",
        )
        db.add(payment)
        db.commit()
        audit.log(db, payment_id, "DETECT_LIVE", "INGESTED", f"Payment ingested from live Razorpay detector feed (₹{payment.amount:,.2f})")

    return process_single(db, payment_id)

