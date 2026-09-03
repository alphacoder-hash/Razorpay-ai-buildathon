# Track 03 — AI Revenue Recovery Agent
## Project: PayBack AI — Autonomous Revenue Recovery System

---

## What We're Building

A fully autonomous agent that:
1. **Detects** failed payments, abandoned checkouts, and overdue invoices
2. **Diagnoses** root cause (bank decline / network timeout / fraud flag / insufficient funds)
3. **Executes** a bounded recovery workflow (retry / alternate payment method / reminder)
4. **Measures** money recovered across a batch
5. **Audits** every action with a full trail + graceful failure handling

---

## Why This Stands Out

- Most participants will build a chatbot or a dashboard. We build an **autonomous loop**.
- We show **measured money recovered** — a concrete metric judges can verify.
- Every action is **explainable, bounded, and gated** — exactly what the bar asks for.
- We handle **failure gracefully** with stopping rules and escalation.
- Uses Razorpay test-mode APIs end-to-end — not mocked data.

---

## Project Structure

```
PayBack_AI/
├── agent/
│   ├── detector.py          # Polls Razorpay API for failed/at-risk payments
│   ├── classifier.py        # LLM-powered root cause classification
│   ├── recovery.py          # Executes recovery actions (retry, notify, escalate)
│   ├── audit.py             # Immutable audit trail logger
│   └── orchestrator.py      # Main agent loop — ties everything together
├── data/
│   ├── synthetic_batch.py   # Generates 50+ synthetic failed payment records
│   └── sample_batch.json    # Pre-generated batch for demo
├── dashboard/
│   └── app.py               # Streamlit dashboard — metrics + audit trail
├── tests/
│   └── test_agent.py        # Unit tests for each component
├── config.py                # API keys, thresholds, stopping rules
├── requirements.txt
└── README.md
```

---

## Recovery Workflow (The Agent Loop)

```
[Detect Failed Payments]
        ↓
[Classify Root Cause]
  - BANK_DECLINE → retry with same method after 2h
  - NETWORK_TIMEOUT → immediate retry
  - INSUFFICIENT_FUNDS → send payment link + reminder
  - FRAUD_FLAG → escalate to human, do NOT retry
  - CARD_EXPIRED → request updated payment method
        ↓
[Execute Recovery Action]
  - Bounded: max 3 retries per payment
  - Stopping rule: stop if 2 consecutive failures
  - Compliant: no action on fraud-flagged payments
        ↓
[Measure & Report]
  - Recovery rate (%)
  - Money recovered (₹)
  - Audit trail per payment
  - Exception list (unresolved)
```

---

## Key Metrics We'll Show

| Metric | Description |
|--------|-------------|
| Recovery Rate | % of failed payments successfully recovered |
| Money Recovered | Total ₹ recovered in the batch run |
| False Escalation Rate | % of cases wrongly escalated |
| Avg Recovery Time | Time from detection to recovery |
| Exception List | Payments agent could NOT resolve (honest) |

---

## Razorpay APIs Used

- `GET /v1/payments` — fetch payment list with status filters
- `POST /v1/payments/{id}/capture` — capture authorized payments
- `POST /v1/payments/{id}/refund` — issue refunds where needed
- `POST /v1/payment_links` — create new payment links for recovery
- `GET /v1/orders` — fetch order status
- `POST /v1/invoices` — create/send invoice reminders

---

## What You Need to Provide

- [ ] Razorpay Test Key ID (`rzp_test_XXXX`)
- [ ] Razorpay Test Key Secret
- [ ] LLM API Key (OpenAI or Gemini)
- [ ] Confirm: Python + Streamlit UI

---

## Judging Criteria Mapping

| Judge Looks For | How We Address It |
|----------------|-------------------|
| Problem taste | Payment recovery = real ₹ lost daily by every Razorpay merchant |
| Build quality | Structured agent loop, typed code, tests included |
| AI judgment | LLM used ONLY for root cause reasoning, not for everything |
| Failure recovery | Stopping rules, fraud escalation, audit trail of failures |
| Measured money recovered | Batch metrics dashboard with honest exception list |
