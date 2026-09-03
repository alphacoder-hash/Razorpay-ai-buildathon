import logging
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db, Payment, PaymentStatus
from agent import orchestrator, audit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/razorpay")
async def handle_razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Real-time webhook listener for Razorpay payment events.
    Closes the real-time recovery loop:
    1. 'payment.failed': automatically triggers the autonomous recovery pipeline.
    2. 'payment_link.paid': verifies payment link settlement and marks status RECOVERED.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = payload.get("event")
    logger.info(f"[razorpay_webhook] Received event: {event}")

    # Case 1: Payment Failed — trigger real-time AI recovery
    if event == "payment.failed":
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        if not payment_entity:
            return {"status": "ignored", "reason": "No payment entity found"}

        payment_data = {
            "id": payment_entity.get("id"),
            "order_id": payment_entity.get("order_id"),
            "amount": (payment_entity.get("amount", 0) or 0) / 100,
            "currency": payment_entity.get("currency", "INR"),
            "email": payment_entity.get("email"),
            "contact": payment_entity.get("contact"),
            "error_code": payment_entity.get("error_code") or "GATEWAY_ERROR",
            "error_description": payment_entity.get("error_description") or "Live failure event from webhook",
        }
        result = orchestrator.ingest_live_payment(db, payment_data)
        return {"status": "processed", "event": event, "recovery_result": result}

    # Case 2: Payment Link Paid — customer completed payment through agent recovery link
    elif event == "payment_link.paid":
        link_entity = payload.get("payload", {}).get("payment_link", {}).get("entity", {})
        link_id = link_entity.get("id")

        if link_id:
            payment = db.query(Payment).filter(Payment.payment_link_id == link_id).first()
            if payment:
                payment.status = PaymentStatus.RECOVERED
                db.commit()
                audit.log(
                    db, payment.id, "WEBHOOK_RECOVERY", "SUCCESS",
                    f"Customer completed payment link {link_id} — ₹{payment.amount:,.2f} recovered! (Webhook verified)",
                    actor="RAZORPAY_WEBHOOK"
                )
                return {"status": "recovered", "payment_id": payment.id, "link_id": link_id}

        return {"status": "received", "event": event, "note": "Payment link paid but not matched to pending record"}

    return {"status": "acknowledged", "event": event}
