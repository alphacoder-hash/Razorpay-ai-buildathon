import uuid
import logging
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
            payment = Payment(**{k: v for k, v in p.items() if k != "created_at"})
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
    money_recovered = 0.0
    consecutive_failures = 0

    for p in payments_data:
        try:
            payment = db.query(Payment).filter(Payment.id == p["id"]).first()
            if not payment:
                logger.warning(f"[run_batch] Payment {p['id']} not found in DB, skipping")
                continue

            # Step 1: Classify root cause via Gemini
            try:
                audit.log(db, payment.id, "CLASSIFY", "STARTED", f"Classifying: {payment.error_description}")
                classification = classifier.classify(payment.error_code, payment.error_description)
                payment.root_cause = classification["root_cause"]
                db.commit()
                audit.log(db, payment.id, "CLASSIFY", "DONE",
                          f"Root cause: {classification['root_cause']} "
                          f"(confidence: {classification['confidence']}) — {classification['reasoning']}")
            except Exception as e:
                logger.error(f"[run_batch] Classification failed for {payment.id}: {e}")
                payment.root_cause = "UNKNOWN"
                db.commit()
                audit.log(db, payment.id, "CLASSIFY", "ERROR", f"Classification error: {str(e)}")

            # Step 2: Execute recovery
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
            elif result["status"] == "ESCALATED":
                escalated += 1
                consecutive_failures = 0
            else:
                failed += 1
                consecutive_failures += 1

            # Stopping rule: 2 consecutive failures → pause and log
            if consecutive_failures >= 2:
                try:
                    audit.log(db, payment.id, "STOPPING_RULE", "TRIGGERED",
                              "2 consecutive failures detected — agent pausing for review")
                except Exception as e:
                    logger.warning(f"[run_batch] Failed to log stopping rule: {e}")
                consecutive_failures = 0

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
        batch_run.money_recovered = round(money_recovered, 2)
        batch_run.recovery_rate = round((recovered / total) * 100, 2) if total > 0 else 0
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
        "money_recovered": round(money_recovered, 2),
        "recovery_rate": batch_run.recovery_rate,
    }


def process_single(db: Session, payment_id: str) -> dict:
    try:
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        if not payment:
            return {"error": "Payment not found"}

        try:
            classification = classifier.classify(payment.error_code, payment.error_description)
            payment.root_cause = classification["root_cause"]
            db.commit()
        except Exception as e:
            logger.error(f"[process_single] Classification failed for {payment_id}: {e}")
            payment.root_cause = "UNKNOWN"
            db.commit()

        try:
            return recovery.execute(db, payment)
        except Exception as e:
            logger.error(f"[process_single] Recovery failed for {payment_id}: {e}")
            return {"error": f"Recovery execution failed: {str(e)}", "payment_id": payment_id}

    except Exception as e:
        logger.error(f"[process_single] Unexpected error for {payment_id}: {e}")
        return {"error": f"Unexpected error: {str(e)}", "payment_id": payment_id}
