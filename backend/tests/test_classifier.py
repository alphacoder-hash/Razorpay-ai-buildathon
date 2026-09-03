"""
test_classifier.py — Unit tests for the Gemini root-cause classifier.
Run: pytest backend/tests/test_classifier.py -v
"""
import pytest
from unittest.mock import patch, MagicMock
from agent.classifier import classify

# ── Helpers ────────────────────────────────────────────────────────────────

def _mock_gemini(text: str):
    """Returns a mock Gemini client whose generate_content returns `text`."""
    mock_response = MagicMock()
    mock_response.text = text
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response
    return mock_client


# ── Happy-path tests ────────────────────────────────────────────────────────

@patch("agent.classifier._client")
def test_classify_bank_decline(mock_client):
    """Should classify a bank decline error correctly."""
    mock_client.models.generate_content.return_value.text = (
        '{"root_cause": "BANK_DECLINE", "confidence": 0.95, "reasoning": "Bank explicitly declined the card."}'
    )
    result = classify("BAD_REQUEST_ERROR", "Your payment has been declined by the bank.")
    assert result["root_cause"] == "BANK_DECLINE"
    assert result["confidence"] >= 0.8
    assert "reasoning" in result


@patch("agent.classifier._client")
def test_classify_network_timeout(mock_client):
    """Should classify a network timeout correctly."""
    mock_client.models.generate_content.return_value.text = (
        '{"root_cause": "NETWORK_TIMEOUT", "confidence": 0.92, "reasoning": "Gateway timed out during processing."}'
    )
    result = classify("GATEWAY_ERROR", "Network timeout while processing payment.")
    assert result["root_cause"] == "NETWORK_TIMEOUT"


@patch("agent.classifier._client")
def test_classify_fraud_flag(mock_client):
    """Should correctly identify fraud-flagged payments."""
    mock_client.models.generate_content.return_value.text = (
        '{"root_cause": "FRAUD_FLAG", "confidence": 0.88, "reasoning": "Payment flagged by risk engine."}'
    )
    result = classify("BAD_REQUEST_ERROR", "Payment flagged for suspicious activity.")
    assert result["root_cause"] == "FRAUD_FLAG"


@patch("agent.classifier._client")
def test_classify_checkout_abandoned(mock_client):
    """Should classify checkout abandonment as CHECKOUT_ABANDONED."""
    mock_client.models.generate_content.return_value.text = (
        '{"root_cause": "CHECKOUT_ABANDONED", "confidence": 0.9, "reasoning": "Customer left checkout without paying."}'
    )
    result = classify("CHECKOUT_ABANDONED", "Customer reached checkout but did not complete payment within 30 minutes.")
    assert result["root_cause"] == "CHECKOUT_ABANDONED"


@patch("agent.classifier._client")
def test_classify_subscription_failed(mock_client):
    """Should classify subscription renewal failures."""
    mock_client.models.generate_content.return_value.text = (
        '{"root_cause": "SUBSCRIPTION_FAILED", "confidence": 0.91, "reasoning": "Mandate auto-debit failed."}'
    )
    result = classify("SUBSCRIPTION_ERROR", "Auto-debit mandate failed; subscription renewal could not be collected.")
    assert result["root_cause"] == "SUBSCRIPTION_FAILED"


@patch("agent.classifier._client")
def test_classify_overdue_invoice(mock_client):
    """Should classify overdue B2B invoices as OVERDUE_INVOICE and generate customer message."""
    mock_client.models.generate_content.return_value.text = (
        '{"root_cause": "OVERDUE_INVOICE", "confidence": 0.96, "reasoning": "Invoice unpaid after due date.", "customer_message": "Friendly reminder to clear Invoice #INV-2025."}'
    )
    result = classify("INVOICE_OVERDUE", "Invoice #INV-2025-084 overdue by 14 days.", amount=75000.0)
    assert result["root_cause"] == "OVERDUE_INVOICE"
    assert "customer_message" in result



# ── Edge case / failure tests ───────────────────────────────────────────────

@patch("agent.classifier._client")
def test_classify_invalid_root_cause_falls_back_to_unknown(mock_client):
    """If Gemini returns an unrecognised cause, should fall back to UNKNOWN."""
    mock_client.models.generate_content.return_value.text = (
        '{"root_cause": "TOTALLY_MADE_UP", "confidence": 0.5, "reasoning": "Whatever."}'
    )
    result = classify("BAD_REQUEST_ERROR", "Some weird error.")
    assert result["root_cause"] == "UNKNOWN"


@patch("agent.classifier._client")
def test_classify_gemini_returns_markdown_fenced_json(mock_client):
    """Gemini sometimes wraps JSON in markdown fences — must strip gracefully."""
    mock_client.models.generate_content.return_value.text = (
        '```json\n{"root_cause": "CARD_EXPIRED", "confidence": 0.87, "reasoning": "Card expired."}\n```'
    )
    result = classify("BAD_REQUEST_ERROR", "Card has expired.")
    assert result["root_cause"] == "CARD_EXPIRED"


@patch("agent.classifier._client")
def test_classify_gemini_api_failure_returns_unknown(mock_client):
    """If Gemini API throws, should return UNKNOWN with 0 confidence — never crash."""
    mock_client.models.generate_content.side_effect = Exception("API quota exceeded")
    result = classify("BAD_REQUEST_ERROR", "Some error.")
    assert result["root_cause"] == "UNKNOWN"
    assert result["confidence"] == 0.0
    assert "Classification failed" in result["reasoning"]


@patch("agent.classifier._client")
def test_classify_malformed_json_returns_unknown(mock_client):
    """If Gemini returns non-JSON garbage, should return UNKNOWN — never crash."""
    mock_client.models.generate_content.return_value.text = "I cannot classify this payment."
    result = classify("SERVER_ERROR", "Unexpected error.")
    assert result["root_cause"] == "UNKNOWN"
    assert result["confidence"] == 0.0
