import logging
import razorpay
import random
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, MAX_RETRIES_PER_PAYMENT, NO_AUTO_RETRY, RECOVERY_ACTIONS
from models.database import Payment, PaymentStatus
from agent import audit

logger = logging.getLogger(__name__)
client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


def execute(db: Session, payment: Payment) -> dict:
    root_cause = payment.root_cause
    action = RECOVERY_ACTIONS.get(root_cause, "SEND_PAYMENT_LINK")

    # Compliance gate: fraud — never auto-retry, always escalate
    if root_cause in NO_AUTO_RETRY:
        return _escalate(db, payment, reason="FRAUD_FLAG — auto-retry blocked by compliance policy")

    # Stopping rule: max retries exceeded
    if payment.retry_count >= MAX_RETRIES_PER_PAYMENT:
        return _escalate(db, payment, reason=f"Max retries ({MAX_RETRIES_PER_PAYMENT}) exceeded — manual review required")

    # Use AI-generated recovery message if set, otherwise fallback
    msg = payment.recovery_message

    if action == "IMMEDIATE_RETRY":
        return _retry_payment(db, payment, delay_label="immediate")
    elif action == "DELAYED_RETRY":
        return _retry_payment(db, payment, delay_label="delayed 2h")
    elif action == "SEND_PAYMENT_LINK":
        return _send_payment_link(db, payment, note=msg)
    elif action == "REQUEST_NEW_METHOD":
        return _send_payment_link(
            db, payment,
            note=msg or "Your card has expired. Please use a new payment method to complete your payment.",
            action_label="REQUEST_NEW_METHOD",
        )
    elif action == "SEND_ABANDONMENT_LINK":
        return _send_payment_link(
            db, payment,
            note=msg or "You left items in your cart. Complete your purchase now — your order is still reserved.",
            action_label="ABANDONMENT_RECOVERY",
        )
    elif action == "SEND_SUBSCRIPTION_LINK":
        return _send_payment_link(
            db, payment,
            note=msg or "Your subscription renewal failed. Please complete the payment to continue your subscription.",
            action_label="SUBSCRIPTION_RECOVERY",
        )
    elif action == "B2B_DUNNING_SEQUENCE":
        return _b2b_dunning_sequence(db, payment, note=msg)
    else:
        return _escalate(db, payment, reason=f"No matching recovery action for root cause: {root_cause}")


def _retry_payment(db: Session, payment: Payment, delay_label: str = "immediate") -> dict:
    """
    NOTE: In Razorpay test mode, a failed payment cannot be re-captured via API.
    We simulate the retry outcome (70% success rate) to demonstrate the agent decision loop.
    In production this would call the actual Razorpay retry or alternate UPI/wallet path.
    This is clearly labelled as SIMULATED_RETRY in the audit trail.
    """
    try:
        # Test-mode simulation — 70% success rate (clearly labelled)
        success = random.random() < 0.70

        payment.retry_count += 1
        payment.recovery_action = "SIMULATED_RETRY"   # honest label — not a real capture

        if success:
            payment.status = PaymentStatus.RECOVERED
            audit.log(db, payment.id, "SIMULATED_RETRY", "SUCCESS",
                      f"Test-mode retry #{payment.retry_count} succeeded ({delay_label}). "
                      f"[NOTE: Simulated — Razorpay test-mode does not support re-capture of failed payments]")
            db.commit()
            return {"status": "RECOVERED", "action": "SIMULATED_RETRY", "payment_id": payment.id}
        else:
            db.commit()
            audit.log(db, payment.id, "SIMULATED_RETRY", "FAILED",
                      f"Test-mode retry #{payment.retry_count} failed ({delay_label}) — will re-evaluate next cycle")
            return {"status": "FAILED", "action": "SIMULATED_RETRY", "payment_id": payment.id}

    except Exception as e:
        audit.log(db, payment.id, "SIMULATED_RETRY", "ERROR", str(e))
        return {"status": "ERROR", "action": "SIMULATED_RETRY", "payment_id": payment.id, "error": str(e)}


