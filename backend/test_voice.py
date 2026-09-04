import sys
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.database import Base, Payment, PaymentStatus, BatchRun
from agent.recovery import _b2b_dunning_sequence
from config import DATABASE_URL

engine = create_engine(DATABASE_URL)
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_dunning():
    db = SessionLocal()
    
    # Clean up any existing dummy
    existing = db.query(Payment).filter(Payment.id == "pay_test_voice").first()
    if existing:
        db.delete(existing)
        db.commit()

    # Create a dummy payment
    p = Payment(
        id="pay_test_voice",
        order_id="order_test",
        merchant_id="merchant_test",
        amount=15000.0,
        currency="INR",
        status=PaymentStatus.FAILED,
        error_code="OVERDUE_INVOICE",
        error_description="Invoice overdue",
        root_cause="OVERDUE_INVOICE",
        dunning_level=0,
        customer_email="test@example.com",
        customer_phone="9999999999"
    )
    db.add(p)
    db.commit()
    
    print(f"Initial Level: {p.dunning_level}")
    
    # Simulate level 0
    res0 = _b2b_dunning_sequence(db, p)
    print("Level 0 Result:", res0.get('status'), res0.get('action'), res0.get('reason'))
    
    # Simulate level 1
    p.dunning_level = 1
    db.commit()
    res1 = _b2b_dunning_sequence(db, p)
    print("Level 1 Result:", res1.get('status'), res1.get('action'), res1.get('reason'))
    
    # Simulate level 2 (Voice)
    p.dunning_level = 2
    db.commit()
    res2 = _b2b_dunning_sequence(db, p)
    print("Level 2 Result:", res2.get('status'), res2.get('action'), res2.get('reason'))
    
    # Simulate level 3 (Escalation)
    p.dunning_level = 3
    db.commit()
    res3 = _b2b_dunning_sequence(db, p)
    print("Level 3 Result:", res3.get('status'), res3.get('action'), res3.get('reason'))
    
    # Cleanup
    db.delete(p)
    db.commit()
    db.close()

if __name__ == "__main__":
    test_dunning()
