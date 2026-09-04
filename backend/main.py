import os
import logging
from contextlib import asynccontextmanager
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db()
        logger.info("Database initialised successfully")
    except Exception as e:
        logger.error(f"Database initialisation failed: {e}")
        raise
    yield


app = FastAPI(title="PayBack AI — Revenue Recovery Agent", version="1.0.0", lifespan=lifespan)


# Allow origins from environment or default to local dev ports
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    origins = [orig.strip() for orig in allowed_origins_env.split(",") if orig.strip()]
else:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error", "error": str(exc)})



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


@app.get("/test-checkout")
def test_checkout_page():
    from fastapi.responses import HTMLResponse
    from config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
    import razorpay
    
    order_id = ""
    try:
        client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        order = client.order.create({"amount": 299900, "currency": "INR", "receipt": "test_sandbox_rcpt"})
        order_id = order.get("id", "")
    except Exception as e:
        order_id = f"error: {e}"

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PayBack AI — Razorpay Live Test Simulator</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f8fafc; padding: 40px 20px; display: flex; justify-content: center; }}
    .card {{ background: #161e2e; border: 1px solid #283548; border-radius: 16px; padding: 32px; max-width: 540px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }}
    h1 {{ font-size: 22px; margin-bottom: 8px; color: #38bdf8; display: flex; align-items: center; gap: 8px; }}
    p {{ color: #94a3b8; font-size: 14px; line-height: 1.5; margin-bottom: 20px; }}
    .badge {{ background: #0284c7; color: white; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-block; margin-bottom: 16px; }}
    .btn {{ width: 100%; padding: 14px; border: none; border-radius: 8px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.2s; margin-bottom: 12px; display: block; text-align: center; text-decoration: none; }}
    .btn-fail {{ background: #ef4444; color: white; }}
    .btn-fail:hover {{ background: #dc2626; }}
    .btn-link {{ background: #1e293b; border: 1px solid #334155; color: #38bdf8; }}
    .btn-link:hover {{ background: #334155; }}
    .box {{ background: #0f172a; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px; font-family: monospace; color: #cbd5e1; border: 1px solid #1e293b; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">RAZORPAY TEST MODE</div>
    <h1>⚡ Real Test Payment Generator</h1>
    <p>Simulate real payments on your connected Razorpay test account to generate failed or successful transactions that PayBack AI can fetch and recover.</p>
    
    <div class="box">
      <strong>Active Key:</strong> {RAZORPAY_KEY_ID}<br/>
      <strong>Live Order ID:</strong> {order_id}
    </div>

    <button class="btn btn-fail" onclick="openCheckout('fail')">🚨 Trigger Failed Payment (Test Decline)</button>
    <a href="http://localhost:5173" class="btn btn-link">← Go to PayBack AI (Live Detect Tab)</a>

    <div style="font-size: 12px; color: #64748b; margin-top: 16px; line-height: 1.5;">
      💡 <strong>How to trigger a failure in Razorpay Checkout:</strong><br/>
      1. Click the red button above to launch real Razorpay Checkout.<br/>
      2. Choose <strong>Card</strong> and enter test card <code>4000 0000 0000 0002</code> (CVV: 123, Exp: 12/28) to trigger an immediate bank decline.<br/>
      3. Or choose <strong>UPI</strong> and enter <code>failure@razorpay</code>.<br/>
      4. Once it declines, visit <a href="http://localhost:5173" style="color: #38bdf8;">http://localhost:5173</a> &rarr; <strong>Live Detect</strong> to watch PayBack AI fetch and recover it!
    </div>
  </div>

  <script>
    function openCheckout() {{
      var options = {{
        "key": "{RAZORPAY_KEY_ID}",
        "amount": "299900",
        "currency": "INR",
        "name": "Acme Store (PayBack Demo)",
        "description": "Test Order for AI Recovery",
        "order_id": "{order_id}",
        "handler": function (response){{
            alert("Payment completed: " + response.razorpay_payment_id);
        }},
        "prefill": {{
            "name": "Aryan Test",
            "email": "customer@example.com",
            "contact": "9876543210"
        }},
        "notes": {{
            "purpose": "PayBack AI Live Recovery Test"
        }},
        "theme": {{
            "color": "#0284c7"
        }}
      }};
      var rzp1 = new Razorpay(options);
      rzp1.on('payment.failed', function (response){{
          alert("Payment failed as expected!\\n\\nPayment ID: " + response.error.metadata.payment_id + "\\nError: " + response.error.description + "\\n\\nNow check Live Detect in PayBack AI!");
      }});
      rzp1.open();
    }}
  </script>
</body>
</html>
"""
    return HTMLResponse(content=html)

