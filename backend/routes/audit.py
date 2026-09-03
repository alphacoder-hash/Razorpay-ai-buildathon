import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db, AuditLog

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/")
def get_all_logs(limit: int = 100, db: Session = Depends(get_db)):
    try:
        logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
        return [
            {
                "payment_id": l.payment_id,
                "action": l.action,
                "actor": l.actor,
                "result": l.result,
                "detail": l.detail,
                "timestamp": l.timestamp.isoformat(),
            }
            for l in logs
        ]
    except Exception as e:
        logger.error(f"[get_all_logs] Failed to fetch audit logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit logs: {str(e)}")


@router.get("/{payment_id}")
def get_audit_trail(payment_id: str, db: Session = Depends(get_db)):
    try:
        logs = db.query(AuditLog).filter(AuditLog.payment_id == payment_id).order_by(AuditLog.timestamp).all()
        if not logs:
            return []
        return [
            {
                "payment_id": l.payment_id,
                "action": l.action,
                "actor": l.actor,
                "result": l.result,
                "detail": l.detail,
                "timestamp": l.timestamp.isoformat(),
            }
            for l in logs
        ]
    except Exception as e:
        logger.error(f"[get_audit_trail] Failed to fetch trail for {payment_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit trail: {str(e)}")
