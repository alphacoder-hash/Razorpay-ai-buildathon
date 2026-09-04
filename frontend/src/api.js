import axios from 'axios'
const PROD_BACKEND_URL = 'https://razorpay-ai-buildathon-production-788d.up.railway.app'

// In local dev, Vite proxies /api to http://localhost:8000
// In production (Vercel), default to the live Railway backend if VITE_API_URL is not set or points to old URL
let rawBaseURL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : PROD_BACKEND_URL)
if (rawBaseURL.includes('razorpay-ai-buildathon-production.up.railway.app')) {
  rawBaseURL = PROD_BACKEND_URL
}
const baseURL = rawBaseURL.endsWith('/') ? rawBaseURL.slice(0, -1) : rawBaseURL

const api = axios.create({ baseURL })

export const TEST_CHECKOUT_URL = `${baseURL}/test-checkout`

export const runBatch        = (count = 60) => api.post(`/agent/run-batch?count=${count}`)
export const getBatchRuns    = ()           => api.get('/agent/runs')
export const getPayments     = (status)    => api.get('/payments/', { params: status ? { status } : {} })
export const recoverPayment  = (id)        => api.post(`/payments/${id}/recover`)
export const getAuditTrail   = (paymentId) => api.get(`/audit/${paymentId}`)
export const getAllLogs       = ()          => api.get('/audit/')
export const getExceptions   = ()          => api.get('/payments/exceptions')
export const getDetectorData = (hoursBack = 24) => api.get(`/payments/detect?hours_back=${hoursBack}`)
export const syncPaymentLinks = ()          => api.post('/payments/sync-links')
export const ingestLivePayment = (data)     => api.post('/payments/ingest-live', data)
export const getPaymentDetails = (id)       => api.get(`/payments/${id}`)
export const setPromiseToPay   = (id, date) => api.post(`/payments/${id}/promise`, { promise_date: date })
export const triggerVoiceRecovery = (id)    => api.post(`/payments/${id}/voice-recovery`)
export const runDunning        = ()         => api.post('/agent/run-dunning')
export const analyzeCustomerReply = (id, reply) => api.post(`/payments/${id}/analyze-reply`, { reply })

export default api
