from faker import Faker
import random
import uuid
from datetime import datetime, timezone

fake = Faker("en_IN")

ERROR_SCENARIOS = [
    {"error_code": "BAD_REQUEST_ERROR",  "error_description": "Your payment has been declined by the bank.",                       "root_cause": "BANK_DECLINE"},
    {"error_code": "GATEWAY_ERROR",      "error_description": "Network timeout while processing payment.",                         "root_cause": "NETWORK_TIMEOUT"},
    {"error_code": "BAD_REQUEST_ERROR",  "error_description": "Insufficient funds in the account.",                               "root_cause": "INSUFFICIENT_FUNDS"},
    {"error_code": "BAD_REQUEST_ERROR",  "error_description": "Card has expired.",                                                "root_cause": "CARD_EXPIRED"},
    {"error_code": "BAD_REQUEST_ERROR",  "error_description": "Payment flagged for suspicious activity.",                         "root_cause": "FRAUD_FLAG"},
    {"error_code": "CHECKOUT_ABANDONED", "error_description": "Customer reached checkout but did not complete payment within 30 minutes.",  "root_cause": "CHECKOUT_ABANDONED"},
    {"error_code": "SUBSCRIPTION_ERROR", "error_description": "Auto-debit mandate failed; subscription renewal payment could not be collected.", "root_cause": "SUBSCRIPTION_FAILED"},
    {"error_code": "INVOICE_OVERDUE",    "error_description": "Invoice #INV-2025-084 overdue by 14 days. Outstanding B2B balance for annual services.", "root_cause": "OVERDUE_INVOICE"},
    {"error_code": "SERVER_ERROR",       "error_description": "An unexpected error occurred.",                                    "root_cause": "UNKNOWN"},
]

# Realistic distribution: bank declines most common, fraud least common
WEIGHTS = [24, 18, 14, 8, 4, 10, 8, 9, 5]


def generate_batch(count: int = 60) -> list[dict]:
    payments = []
    for _ in range(count):
        scenario = random.choices(ERROR_SCENARIOS, weights=WEIGHTS, k=1)[0]
        # Invoices have higher ticket size
        if scenario["root_cause"] == "OVERDUE_INVOICE":
            amount = round(random.uniform(15000, 120000), 2)
        else:
            amount = round(random.uniform(100, 45000), 2)

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
            "gemini_reasoning": None,
            "recovery_message": None,
            "payment_link_id": None,
            "retry_count": 0,
            "recovery_action": None,
            "error_code": scenario["error_code"],
            "error_description": scenario["error_description"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return payments

