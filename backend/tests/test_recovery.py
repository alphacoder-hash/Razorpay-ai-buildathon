"""
test_recovery.py — Unit tests for the recovery action executor.
Run: pytest backend/tests/test_recovery.py -v
"""
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.database import Base, Payment, PaymentStatus
from agent import recovery


# ── In-memory test DB ───────────────────────────────────────────────────────

@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def _make_payment(db, **kwargs) -> Payment:
    defaults = {
        "id": "pay_test_001",
        "order_id": "order_test_001",
        "merchant_id": "merchant_001",
        "customer_email": "test@example.com",
        "customer_phone": "9999999999",
        "amount": 5000.0,
        "currency": "INR",
        "status": PaymentStatus.FAILED,
        "root_cause": "BANK_DECLINE",
        "gemini_reasoning": "Bank declined the transaction.",
        "retry_count": 0,
    }
    defaults.update(kwargs)
    p = Payment(**defaults)
    db.add(p)
    db.commit()
    return p


# ── Fraud gate ──────────────────────────────────────────────────────────────

@patch("agent.recovery.audit")
def test_fraud_flag_always_escalates(mock_audit, db):
    """FRAUD_FLAG must NEVER be auto-retried — must escalate immediately."""
    mock_audit.log = MagicMock()
    payment = _make_payment(db, root_cause="FRAUD_FLAG")
    result = recovery.execute(db, payment)
    assert result["status"] == "ESCALATED"
    assert payment.status == PaymentStatus.ESCALATED
    assert payment.retry_count == 0   # no retry should have happened


@patch("agent.recovery.audit")
def test_max_retries_escalates(mock_audit, db):
    """Payment with retry_count >= MAX_RETRIES must escalate — no more retries."""
    mock_audit.log = MagicMock()
    payment = _make_payment(db, root_cause="BANK_DECLINE", retry_count=3)
    result = recovery.execute(db, payment)
    assert result["status"] == "ESCALATED"


# ── Retry path ──────────────────────────────────────────────────────────────

@patch("agent.recovery.audit")
@patch("agent.recovery.random.random", return_value=0.1)   # force success (< 0.70)
def test_network_timeout_simulated_retry_succeeds(mock_rand, mock_audit, db):
    """NETWORK_TIMEOUT → SIMULATED_RETRY → should mark RECOVERED when RNG succeeds."""
    mock_audit.log = MagicMock()
    payment = _make_payment(db, root_cause="NETWORK_TIMEOUT")
    result = recovery.execute(db, payment)
    assert result["status"] == "RECOVERED"
    assert payment.status == PaymentStatus.RECOVERED
    assert payment.retry_count == 1
    assert payment.recovery_action == "SIMULATED_RETRY"


@patch("agent.recovery.audit")
@patch("agent.recovery.random.random", return_value=0.95)  # force failure (>= 0.70)
def test_bank_decline_simulated_retry_fails(mock_rand, mock_audit, db):
    """BANK_DECLINE → SIMULATED_RETRY → FAILED when RNG fails."""
    mock_audit.log = MagicMock()
    payment = _make_payment(db, root_cause="BANK_DECLINE")
    result = recovery.execute(db, payment)
    assert result["status"] == "FAILED"
    assert payment.retry_count == 1


# ── Payment link paths ──────────────────────────────────────────────────────

@patch("agent.recovery.audit")
@patch("agent.recovery.client")
def test_insufficient_funds_sends_payment_link(mock_rzp, mock_audit, db):
    """INSUFFICIENT_FUNDS → real Razorpay payment link → PENDING."""
    mock_audit.log = MagicMock()
    mock_rzp.payment_link.create.return_value = {"short_url": "https://rzp.io/test123"}
    payment = _make_payment(db, root_cause="INSUFFICIENT_FUNDS")
    result = recovery.execute(db, payment)
    assert result["status"] == "PENDING"
    assert payment.status == PaymentStatus.PENDING
    assert "rzp.io" in result.get("link", "")
    mock_rzp.payment_link.create.assert_called_once()


