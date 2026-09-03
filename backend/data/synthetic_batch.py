from faker import Faker
import random
import uuid
from datetime import datetime, timezone

fake = Faker("en_IN")

ERROR_SCENARIOS = [
    {"error_code": "BAD_REQUEST_ERROR", "error_description": "Your payment has been declined by the bank.", "root_cause": "BANK_DECLINE"},
    {"error_code": "GATEWAY_ERROR", "error_description": "Network timeout while processing payment.", "root_cause": "NETWORK_TIMEOUT"},
    {"error_code": "BAD_REQUEST_ERROR", "error_description": "Insufficient funds in the account.", "root_cause": "INSUFFICIENT_FUNDS"},
    {"error_code": "BAD_REQUEST_ERROR", "error_description": "Card has expired.", "root_cause": "CARD_EXPIRED"},
    {"error_code": "BAD_REQUEST_ERROR", "error_description": "Payment flagged for suspicious activity.", "root_cause": "FRAUD_FLAG"},
    {"error_code": "SERVER_ERROR", "error_description": "An unexpected error occurred.", "root_cause": "UNKNOWN"},
]

WEIGHTS = [30, 25, 20, 10, 5, 10]  # realistic distribution


def generate_batch(count: int = 60) -> list[dict]:
    payments = []
    for _ in range(count):
        scenario = random.choices(ERROR_SCENARIOS, weights=WEIGHTS, k=1)[0]
        amount = round(random.uniform(100, 50000), 2)
        payments.append({
            "id": f"pay_{uuid.uuid4().hex[:16]}",
            "order_id": f"order_{uuid.uuid4().hex[:16]}",
            "merchant_id": f"merchant_{random.randint(1, 5):03d}",
            "customer_email": fake.email(),
            "customer_phone": fake.phone_number(),
            "amount": amount,
            "currency": "INR",
            "status": "FAILED",
            "root_cause": None,
            "retry_count": 0,
            "recovery_action": None,
            "error_code": scenario["error_code"],
            "error_description": scenario["error_description"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return payments
