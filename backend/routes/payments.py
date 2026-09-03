import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db, Payment
from agent import orchestrator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/")
def list_payments(status: str = None, db: Session = Depends(get_db)):
    try:
        query = db.query(Payment)
        if status:
            query = query.filter(Payment.status == status.upper())
        payments = query.order_by(Payment.created_at.desc()).limit(200).all()
        return [
            {
                "id": p.id,
                "order_id": p.order_id,
                "merchant_id": p.merchant_id,
                "customer_email": p.customer_email,
                "amount": p.amount,
                "currency": p.currency,
                "status": p.status,
                "root_cause": p.root_cause,
                "retry_count": p.retry_count,
                "recovery_action": p.recovery_action,
                "error_code": p.error_code,
                "error_description": p.error_description,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in payments
        ]
    except Exception as e:
        logger.error(f"[list_payments] Failed to fetch payments: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch payments: {str(e)}")


@router.post("/{payment_id}/recover")
def recover_payment(payment_id: str, db: Session = Depends(get_db)):
    try:
        result = orchestrator.process_single(db, payment_id)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[recover_payment] Failed to recover payment {payment_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Recovery failed: {str(e)}")