@patch("agent.recovery.audit")
@patch("agent.recovery.client")
def test_card_expired_sends_payment_link_with_correct_label(mock_rzp, mock_audit, db):
    """CARD_EXPIRED → sends link with REQUEST_NEW_METHOD label."""
    mock_audit.log = MagicMock()
    mock_rzp.payment_link.create.return_value = {"short_url": "https://rzp.io/card456"}
    payment = _make_payment(db, root_cause="CARD_EXPIRED")
    result = recovery.execute(db, payment)
    assert result["status"] == "PENDING"
    assert result["action"] == "REQUEST_NEW_METHOD"


@patch("agent.recovery.audit")
@patch("agent.recovery.client")
def test_checkout_abandoned_sends_abandonment_link(mock_rzp, mock_audit, db):
    """CHECKOUT_ABANDONED → ABANDONMENT_RECOVERY link."""
    mock_audit.log = MagicMock()
    mock_rzp.payment_link.create.return_value = {"short_url": "https://rzp.io/cart789"}
    payment = _make_payment(db, root_cause="CHECKOUT_ABANDONED")
    result = recovery.execute(db, payment)
    assert result["status"] == "PENDING"
    assert result["action"] == "ABANDONMENT_RECOVERY"


@patch("agent.recovery.audit")
@patch("agent.recovery.client")
def test_subscription_failed_sends_subscription_link(mock_rzp, mock_audit, db):
    """SUBSCRIPTION_FAILED → SUBSCRIPTION_RECOVERY link."""
    mock_audit.log = MagicMock()
    mock_rzp.payment_link.create.return_value = {"short_url": "https://rzp.io/sub000", "id": "plink_sub000"}
    payment = _make_payment(db, root_cause="SUBSCRIPTION_FAILED")
    result = recovery.execute(db, payment)
    assert result["status"] == "PENDING"
    assert result["action"] == "SUBSCRIPTION_RECOVERY"
    assert payment.payment_link_id == "plink_sub000"


@patch("agent.recovery.audit")
@patch("agent.recovery.client")
def test_overdue_invoice_executes_b2b_dunning(mock_rzp, mock_audit, db):
    """OVERDUE_INVOICE → B2B_DUNNING_SEQUENCE with payment link & promise-to-pay schedule."""
    mock_audit.log = MagicMock()
    mock_rzp.payment_link.create.return_value = {"short_url": "https://rzp.io/inv123", "id": "plink_inv123"}
    payment = _make_payment(db, root_cause="OVERDUE_INVOICE", amount=85000.0)
    result = recovery.execute(db, payment)
    assert result["status"] == "PENDING"
    assert result["action"] == "B2B_DUNNING_SEQUENCE"
    assert payment.payment_link_id == "plink_inv123"


@patch("agent.recovery.audit")
@patch("agent.recovery.client")
def test_sync_payment_links_reconciles_paid(mock_rzp, mock_audit, db):
    """sync_payment_links should update PENDING payment to RECOVERED when Razorpay status is paid."""
    mock_audit.log = MagicMock()
    payment = _make_payment(db, status=PaymentStatus.PENDING, payment_link_id="plink_paid_999", amount=12000.0)
    mock_rzp.payment_link.fetch.return_value = {"id": "plink_paid_999", "status": "paid"}

    sync_res = recovery.sync_payment_links(db)
    assert sync_res["newly_recovered"] == 1
    assert sync_res["money_recovered"] == 12000.0
    assert payment.status == PaymentStatus.RECOVERED


# ── Graceful failure ────────────────────────────────────────────────────────

@patch("agent.recovery.audit")
@patch("agent.recovery.client")
def test_payment_link_api_failure_escalates_gracefully(mock_rzp, mock_audit, db):
    """If Razorpay API throws when creating link, gracefully escalate — never crash."""
    mock_audit.log = MagicMock()
    mock_rzp.payment_link.create.side_effect = Exception("Razorpay API down")
    payment = _make_payment(db, root_cause="INSUFFICIENT_FUNDS")
    result = recovery.execute(db, payment)
    assert result["status"] == "ESCALATED"     # graceful fallback
    assert payment.status == PaymentStatus.ESCALATED

