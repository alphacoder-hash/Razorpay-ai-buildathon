import { useEffect, useState } from 'react'
import { getExceptions } from '../api'
import AuditModal from './AuditModal'
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Bot } from 'lucide-react'

const CAUSE_COLOR = {
  BANK_DECLINE:        { color: '#F05454', bg: '#FEF2F2' },
  NETWORK_TIMEOUT:     { color: '#2563EB', bg: '#EFF6FF' },
  INSUFFICIENT_FUNDS:  { color: '#F4A100', bg: '#FFFBEB' },
  CARD_EXPIRED:        { color: '#8B5CF6', bg: '#F5F3FF' },
  FRAUD_FLAG:          { color: '#DC2626', bg: '#FEF2F2' },
  CHECKOUT_ABANDONED:  { color: '#0891B2', bg: '#ECFEFF' },
  SUBSCRIPTION_FAILED: { color: '#BE185D', bg: '#FDF2F8' },
  OVERDUE_INVOICE:     { color: '#0D9488', bg: '#F0FDFA' },
  UNKNOWN:             { color: '#9CA3AF', bg: '#F3F4F6' },
}

const STATUS_META = {
  ESCALATED: { color: '#F4A100', bg: '#FFFBEB', label: 'ESCALATED' },
  FAILED:    { color: '#F05454', bg: '#FEF2F2', label: 'FAILED' },
}

export default function Exceptions() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [selectedPayment, setSelectedPayment] = useState(null)

  const fetchExceptions = () => {
    setLoading(true)
    getExceptions()
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchExceptions() }, [])

  const toggleGroup = (cause) => setExpanded(e => ({ ...e, [cause]: !e[cause] }))

  if (loading) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <div style={{ textAlign: 'center', padding: 80, color: '#9CA3AF' }}>Loading exception list...</div>
      </div>
    )
  }

  const causeGroups = data?.by_cause || []

  return (
    <div style={{ padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0 }}>Exception List</h1>
            {data && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '3px 10px', borderRadius: 20 }}>
                {data.total_exceptions} UNRESOLVED
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
            Payments the agent could NOT resolve — honest exception list grouped by root cause
          </p>
        </div>
        <button onClick={fetchExceptions} style={btnSecondary}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Summary bar */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          <SummaryCard
            label="Total Exceptions"
            value={data.total_exceptions}
            color="#DC2626"
            bg="#FEF2F2"
            icon={<AlertTriangle size={16} />}
          />
          <SummaryCard
            label="Value at Risk"
            value={`₹${(data.total_value_at_risk / 1000).toFixed(1)}K`}
            sub={`₹${data.total_value_at_risk.toLocaleString('en-IN')}`}
            color="#D97706"
            bg="#FFFBEB"
          />
          <SummaryCard
            label="Root Cause Categories"
            value={causeGroups.length}
            sub="distinct failure types"
            color="#6B7280"
            bg="#F3F4F6"
          />
        </div>
      )}

      {/* Empty state */}
      {causeGroups.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>No exceptions!</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>All payments were resolved by the agent.</div>
        </div>
      )}

      {/* Groups */}
      {causeGroups.map(group => {
        const meta = CAUSE_COLOR[group.root_cause] || CAUSE_COLOR.UNKNOWN
        const isOpen = expanded[group.root_cause]
        return (
          <div key={group.root_cause} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group.root_cause)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: isOpen ? '1px solid #E2E8F0' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {isOpen ? <ChevronDown size={16} color="#6B7280" /> : <ChevronRight size={16} color="#6B7280" />}
                <span style={{ fontSize: 13, fontWeight: 700, color: meta.color, background: meta.bg, padding: '4px 12px', borderRadius: 6 }}>
                  {group.root_cause.replace(/_/g, ' ')}
                </span>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{group.count} payments</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', fontFamily: "'DM Mono', monospace" }}>
                  ₹{group.total_value.toLocaleString('en-IN')} at risk
                </span>
              </div>
            </button>

            {/* Payment rows */}
            {isOpen && (
              <div>
                {group.payments.map(p => {
                  const statusMeta = STATUS_META[p.status] || STATUS_META.FAILED
                  return (
                    <div key={p.id} style={{ padding: '14px 20px 14px 48px', borderBottom: '1px solid #F9FAFB', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr auto', gap: 16, alignItems: 'start' }}>
                      {/* Payment ID + email */}
                      <div>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6B7280', marginBottom: 2 }}>{p.id}</div>
                        <div style={{ fontSize: 12, color: '#4B5563' }}>{p.customer_email}</div>
                      </div>

                      {/* Amount */}
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', fontFamily: "'DM Mono', monospace" }}>
                        ₹{p.amount.toLocaleString('en-IN')}
                      </div>

                      {/* Status */}
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: statusMeta.color, background: statusMeta.bg, padding: '2px 8px', borderRadius: 4 }}>
                          {p.status}
                        </span>
                      </div>

                      {/* Retries */}
                      <div style={{ fontSize: 12, color: '#6B7280' }}>
                        {p.retry_count} retries
                        {p.recovery_action && (
                          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{p.recovery_action.replace(/_/g, ' ')}</div>
                        )}
                      </div>

                      {/* AI Reasoning */}
                      <div>
                        {p.gemini_reasoning && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: '#4B5563', background: '#F8FAFF', border: '1px solid #E0E7FF', borderRadius: 6, padding: '6px 10px', lineHeight: 1.5 }}>
                            <Bot size={11} style={{ color: '#6366F1', flexShrink: 0, marginTop: 1 }} />
                            {p.gemini_reasoning}
                          </div>
                        )}
                      </div>

                      {/* Audit button */}
                      <div>
                        <button
                          onClick={() => setSelectedPayment(p.id)}
                          style={{ fontSize: 12, fontWeight: 500, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          Audit
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {selectedPayment && <AuditModal paymentId={selectedPayment} onClose={() => setSelectedPayment(null)} />}
    </div>
  )
}

function SummaryCard({ label, value, sub, color, bg, icon }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {icon && <span style={{ color, background: bg, padding: 6, borderRadius: 8, display: 'flex' }}>{icon}</span>}
        <span style={{ fontSize: 11, fontWeight: 500, color: '#6B7280' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const btnSecondary = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '8px 13px', borderRadius: 8,
  border: '1px solid #E2E8F0', background: '#fff',
  color: '#64748B', fontSize: 12, fontWeight: 500,
  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
}
