import logging
from sqlalchemy.orm import Session
from models.database import AuditLog
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def log(db: Session, payment_id: str, action: str, result: str, detail: str, actor: str = "AI_AGENT"):
    try:
        entry = AuditLog(
            payment_id=payment_id,
            action=action,
            actor=actor,
            result=result,
            detail=detail,
            timestamp=datetime.now(timezone.utc),
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[audit.log] Failed to write audit log for {payment_id} action={action}: {e}")


def get_trail(db: Session, payment_id: str) -> list[dict]:
    try:
        logs = db.query(AuditLog).filter(AuditLog.payment_id == payment_id).order_by(AuditLog.timestamp).all()
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
        logger.error(f"[audit.get_trail] Failed to fetch trail for {payment_id}: {e}")
        return []
