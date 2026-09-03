import json
from google import genai
from config import GEMINI_API_KEY, RECOVERY_ACTIONS

_client = genai.Client(api_key=GEMINI_API_KEY)

VALID_CAUSES = list(RECOVERY_ACTIONS.keys())


def classify(error_code: str, error_description: str) -> dict:
    prompt = f"""You are a payment failure analyst for an Indian fintech platform.

Classify this payment failure into exactly ONE root cause from this list:
{VALID_CAUSES}

Payment error:
- Error Code: {error_code}
- Description: {error_description}

Rules:
- Reply with ONLY a JSON object, no markdown, no explanation
- Format: {{"root_cause": "<CAUSE>", "confidence": <0.0-1.0>, "reasoning": "<one sentence>"}}
- If unsure, use UNKNOWN
"""
    try:
        response = _client.models.generate_content(model="gemini-1.5-flash", contents=prompt)
        text = response.text.strip().strip("```json").strip("```").strip()
        result = json.loads(text)
        if result.get("root_cause") not in VALID_CAUSES:
            result["root_cause"] = "UNKNOWN"
        return result
    except Exception as e:
        return {"root_cause": "UNKNOWN", "confidence": 0.0, "reasoning": f"Classification failed: {str(e)}"}
