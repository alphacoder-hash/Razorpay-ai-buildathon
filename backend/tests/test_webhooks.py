"""
test_webhooks.py — Integration tests for Razorpay webhooks.
Run: python -m pytest backend/tests/test_webhooks.py -v
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from models.database import Base, Payment, PaymentStatus, get_db
from main import app

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)



def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@patch("agent.orchestrator.classifier.classify", return_value={"root_cause": "NETWORK_TIMEOUT", "confidence": 0.9, "reasoning": "Timeout", "customer_message": "Retry"})
@patch("agent.recovery.execute", return_value={"status": "RECOVERED", "action": "SIMULATED_RETRY"})
def test_webhook_payment_failed_triggers_recovery(mock_rec, mock_cls):
    """payment.failed webhook event should ingest the payment and run recovery."""
    payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_webhook_test_01",
                    "amount": 250000,
                    "currency": "INR",
                    "email": "wh_test@example.com",
                    "contact": "9876543210",
                    "error_code": "GATEWAY_ERROR",
                    "error_description": "Network timeout",
                }
            }
        }
    }
    response = client.post("/webhooks/razorpay", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processed"
    assert data["event"] == "payment.failed"


def test_webhook_payment_link_paid_reconciles_status():
    """payment_link.paid webhook event should transition payment to RECOVERED."""
    db = TestingSessionLocal()
    p = Payment(
        id="pay_plink_target",
        order_id="order_target",
        merchant_id="merchant_001",
        customer_email="plink@example.com",
        customer_phone="9999999999",
        amount=4500.0,
        currency="INR",
        status=PaymentStatus.PENDING,
        payment_link_id="plink_webhook_123",
    )
    db.add(p)
    db.commit()
    db.close()

    payload = {
        "event": "payment_link.paid",
        "payload": {
            "payment_link": {
                "entity": {
                    "id": "plink_webhook_123",
                    "amount": 450000,
                    "status": "paid",
                }
            }
        }
    }
    response = client.post("/webhooks/razorpay", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "recovered"

    db = TestingSessionLocal()
    updated = db.query(Payment).filter(Payment.id == "pay_plink_target").first()
    assert updated.status == PaymentStatus.RECOVERED
    db.close()
