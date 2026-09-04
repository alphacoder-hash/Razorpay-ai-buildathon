import json
from openai import OpenAI
from config import GROK_API_KEY, RECOVERY_ACTIONS

# Auto-detect whether key is GroqCloud (gsk_...) or x.ai Grok (xai-...)
if GROK_API_KEY and GROK_API_KEY.startswith("gsk_"):
    _base_url = "https://api.groq.com/openai/v1"
    _MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
else:
    _base_url = "https://api.x.ai/v1"
    _MODELS = ["grok-3-mini", "grok-3", "grok-2"]

_client = OpenAI(
    api_key=GROK_API_KEY,
    base_url=_base_url,
)

VALID_CAUSES = list(RECOVERY_ACTIONS.keys())
_CACHE = {}


def classify(error_code: str, error_description: str, amount: float = 0.0) -> dict:
    cache_key = f"{error_code}::{error_description}"
    if cache_key in _CACHE:
        cached = dict(_CACHE[cache_key])
        return cached

    prompt = f"""You are a payment failure analyst and recovery copywriter for an Indian fintech platform.

Classify this payment failure into exactly ONE root cause from this list:
{VALID_CAUSES}

Payment details:
- Error Code: {error_code}
- Description: {error_description}
- Amount: ₹{amount:,.2f}

Rules:
1. Reply with ONLY a JSON object, no markdown code fence, no surrounding text.
2. Format:
{{
  "root_cause": "<CAUSE>",
  "confidence": <0.0-1.0>,
  "reasoning": "<one clear sentence explaining the root cause>",
  "customer_message": "<a polite, high-conversion 1-2 sentence recovery message tailored to an Indian customer in natural conversational Hinglish or professional English>"
}}
3. If unsure of root cause, use UNKNOWN.
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

        text = response

        # Strip all markdown code fence variants the model may return
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
        text = text.strip()
        result = json.loads(text)
        if result.get("root_cause") not in VALID_CAUSES:
            result["root_cause"] = "UNKNOWN"
        if "customer_message" not in result or not result["customer_message"]:
            result["customer_message"] = "Your payment was interrupted. Please complete your transaction using this direct link."
        _CACHE[cache_key] = result
        return result

    except Exception as e:
        return {
            "root_cause": "UNKNOWN",
            "confidence": 0.0,
            "reasoning": f"Classification failed: {str(e)}",
            "customer_message": "Please use this link to complete your pending transaction.",
        }
