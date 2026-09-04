"""
sentiment.py — AI Sentiment Analysis for inbound customer replies.

Classifies customer replies as HARDSHIP, DISPUTE, PAYMENT_PLANNED, or READY_TO_PAY.
Used by the dunning engine to intelligently pause or accelerate recovery.
"""
import json
import logging
from openai import OpenAI
from config import GROK_API_KEY

logger = logging.getLogger(__name__)

# Reuse same client config from classifier
if GROK_API_KEY and GROK_API_KEY.startswith("gsk_"):
    _base_url = "https://api.groq.com/openai/v1"
    _MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
else:
    _base_url = "https://api.x.ai/v1"
    _MODELS = ["grok-3-mini", "grok-3", "grok-2"]

_client = OpenAI(
    api_key=GROK_API_KEY or "missing_key",
    base_url=_base_url,
)

SENTIMENT_LABELS = ["HARDSHIP", "DISPUTE", "PAYMENT_PLANNED", "READY_TO_PAY", "UNCLEAR"]

# Action mapping: what to do for each sentiment label
SENTIMENT_ACTIONS = {
    "HARDSHIP":        "PAUSE_DUNNING",      # Customer in financial distress — pause & escalate sensitively
    "DISPUTE":         "ESCALATE_SUPPORT",   # Customer disputes the charge — hand off to support
    "PAYMENT_PLANNED": "PAUSE_DUNNING",      # Customer committed to pay — set soft PTP date
    "READY_TO_PAY":    "SEND_PAYMENT_LINK",  # Customer ready now — send link immediately
    "UNCLEAR":         "CONTINUE_DUNNING",   # No actionable signal — continue dunning
}


def analyze(customer_reply: str) -> dict:
    """
    Analyzes a customer's inbound reply to classify their sentiment and recommend an action.
    Returns a dict with: label, confidence, reasoning, recommended_action, empathy_response.
    """
    prompt = f"""You are an AI debt recovery empathy engine for an Indian fintech platform.

Classify this customer reply into exactly ONE sentiment label from: {SENTIMENT_LABELS}

Customer reply: "{customer_reply}"

Rules:
1. Reply ONLY with a JSON object, no markdown or surrounding text.
2. Format:
{{
  "label": "<LABEL>",
  "confidence": <0.0-1.0>,
  "reasoning": "<one clear sentence>",
  "empathy_response": "<a warm, culturally-sensitive 1-sentence response in Hinglish or English that acknowledges the customer's situation>"
}}
3. HARDSHIP = job loss, illness, financial crisis
4. DISPUTE = denies owing money, claims product fault
5. PAYMENT_PLANNED = has a specific date in mind to pay
6. READY_TO_PAY = wants to pay right now
7. UNCLEAR = no actionable signal
"""
    try:
        response = None
        for model_name in _MODELS:
            try:
                resp = _client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                )
                text = resp.choices[0].message.content
                if text:
                    response = text.strip()
                    break
            except Exception:
                continue

        if not response:
            raise ValueError("All AI model attempts failed or returned empty response")

        # Strip markdown fences if present
        if response.startswith("```"):
            response = response.split("\n", 1)[-1]
        if response.endswith("```"):
            response = response.rsplit("```", 1)[0]
        response = response.strip()

        result = json.loads(response)
        if result.get("label") not in SENTIMENT_LABELS:
            result["label"] = "UNCLEAR"
        result["recommended_action"] = SENTIMENT_ACTIONS.get(result["label"], "CONTINUE_DUNNING")
        return result

    except Exception as e:
        logger.error(f"[sentiment.analyze] Failed: {e}")
        return {
            "label": "UNCLEAR",
            "confidence": 0.0,
            "reasoning": f"Sentiment analysis failed: {str(e)}",
            "empathy_response": "Thank you for reaching out. We will follow up with you shortly.",
            "recommended_action": "CONTINUE_DUNNING",
        }
