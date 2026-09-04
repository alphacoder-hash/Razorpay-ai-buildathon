import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db, Payment, PaymentStatus
from agent import orchestrator, detector

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/")
def list_payments(status: str = None, db: Session = Depends(get_db)):
    try:
        query = db.query(Payment)
        if status:
            query = query.filter(Payment.status == status.upper())
        payments = query.order_by(Payment.created_at.desc()).limit(300).all()
        return [
            {
                "id": p.id,
                "order_id": p.order_id,
                "merchant_id": p.merchant_id,
                "customer_email": p.customer_email,
                "amount": p.amount,
                "currency": p.currency,
                "status": p.status,
                "root_cause": p.root_cause,
                "gemini_reasoning": p.gemini_reasoning,
                "recovery_message": p.recovery_message,
                "payment_link_id": p.payment_link_id,
                "retry_count": p.retry_count,
                "recovery_action": p.recovery_action,
                "error_code": p.error_code,
                "error_description": p.error_description,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in payments
        ]
    except Exception as e:
        logger.error(f"[list_payments] Failed to fetch payments: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch payments: {str(e)}")


@router.get("/exceptions")
def list_exceptions(db: Session = Depends(get_db)):
    """
    Returns all payments the agent could NOT resolve — the honest exception list.
    Grouped by root_cause so judges can see which categories are problematic.
    """
    try:
        unresolved = db.query(Payment).filter(
            Payment.status.in_([PaymentStatus.ESCALATED, PaymentStatus.FAILED])
        ).order_by(Payment.created_at.desc()).all()

        by_cause: dict = {}
        for p in unresolved:
            cause = p.root_cause or "UNKNOWN"
            if cause not in by_cause:
                by_cause[cause] = {"root_cause": cause, "count": 0, "total_value": 0.0, "payments": []}
            by_cause[cause]["count"] += 1
            by_cause[cause]["total_value"] = round(by_cause[cause]["total_value"] + p.amount, 2)
            by_cause[cause]["payments"].append({
                "id": p.id,
                "amount": p.amount,
                "status": p.status,
                "recovery_action": p.recovery_action,
                "gemini_reasoning": p.gemini_reasoning,
                "recovery_message": p.recovery_message,
                "payment_link_id": p.payment_link_id,
                "error_description": p.error_description,
                "retry_count": p.retry_count,
                "customer_email": p.customer_email,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })

        return {
            "total_exceptions": len(unresolved),
            "total_value_at_risk": round(sum(p.amount for p in unresolved), 2),
            "by_cause": list(by_cause.values()),
        }
    except Exception as e:
        logger.error(f"[list_exceptions] Failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch exceptions: {str(e)}")


@router.get("/detect")
def detect_from_razorpay(hours_back: int = 24):
    """Polls Razorpay test-mode API for live failed and at-risk payments."""
    try:
        return detector.detect_failed_payments(hours_back=hours_back)
    except Exception as e:
        logger.error(f"[detect_from_razorpay] Failed: {e}")
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")


@router.post("/ingest-live")
def ingest_live_payment(payment_data: dict, db: Session = Depends(get_db)):
    """
    Ingests a live payment detected from Razorpay detector feed and immediately
    executes autonomous recovery on it.
    """
    try:
        return orchestrator.ingest_live_payment(db, payment_data)
    except Exception as e:
        logger.error(f"[ingest_live_payment] Failed: {e}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@router.post("/sync-links")
def sync_payment_links(db: Session = Depends(get_db)):
    """
    Checks status of all PENDING payment links on Razorpay API.
    Transitions links that were paid to RECOVERED, closing the loop!
    """
    try:
        from agent import recovery
        return recovery.sync_payment_links(db)
    except Exception as e:
        logger.error(f"[sync_payment_links] Failed: {e}")
        raise HTTPException(status_code=500, detail=f"Link sync failed: {str(e)}")


@router.post("/{payment_id}/recover")
def recover_payment(payment_id: str, db: Session = Depends(get_db)):
    try:
        result = orchestrator.process_single(db, payment_id)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[recover_payment] Failed to recover payment {payment_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Recovery failed: {str(e)}")


@router.get("/{payment_id}")
def get_payment_details(payment_id: str, db: Session = Depends(get_db)):
    """Retrieves full details for a single payment including AI reasoning and customer recovery copy."""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {
        "id": payment.id,
        "order_id": payment.order_id,
        "customer_email": payment.customer_email,
        "customer_phone": payment.customer_phone,
        "amount": payment.amount,
        "currency": payment.currency,
        "status": payment.status,
        "root_cause": payment.root_cause,
        "gemini_reasoning": payment.gemini_reasoning,
        "recovery_message": payment.recovery_message,
        "payment_link_id": payment.payment_link_id,
        "retry_count": payment.retry_count,
        "recovery_action": payment.recovery_action,
        "error_code": payment.error_code,
        "error_description": payment.error_description,
        "created_at": payment.created_at.isoformat() if payment.created_at else None,
    }


from datetime import datetime, timezone
from agent import audit

@router.post("/{payment_id}/promise")
def promise_to_pay(payment_id: str, payload: dict, db: Session = Depends(get_db)):
    """Sets a promise-to-pay date and pauses dunning."""
    try:
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        promise_date_str = payload.get("promise_date")
        if not promise_date_str:
            raise HTTPException(status_code=400, detail="promise_date is required")
            
        promise_date = datetime.fromisoformat(promise_date_str.replace("Z", "+00:00"))
        payment.promise_to_pay_date = promise_date
        payment.status = PaymentStatus.PROMISED
        db.commit()
        
        audit.log(
            db, payment.id, "PROMISE_TO_PAY", "SCHEDULED",
            f"Customer promised to pay on {promise_date.strftime('%Y-%m-%d')}. Dunning paused."
        )
        return {"status": "success", "promise_date": promise_date.isoformat()}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO8601.")
    except Exception as e:
        logger.error(f"[promise_to_pay] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{payment_id}/voice-recovery")
def trigger_voice_recovery(payment_id: str, db: Session = Depends(get_db)):
    """Simulates initiating a Hinglish Voice Recovery IVR call."""
    try:
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
            
        msg = payment.recovery_message or "Namaste, this is an automated update regarding your recent pending payment. Please use the secure link sent to your phone to complete the transaction."
        
        audit.log(
            db, payment.id, "VOICE_RECOVERY", "INITIATED",
            f"Simulated outbound Twilio IVR call to {payment.customer_phone}. TwiML Speech Payload: '{msg}'"
        )
        
        return {"status": "success", "message": "Voice recovery call simulated"}
    except Exception as e:
        logger.error(f"[trigger_voice_recovery] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
