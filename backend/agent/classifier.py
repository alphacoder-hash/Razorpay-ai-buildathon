import json
from google import genai
from config import GEMINI_API_KEY, RECOVERY_ACTIONS

_client = genai.Client(api_key=GEMINI_API_KEY)

VALID_CAUSES = list(RECOVERY_ACTIONS.keys())


def classify(error_code: str, error_description: str, amount: float = 0.0) -> dict:
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
        response = _client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        text = response.text.strip()
        # Strip all markdown code fence variants Gemini may return
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
        return result
    except Exception as e:
        return {
            "root_cause": "UNKNOWN",
            "confidence": 0.0,
            "reasoning": f"Classification failed: {str(e)}",
            "customer_message": "Please use this link to complete your pending transaction.",
        }

