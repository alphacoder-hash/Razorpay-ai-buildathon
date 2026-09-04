import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db, BatchRun, Payment, PaymentStatus
from agent import orchestrator, recovery

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agent", tags=["agent"])


def _serialize_run(r: BatchRun) -> dict:
    return {
        "run_id": r.run_id,
        "total": r.total,
        "recovered": r.recovered,
        "escalated": r.escalated,
        "failed": r.failed,
        "skipped": r.skipped or 0,
        "money_recovered": r.money_recovered,
        "recovery_rate": r.recovery_rate,
        "stopped_early": bool(r.stopped_early),
        "stopped_at_index": r.stopped_at_index,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
    }


@router.post("/run-batch")
def run_batch(count: int = 60, db: Session = Depends(get_db)):
    if count < 1 or count > 200:
        raise HTTPException(status_code=400, detail="count must be between 1 and 200")
    try:
        result = orchestrator.run_batch(db, count)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[run_batch] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Batch run failed: {str(e)}")


@router.get("/runs")
def list_runs(db: Session = Depends(get_db)):
    try:
        runs = db.query(BatchRun).order_by(BatchRun.started_at.desc()).all()
        return [_serialize_run(r) for r in runs]
    except Exception as e:
        logger.error(f"[list_runs] Failed to fetch runs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch runs: {str(e)}")


@router.get("/runs/{run_id}")
def get_run(run_id: str, db: Session = Depends(get_db)):
    try:
        run = db.query(BatchRun).filter(BatchRun.run_id == run_id).first()
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")
        return _serialize_run(run)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[get_run] Failed to fetch run {run_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch run: {str(e)}")


@router.post("/run-dunning")
def run_progressive_dunning(db: Session = Depends(get_db)):
    """
    Progressive B2B Dunning Sequencer (Track 03):
    Finds all active OVERDUE_INVOICE payments and bumps their dunning level.
    Skips any payment where a future Promise-to-Pay date has been set by the customer.
    Level 0 → 1: Sends initial payment link.
    Level 1 → 2: Sends reminder follow-up.
    Level 2+: Escalates to Finance Manager.
    """
    try:
        payments = db.query(Payment).filter(
            Payment.root_cause == "OVERDUE_INVOICE",
            Payment.status.in_([PaymentStatus.FAILED, PaymentStatus.PENDING])
        ).all()

        processed = 0
        skipped_ptp = 0
        for p in payments:
            # Skip if customer has a valid future promise-to-pay date
            if p.promise_to_pay_date:
                ptp = p.promise_to_pay_date
                if ptp.tzinfo is None:
                    ptp = ptp.replace(tzinfo=timezone.utc)
                if ptp > datetime.now(timezone.utc):
                    skipped_ptp += 1
                    continue

            p.dunning_level = (p.dunning_level or 0) + 1
            recovery._b2b_dunning_sequence(db, p)
            processed += 1

        db.commit()
        return {
            "status": "success",
            "payments_processed": processed,
            "skipped_promise_to_pay": skipped_ptp,
        }
    except Exception as e:
        logger.error(f"[run_progressive_dunning] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
