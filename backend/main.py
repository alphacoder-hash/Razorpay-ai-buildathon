import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from models.database import init_db
from routes import payments, agent, audit, webhooks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="PayBack AI — Revenue Recovery Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error", "error": str(exc)})


@app.on_event("startup")
def startup():
    try:
        init_db()
        logger.info("Database initialised successfully")
    except Exception as e:
        logger.error(f"Database initialisation failed: {e}")
        raise


app.include_router(payments.router)
app.include_router(agent.router)
app.include_router(audit.router)
app.include_router(webhooks.router)



@app.get("/health")
def health():
    try:
        return {"status": "ok", "service": "PayBack AI"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "error", "detail": str(e)}
