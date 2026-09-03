import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db, BatchRun
from agent import orchestrator

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

