# PayBack AI — Autonomous Revenue Recovery Agent
## Razorpay Buildathon 2025 | Track 03

---

## Stack
- **Backend**: FastAPI + SQLAlchemy + SQLite + Redis
- **Frontend**: React + Vite + Tailwind CSS + Recharts
- **LLM**: Google Gemini 1.5 Flash (root cause classification)
- **Payments**: Razorpay Test Mode APIs

---

## Setup

### 1. Add your API keys
Edit `backend/.env`:
```
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
GEMINI_API_KEY=your_gemini_api_key
```

### 2. Start Redis (required for agent state)
```bash
# Windows (via WSL or Docker)
docker run -d -p 6379:6379 redis
```

### 3. Start Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### 4. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## How It Works

1. Click **Run Recovery Batch** — agent generates 60 synthetic failed payments
2. For each payment, Gemini classifies the root cause (BANK_DECLINE, NETWORK_TIMEOUT, etc.)
3. Agent executes the right recovery action (retry / payment link / escalate)
4. Dashboard shows recovery rate, ₹ recovered, and full audit trail
5. Every action is logged — click **Audit** on any payment to see the full trail

---

## Agent Logic

```
Detect Failed Payment
      ↓
Classify Root Cause (Gemini)
      ↓
Execute Recovery Action
  NETWORK_TIMEOUT   → Immediate Retry
  BANK_DECLINE      → Delayed Retry
  INSUFFICIENT_FUNDS → Send Payment Link
  CARD_EXPIRED      → Request New Method
  FRAUD_FLAG        → Escalate (NO auto-retry)
      ↓
Stopping Rules:
  - Max 3 retries per payment
  - 2 consecutive failures → pause + log
  - Fraud flag → blocked by policy
      ↓
Measure & Audit
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/agent/run-batch?count=60` | Run full recovery batch |
| GET | `/agent/runs` | List all batch runs |
| GET | `/payments/` | List payments (filter by status) |
| POST | `/payments/{id}/recover` | Recover single payment |
| GET | `/audit/{payment_id}` | Get audit trail for payment |
| GET | `/audit/` | Get all agent logs |
