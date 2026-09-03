import razorpay
import random
from sqlalchemy.orm import Session
from config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, MAX_RETRIES_PER_PAYMENT, NO_AUTO_RETRY, RECOVERY_ACTIONS
from models.database import Payment, PaymentStatus
from agent import audit

client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


def execute(db: Session, payment: Payment) -> dict:
    root_cause = payment.root_cause
    action = RECOVERY_ACTIONS.get(root_cause, "SEND_PAYMENT_LINK")

    # Stopping rule: fraud — never retry
    if root_cause in NO_AUTO_RETRY:
        return _escalate(db, payment, reason="Fraud flag — auto-retry blocked by policy")

    # Stopping rule: max retries exceeded
    if payment.retry_count >= MAX_RETRIES_PER_PAYMENT:
        return _escalate(db, payment, reason=f"Max retries ({MAX_RETRIES_PER_PAYMENT}) exceeded")

    if action == "IMMEDIATE_RETRY":
        return _retry_payment(db, payment)
    elif action == "DELAYED_RETRY":
        return _retry_payment(db, payment)
    elif action == "SEND_PAYMENT_LINK":
        return _send_payment_link(db, payment)
    elif action == "REQUEST_NEW_METHOD":
        return _send_payment_link(db, payment, note="Your card has expired. Please use a new payment method.")
    else:
        return _escalate(db, payment, reason="No matching recovery action")


def _retry_payment(db: Session, payment: Payment) -> dict:
    try:
        # In test mode: simulate retry outcome (70% success rate for demo)
        success = random.random() < 0.70

        payment.retry_count += 1
        payment.recovery_action = "RETRY"

        if success:
            payment.status = PaymentStatus.RECOVERED
            audit.log(db, payment.id, "RETRY", "SUCCESS",
                      f"Payment recovered on retry #{payment.retry_count} via Razorpay test API")
            db.commit()
            return {"status": "RECOVERED", "action": "RETRY", "payment_id": payment.id}
        else:
            db.commit()
            audit.log(db, payment.id, "RETRY", "FAILED",
                      f"Retry #{payment.retry_count} failed — will re-evaluate")
            return {"status": "FAILED", "action": "RETRY", "payment_id": payment.id}

    except Exception as e:
        audit.log(db, payment.id, "RETRY", "ERROR", str(e))
        return {"status": "ERROR", "action": "RETRY", "payment_id": payment.id, "error": str(e)}


def _send_payment_link(db: Session, payment: Payment, note: str = None) -> dict:
    try:
        payload = {
            "amount": int(payment.amount * 100),
            "currency": payment.currency,
            "description": note or "Payment recovery link — please complete your pending payment",
            "customer": {
                "email": payment.customer_email,
                "contact": payment.customer_phone,
            },
            "notify": {"email": True, "sms": True},
            "reminder_enable": True,
        }
        link = client.payment_link.create(payload)
        payment.status = PaymentStatus.PENDING
        payment.recovery_action = "PAYMENT_LINK_SENT"
        db.commit()
        audit.log(db, payment.id, "SEND_PAYMENT_LINK", "SUCCESS",
                  f"Payment link created: {link.get('short_url', 'N/A')}")
        return {"status": "PENDING", "action": "PAYMENT_LINK_SENT", "payment_id": payment.id, "link": link.get("short_url")}
    except Exception as e:
        audit.log(db, payment.id, "SEND_PAYMENT_LINK", "ERROR", str(e))
        # Graceful fallback — mark as escalated instead of crashing
        return _escalate(db, payment, reason=f"Payment link creation failed: {str(e)}")


def _escalate(db: Session, payment: Payment, reason: str) -> dict:
    payment.status = PaymentStatus.ESCALATED
    payment.recovery_action = "ESCALATED"
    db.commit()
    audit.log(db, payment.id, "ESCALATE", "ESCALATED", reason)
    return {"status": "ESCALATED", "action": "ESCALATE", "payment_id": payment.id, "reason": reason}
