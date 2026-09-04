from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Text, Enum, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, timezone
import enum
from config import DATABASE_URL

db_url = DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
engine = create_engine(db_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class PaymentStatus(str, enum.Enum):
    FAILED = "FAILED"
    RECOVERED = "RECOVERED"
    ESCALATED = "ESCALATED"
    PENDING = "PENDING"
    ABANDONED = "ABANDONED"


class RootCause(str, enum.Enum):
    NETWORK_TIMEOUT = "NETWORK_TIMEOUT"
    BANK_DECLINE = "BANK_DECLINE"
    INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS"
    CARD_EXPIRED = "CARD_EXPIRED"
    FRAUD_FLAG = "FRAUD_FLAG"
    CHECKOUT_ABANDONED = "CHECKOUT_ABANDONED"
    SUBSCRIPTION_FAILED = "SUBSCRIPTION_FAILED"
    OVERDUE_INVOICE = "OVERDUE_INVOICE"
    UNKNOWN = "UNKNOWN"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True)
    order_id = Column(String)
    merchant_id = Column(String)
    customer_email = Column(String)
    customer_phone = Column(String)
    amount = Column(Float)
    currency = Column(String, default="INR")
    status = Column(String, default=PaymentStatus.FAILED)
    root_cause = Column(String, nullable=True)
    gemini_reasoning = Column(Text, nullable=True)   # Grok's explanation, surfaced in UI
    recovery_message = Column(Text, nullable=True)   # Tailored Hinglish/English customer copy
    payment_link_id = Column(String, nullable=True)  # Razorpay plink_xxx for loop closure
    retry_count = Column(Integer, default=0)
    recovery_action = Column(String, nullable=True)
    error_code = Column(String, nullable=True)
    error_description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))



class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    payment_id = Column(String)
    action = Column(String)
    actor = Column(String, default="AI_AGENT")
    result = Column(String)
    detail = Column(Text)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class BatchRun(Base):
    __tablename__ = "batch_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, unique=True)
    total = Column(Integer)
    recovered = Column(Integer, default=0)
    escalated = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    skipped = Column(Integer, default=0)            # payments skipped due to stopping rule
    money_recovered = Column(Float, default=0.0)
    recovery_rate = Column(Float, default=0.0)
    stopped_early = Column(Integer, default=0)      # 1 if batch was halted by stopping rule
    stopped_at_index = Column(Integer, nullable=True)  # index at which agent stopped
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
