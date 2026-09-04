import axios from 'axios'
// In production on Vercel, VITE_API_URL points to the Railway backend URL
// In local dev, falls back to '/api' which Vite proxies to http://localhost:8000
const rawBaseURL = import.meta.env.VITE_API_URL || '/api'
const baseURL = rawBaseURL.endsWith('/') ? rawBaseURL.slice(0, -1) : rawBaseURL

const api = axios.create({ baseURL })

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
