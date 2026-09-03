import { useEffect, useState } from 'react'
import { getPayments, recoverPayment } from '../api'
import AuditModal from './AuditModal'
import { Search } from 'lucide-react'

const STATUS = {
  FAILED:    { color: '#F05454', bg: '#FEF2F2' },
  RECOVERED: { color: '#00BA88', bg: '#ECFDF5' },
  ESCALATED: { color: '#F4A100', bg: '#FFFBEB' },
  PENDING:   { color: '#2563EB', bg: '#EFF6FF' },
  ABANDONED: { color: '#6B7280', bg: '#F3F4F6' },
}

const CAUSE_COLOR = {
  BANK_DECLINE:        '#F05454',
  NETWORK_TIMEOUT:     '#2563EB',
  INSUFFICIENT_FUNDS:  '#F4A100',
  CARD_EXPIRED:        '#8B5CF6',
  FRAUD_FLAG:          '#DC2626',
  CHECKOUT_ABANDONED:  '#0891B2',
  SUBSCRIPTION_FAILED: '#BE185D',
  OVERDUE_INVOICE:     '#0D9488',
  UNKNOWN:             '#9CA3AF',
}

export default function PaymentsTable() {
  const [payments, setPayments] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [recovering, setRecovering] = useState(null)
  const [expandedReason, setExpandedReason] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncNotice, setSyncNotice] = useState(null)

  const FILTERS = ['ALL', 'FAILED', 'RECOVERED', 'ESCALATED', 'PENDING']

  const fetchPayments = async () => {
    setLoading(true)
    try { const res = await getPayments(filter === 'ALL' ? null : filter); setPayments(res.data) }
    catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchPayments() }, [filter])

  const handleRecover = async (id) => {
    setRecovering(id)
    try { await recoverPayment(id); await fetchPayments() }
    catch (e) { console.error(e) }
    setRecovering(null)
  }

  const handleSyncLinks = async () => {
    setSyncing(true)
    try {
      const res = await syncPaymentLinks()
      setSyncNotice(`Checked ${res.data.links_checked} links: ${res.data.newly_recovered} newly recovered (₹${res.data.money_recovered})`)
      await fetchPayments()
      setTimeout(() => setSyncNotice(null), 5000)
    } catch (e) {
      console.error(e)
    }
    setSyncing(false)
  }

  const filtered = payments.filter(p =>
    p.customer_email.toLowerCase().includes(search.toLowerCase()) ||
    p.id.includes(search)
  )

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>Payments</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>All payments processed by the recovery agent</p>
        </div>
        <button
          onClick={handleSyncLinks}
          disabled={syncing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 7, border: '1px solid #E2E8F0',
            background: '#fff', color: '#2563EB', fontSize: 12, fontWeight: 600,
            cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif",
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <span style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
          {syncing ? 'Syncing...' : 'Sync Paid Links'}
        </button>
      </div>

      {syncNotice && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '8px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16 }}>
          ✓ {syncNotice}
        </div>
      )}


      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid',
              borderColor: filter === f ? '#2563EB' : '#E5E7EB',
              background: filter === f ? '#EFF6FF' : '#fff',
              color: filter === f ? '#2563EB' : '#4B5563',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email or ID..."
            style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, color: '#1A1A2E', outline: 'none', width: 240 }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
              {['Payment ID', 'Customer', 'Amount', 'Root Cause', 'Action Taken', 'Status', 'Retries', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading payments...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No payments found. Run a batch first.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #F9FAFB', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{p.id.slice(0, 18)}…</td>
                <td style={{ padding: '12px 16px', color: '#1A1A2E' }}>{p.customer_email}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1A1A2E' }}>₹{p.amount.toLocaleString('en-IN')}</td>
                <td style={{ padding: '12px 16px' }}>
                  {p.root_cause ? (
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: CAUSE_COLOR[p.root_cause] || '#9CA3AF' }}>
                        {p.root_cause.replace(/_/g, ' ')}
                      </span>
                      {p.gemini_reasoning && (
                        <div style={{ marginTop: 4 }}>
                          <button
                            onClick={() => setExpandedReason(expandedReason === p.id ? null : p.id)}
                            style={{ fontSize: 10, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                          >
                            {expandedReason === p.id ? 'hide' : 'AI reasoning'}
                          </button>
                          {expandedReason === p.id && (
                            <div style={{ marginTop: 6, fontSize: 11, color: '#334155', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 12px', maxWidth: 290, lineHeight: 1.5 }}>
                              <div style={{ marginBottom: p.recovery_message ? 6 : 0 }}>
                                <strong style={{ color: '#6366F1' }}>Diagnosis: </strong>{p.gemini_reasoning}
                              </div>
                              {p.recovery_message && (
                                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 6, marginTop: 6 }}>
                                  <strong style={{ color: '#059669' }}>Customer Copy (Hinglish/EN): </strong>
                                  <span style={{ fontStyle: 'italic', color: '#475569' }}>"{p.recovery_message}"</span>
                                </div>
                              )}
                              {p.payment_link_id && (
                                <div style={{ marginTop: 4, fontSize: 10, fontFamily: 'monospace', color: '#64748B' }}>
                                  Link ID: {p.payment_link_id}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : <span style={{ color: '#D1D5DB' }}>—</span>}

                </td>
                <td style={{ padding: '12px 16px', fontSize: 11, color: '#6B7280' }}>
                  {p.recovery_action ? p.recovery_action.replace(/_/g, ' ') : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    color: STATUS[p.status]?.color || '#6B7280',
                    background: STATUS[p.status]?.bg || '#F3F4F6',
                  }}>
                    {p.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#6B7280', textAlign: 'center' }}>{p.retry_count}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => setSelectedPayment(p.id)}
                      style={{ fontSize: 12, fontWeight: 500, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Audit
                    </button>
                    {p.status === 'FAILED' && (
                      <button onClick={() => handleRecover(p.id)} disabled={recovering === p.id}
                        style={{ fontSize: 12, fontWeight: 500, color: '#00BA88', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: recovering === p.id ? 0.5 : 1 }}>
                        {recovering === p.id ? 'Recovering…' : 'Recover'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedPayment && <AuditModal paymentId={selectedPayment} onClose={() => setSelectedPayment(null)} />}
    </div>
  )
}
