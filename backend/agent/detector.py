"""
detector.py — Razorpay Failure Detector
Polls the real Razorpay test-mode API to find:
  1. Failed payments (status=failed) from the last N hours
  2. Authorized-but-not-captured payments (at-risk of expiry)

This is the proactive "revenue at risk" detection step the track requires:
"detects revenue at risk, determines the right intervention, and executes
a bounded recovery workflow"
"""
import logging
from datetime import datetime, timezone, timedelta
import razorpay
from config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

logger = logging.getLogger(__name__)
_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


def detect_failed_payments(hours_back: int = 24, max_count: int = 100) -> dict:
    """
    Polls Razorpay GET /v1/payments for failed payments in the last N hours.
    Returns a summary with raw payment data for agent processing.
    """
    try:
        from_ts = int((datetime.now(timezone.utc) - timedelta(hours=hours_back)).timestamp())
        params = {
            "count": min(max_count, 100),
            "from": from_ts,
        }
        response = _client.payment.all(params)
        all_payments = response.get("items", [])

        failed = [p for p in all_payments if p.get("status") == "failed"]
        authorized = [p for p in all_payments if p.get("status") == "authorized"]
        captured = [p for p in all_payments if p.get("status") == "captured"]

        return {
            "source": "razorpay_live_poll",
            "polled_at": datetime.now(timezone.utc).isoformat(),
            "hours_back": hours_back,
            "total_fetched": len(all_payments),
            "failed_count": len(failed),
            "authorized_not_captured": len(authorized),
            "captured_count": len(captured),
            "failed_payments": [
                {
                    "id": p["id"],
                    "amount": p["amount"] / 100,
                    "currency": p.get("currency", "INR"),
                    "status": p["status"],
                    "error_code": p.get("error_code"),
                    "error_description": p.get("error_description"),
                    "email": p.get("email"),
                    "contact": p.get("contact"),
                    "created_at": datetime.fromtimestamp(p["created_at"], tz=timezone.utc).isoformat(),
                }
                for p in failed
            ],
            "at_risk_payments": [
                {
                    "id": p["id"],
                    "amount": p["amount"] / 100,
                    "currency": p.get("currency", "INR"),
                    "status": p["status"],
                    "risk": "authorized_not_captured",
                    "created_at": datetime.fromtimestamp(p["created_at"], tz=timezone.utc).isoformat(),
                }
                for p in authorized
            ],
        }
    except Exception as e:
        logger.error(f"[detector.detect_failed_payments] Razorpay API call failed: {e}")
        return {
            "source": "razorpay_live_poll",
            "polled_at": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
            "note": "Razorpay test-mode: ensure test API keys are set and the account has payment history",
            "failed_count": 0,
            "authorized_not_captured": 0,
            "failed_payments": [],
            "at_risk_payments": [],
        }


def get_payment_status(payment_id: str) -> dict:
    """Fetch the current status of a single Razorpay payment."""
    try:
        p = _client.payment.fetch(payment_id)
        return {
            "id": p["id"],
            "amount": p["amount"] / 100,
            "status": p["status"],
            "error_code": p.get("error_code"),
            "error_description": p.get("error_description"),
            "method": p.get("method"),
            "created_at": datetime.fromtimestamp(p["created_at"], tz=timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"[detector.get_payment_status] Failed for {payment_id}: {e}")
        return {"error": str(e), "payment_id": payment_id}
