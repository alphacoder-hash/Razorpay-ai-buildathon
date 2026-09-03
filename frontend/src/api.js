import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const runBatch = (count = 60) => api.post(`/agent/run-batch?count=${count}`)
export const getBatchRuns = () => api.get('/agent/runs')
export const getPayments = (status) => api.get('/payments/', { params: status ? { status } : {} })
export const recoverPayment = (id) => api.post(`/payments/${id}/recover`)
export const getAuditTrail = (paymentId) => api.get(`/audit/${paymentId}`)
export const getAllLogs = () => api.get('/audit/')

export default api