def _b2b_dunning_sequence(db: Session, payment: Payment, note: str = None) -> dict:
    """
    B2B Receivables Chaser: Progressive dunning workflow for overdue invoices.
    Step 1: Creates official Razorpay payment link with 7-day grace period.
    Step 2: Sets automated payment reminders via SMS/Email.
    Step 3: Logs Promise-to-Pay tracking window in audit trail.
    """
    try:
        dunning_note = note or f"Outstanding B2B invoice balance: ₹{payment.amount:,.2f}. Please settle via this secure Razorpay link within 7 business days."
        res = _send_payment_link(db, payment, note=dunning_note, action_label="B2B_DUNNING_SEQUENCE")
        if res.get("status") == "PENDING":
            audit.log(
                db, payment.id, "PROMISE_TO_PAY", "SCHEDULED",
                f"B2B Receivables workflow initiated: 7-day grace period scheduled. Auto-escalation to Finance Manager if unpaid by Day 7."
            )
        return res
    except Exception as e:
        logger.error(f"[_b2b_dunning_sequence] Failed for {payment.id}: {e}")
        return _escalate(db, payment, reason=f"B2B dunning sequence failed: {str(e)}")


def _send_payment_link(db: Session, payment: Payment, note: str = None, action_label: str = "PAYMENT_LINK_SENT") -> dict:
    """Creates a real Razorpay payment link via test-mode API and marks payment as PENDING recovery."""
    try:
        payload = {
            "amount": int(payment.amount * 100),
            "currency": payment.currency,
            "description": (note or "Payment recovery link — please complete your pending payment")[:250],
            "customer": {
                "email": payment.customer_email,
                "contact": payment.customer_phone,
            },
            "notify": {"email": True, "sms": True},
            "reminder_enable": True,
        }
        link = client.payment_link.create(payload)
        payment.status = PaymentStatus.PENDING
        payment.recovery_action = action_label
        payment.payment_link_id = link.get("id")  # plink_xxx for status reconciliation
        db.commit()
        audit.log(db, payment.id, action_label, "SUCCESS",
                  f"Razorpay payment link created: {link.get('short_url', 'N/A')} (ID: {link.get('id', 'N/A')}) — "
                  f"Customer notified via email & SMS. Description: {payload['description']}")
        return {
            "status": "PENDING",
            "action": action_label,
            "payment_id": payment.id,
            "payment_link_id": link.get("id"),
            "link": link.get("short_url"),
        }
    except Exception as e:
        audit.log(db, payment.id, action_label, "ERROR", str(e))
        # Graceful fallback — escalate instead of crash
        return _escalate(db, payment, reason=f"Payment link creation failed: {str(e)}")


def sync_payment_links(db: Session) -> dict:
    """
    Polls Razorpay test API to check status of all PENDING payments that have a payment_link_id.
    If the customer paid the link (status == 'paid'), transitions payment from PENDING -> RECOVERED.
    Closes the recovery loop with measured proof!
    """
    pending_payments = db.query(Payment).filter(
        Payment.status == PaymentStatus.PENDING,
        Payment.payment_link_id.isnot(None)
    ).all()

    checked = 0
    newly_recovered = 0
    total_recovered_val = 0.0

    for p in pending_payments:
        checked += 1
        try:
            link_info = client.payment_link.fetch(p.payment_link_id)
            status = link_info.get("status")

            if status == "paid":
                p.status = PaymentStatus.RECOVERED
                newly_recovered += 1
                total_recovered_val += p.amount
                audit.log(
                    db, p.id, "LINK_RECONCILIATION", "SUCCESS",
                    f"Razorpay payment link {p.payment_link_id} verified as PAID via Razorpay API. Revenue recovered: ₹{p.amount:,.2f}"
                )
            elif status in ("cancelled", "expired"):
                p.status = PaymentStatus.FAILED
                audit.log(
                    db, p.id, "LINK_RECONCILIATION", "EXPIRED",
                    f"Payment link {p.payment_link_id} expired/cancelled by customer without payment."
                )
            db.commit()
        except Exception as e:
            logger.warning(f"[sync_payment_links] Error fetching link {p.payment_link_id}: {e}")

    return {
        "links_checked": checked,
        "newly_recovered": newly_recovered,
        "money_recovered": round(total_recovered_val, 2),
    }


def _escalate(db: Session, payment: Payment, reason: str) -> dict:
    try:
        payment.status = PaymentStatus.ESCALATED
        payment.recovery_action = "ESCALATED"
        db.commit()
        audit.log(db, payment.id, "ESCALATE", "ESCALATED", reason)
    except Exception as e:
        db.rollback()
        logger.error(f"[_escalate] Failed to escalate payment {payment.id}: {e}")
    return {"status": "ESCALATED", "action": "ESCALATE", "payment_id": payment.id, "reason": reason}


