"""
test_orchestrator.py — Integration tests for the batch orchestrator.
Run: pytest backend/tests/test_orchestrator.py -v
"""
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.database import Base, Payment, BatchRun, PaymentStatus
from agent import orchestrator


# ── In-memory test DB ───────────────────────────────────────────────────────

@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


# ── Mock helpers ────────────────────────────────────────────────────────────

def _mock_classifier(root_cause: str = "BANK_DECLINE"):
    return {"root_cause": root_cause, "confidence": 0.9, "reasoning": f"Test classification: {root_cause}"}


def _patch_all(classifier_cause="BANK_DECLINE", recovery_status="RECOVERED"):
    """Convenience: patches both classifier and recovery for batch tests."""
    return [
        patch("agent.orchestrator.classifier.classify", return_value=_mock_classifier(classifier_cause)),
        patch("agent.orchestrator.recovery.execute", return_value={"status": recovery_status}),
        patch("agent.orchestrator.audit.log"),
    ]


# ── Batch run basics ────────────────────────────────────────────────────────

def test_run_batch_returns_correct_structure(db):
    """Batch run result must contain all required metric keys."""
    with patch("agent.orchestrator.classifier.classify", return_value=_mock_classifier()), \
         patch("agent.orchestrator.recovery.execute", return_value={"status": "RECOVERED"}), \
         patch("agent.orchestrator.audit.log"):
        result = orchestrator.run_batch(db, count=10)

    assert "run_id" in result
    assert "total" in result
    assert "recovered" in result
    assert "escalated" in result
    assert "failed" in result
    assert "skipped" in result
    assert "money_recovered" in result
    assert "recovery_rate" in result
    assert "stopped_early" in result
    assert result["total"] == 10


def test_run_batch_all_recovered(db):
    """When all payments recover, recovery_rate must be 100% and skipped=0."""
    with patch("agent.orchestrator.classifier.classify", return_value=_mock_classifier()), \
         patch("agent.orchestrator.recovery.execute", return_value={"status": "RECOVERED"}), \
         patch("agent.orchestrator.audit.log"):
        result = orchestrator.run_batch(db, count=20)

    assert result["recovered"] == 20
    assert result["recovery_rate"] == 100.0
    assert result["skipped"] == 0
    assert result["stopped_early"] is False


def test_run_batch_persists_batch_run_to_db(db):
    """A BatchRun record must be created in the DB after a batch run."""
    with patch("agent.orchestrator.classifier.classify", return_value=_mock_classifier()), \
         patch("agent.orchestrator.recovery.execute", return_value={"status": "RECOVERED"}), \
         patch("agent.orchestrator.audit.log"):
        result = orchestrator.run_batch(db, count=5)

    run = db.query(BatchRun).filter(BatchRun.run_id == result["run_id"]).first()
    assert run is not None
    assert run.total == 5
    assert run.completed_at is not None


# ── Stopping rule ───────────────────────────────────────────────────────────

def test_stopping_rule_triggers_on_two_consecutive_failures(db):
    """
    When 2 consecutive payments fail, the stopping rule must fire:
    - stopped_early must be True
    - stopped_at_index must be set
    - remaining payments must be skipped (skipped > 0)
    """
    call_count = {"n": 0}

    def recovery_side_effect(db, payment):
        call_count["n"] += 1
        # First 2 calls fail → triggers stopping rule
        if call_count["n"] <= 2:
            return {"status": "FAILED"}
        return {"status": "RECOVERED"}

    with patch("agent.orchestrator.classifier.classify", return_value=_mock_classifier()), \
         patch("agent.orchestrator.recovery.execute", side_effect=recovery_side_effect), \
         patch("agent.orchestrator.audit.log"):
        result = orchestrator.run_batch(db, count=20)

    assert result["stopped_early"] is True
    assert result["stopped_at_index"] is not None
    assert result["skipped"] > 0
    # Only 2 payments should have been processed before halt
    assert result["failed"] == 2


def test_gemini_reasoning_persisted_on_payment(db):
    """Gemini reasoning must be stored on the Payment record after classification."""
    with patch("agent.orchestrator.classifier.classify",
               return_value={"root_cause": "CARD_EXPIRED", "confidence": 0.9, "reasoning": "Card expired in Jan 2024."}), \
         patch("agent.orchestrator.recovery.execute", return_value={"status": "RECOVERED"}), \
         patch("agent.orchestrator.audit.log"):
        orchestrator.run_batch(db, count=3)

    payments = db.query(Payment).all()
    for p in payments:
        assert p.gemini_reasoning == "Card expired in Jan 2024."
        assert p.root_cause == "CARD_EXPIRED"


# ── Single payment processing ───────────────────────────────────────────────

def test_process_single_not_found_returns_error(db):
    """process_single on a nonexistent ID must return an error, not crash."""
    result = orchestrator.process_single(db, "pay_does_not_exist")
    assert "error" in result


def test_process_single_already_recovered_blocked(db):
    """Re-processing an already-RECOVERED payment must be blocked."""
    p = Payment(
        id="pay_already_done",
        order_id="order_x",
        merchant_id="merchant_001",
        customer_email="a@b.com",
        customer_phone="9000000000",
        amount=1000.0,
        currency="INR",
        status=PaymentStatus.RECOVERED,
        retry_count=1,
    )
    db.add(p)
    db.commit()
    result = orchestrator.process_single(db, "pay_already_done")
    assert "error" in result
    assert "already" in result["error"].lower()
