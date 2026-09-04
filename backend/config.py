from dotenv import load_dotenv
import os

load_dotenv()

import logging

logger = logging.getLogger(__name__)

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
GROK_API_KEY = os.getenv("GROK_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./payback.db")

# Warn if keys are missing rather than crash the container
_missing = [k for k, v in {
    "RAZORPAY_KEY_ID": RAZORPAY_KEY_ID,
    "RAZORPAY_KEY_SECRET": RAZORPAY_KEY_SECRET,
    "GROK_API_KEY": GROK_API_KEY,
}.items() if not v]
if _missing:
    logger.warning(f"⚠️ Missing environment variables: {', '.join(_missing)}. Please set them in Railway's Variables tab.")

# Agent stopping rules
MAX_RETRIES_PER_PAYMENT = 3
CONSECUTIVE_FAILURE_STOP = 2
RETRY_DELAY_SECONDS = {"NETWORK_TIMEOUT": 0, "BANK_DECLINE": 7200, "INSUFFICIENT_FUNDS": 86400}

# Recovery action map — each root cause maps to a bounded action
RECOVERY_ACTIONS = {
    "NETWORK_TIMEOUT":      "IMMEDIATE_RETRY",
    "BANK_DECLINE":         "DELAYED_RETRY",
    "INSUFFICIENT_FUNDS":   "SEND_PAYMENT_LINK",
    "CARD_EXPIRED":         "REQUEST_NEW_METHOD",
    "FRAUD_FLAG":           "ESCALATE_HUMAN",
    "CHECKOUT_ABANDONED":   "SEND_ABANDONMENT_LINK",   # time-sensitive recovery link
    "SUBSCRIPTION_FAILED":  "SEND_SUBSCRIPTION_LINK",  # mandate retry or new payment link
    "OVERDUE_INVOICE":      "B2B_DUNNING_SEQUENCE",   # B2B receivables chaser with progressive reminders
    "UNKNOWN":              "SEND_PAYMENT_LINK",
}

# These root causes are NEVER auto-retried — must go to human
NO_AUTO_RETRY = {"FRAUD_FLAG"}


