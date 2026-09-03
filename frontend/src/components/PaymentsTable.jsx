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
  BANK_DECLINE:       '#F05454',
  NETWORK_TIMEOUT:    '#2563EB',
  INSUFFICIENT_FUNDS: '#F4A100',
  CARD_EXPIRED:       '#8B5CF6',
  FRAUD_FLAG:         '#DC2626',
  UNKNOWN:            '#9CA3AF',
}

const FILTERS = ['ALL', 'FAILED', 'RECOVERED', 'ESCALATED', 'PENDING']

export default function PaymentsTable() {
  const [payments, setPayments] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [recovering, setRecovering] = useState(null)

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

  const filtered = payments.filter(p =>
    p.customer_email.toLowerCase().includes(search.toLowerCase()) ||
    p.id.includes(search)
  )

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>Payments</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>All payments processed by the recovery agent</p>
      </div>

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
                    <span style={{ fontSize: 11, fontWeight: 600, color: CAUSE_COLOR[p.root_cause] || '#9CA3AF' }}>
                      {p.root_cause.replace(/_/g, ' ')}
                    </span>
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
