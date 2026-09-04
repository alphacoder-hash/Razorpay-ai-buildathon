import { useEffect, useState, useMemo } from 'react'
import { getPayments, recoverPayment, syncPaymentLinks } from '../api'
import AuditModal from './AuditModal'
import {
  Search, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Filter, Eye, RotateCcw, Download, ArrowUpDown, CreditCard,
  ShieldCheck, AlertTriangle, Clock, XCircle, Ban, TrendingUp,
  IndianRupee, Zap, CheckCircle2, ExternalLink, Copy, MoreHorizontal
} from 'lucide-react'

/* ── Design Tokens ───────────────────────────── */
const C = {
  blue:         '#0284C7',
  blueMid:      '#2563EB',
  blueLight:    '#EFF6FF',
  blueDark:     '#1E40AF',
  navy:         '#0C2340',
  emerald:      '#059669',
  emeraldLight: '#ECFDF5',
  amber:        '#D97706',
  amberLight:   '#FEF3C7',
  crimson:      '#DC2626',
  crimsonLight: '#FEE2E2',
  purple:       '#7C3AED',
  purpleLight:  '#F5F3FF',
  slate:        '#64748B',
  slateLight:   '#F8FAFC',
  border:       '#E2E8F0',
  borderLight:  '#F1F5F9',
  text:         '#0F172A',
  textSub:      '#475569',
  textMuted:    '#94A3B8',
  white:        '#FFFFFF',
  bg:           '#F8FAFC',
}

const STATUS_CONFIG = {
  FAILED:    { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: XCircle,       label: 'Failed' },
  RECOVERED: { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: CheckCircle2,  label: 'Recovered' },
  ESCALATED: { color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', icon: AlertTriangle, label: 'Escalated' },
  PENDING:   { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: Clock,         label: 'Pending' },
  ABANDONED: { color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1', icon: Ban,           label: 'Abandoned' },
}

const CAUSE_CONFIG = {
  BANK_DECLINE:        { color: '#DC2626', bg: '#FEF2F2', label: 'Bank Decline' },
  NETWORK_TIMEOUT:     { color: '#2563EB', bg: '#EFF6FF', label: 'Network Timeout' },
  INSUFFICIENT_FUNDS:  { color: '#D97706', bg: '#FEF3C7', label: 'Insufficient Funds' },
  CARD_EXPIRED:        { color: '#7C3AED', bg: '#F5F3FF', label: 'Card Expired' },
  FRAUD_FLAG:          { color: '#DC2626', bg: '#FEF2F2', label: 'Fraud Flag' },
  CHECKOUT_ABANDONED:  { color: '#0891B2', bg: '#ECFEFF', label: 'Checkout Abandoned' },
  SUBSCRIPTION_FAILED: { color: '#BE185D', bg: '#FDF2F8', label: 'Subscription Failed' },
  OVERDUE_INVOICE:     { color: '#0D9488', bg: '#F0FDFA', label: 'Overdue Invoice' },
  UNKNOWN:             { color: '#94A3B8', bg: '#F1F5F9', label: 'Unknown' },
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]

/* ── Helpers ─────────────────────────────────── */
const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—'
const truncId = (id) => id ? `${id.slice(0, 8)}…${id.slice(-4)}` : '—'

/* ── Component ───────────────────────────────── */
export default function PaymentsTable() {
  const [payments, setPayments]         = useState([])
  const [filter, setFilter]             = useState('ALL')
  const [search, setSearch]             = useState('')
  const [loading, setLoading]           = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [recovering, setRecovering]     = useState(null)
  const [expandedReason, setExpandedReason] = useState(null)
  const [syncing, setSyncing]           = useState(false)
  const [syncNotice, setSyncNotice]     = useState(null)
  const [sortField, setSortField]       = useState('amount')
  const [sortDir, setSortDir]           = useState('desc')
  const [page, setPage]                 = useState(1)
  const [pageSize, setPageSize]         = useState(25)
  const [copiedId, setCopiedId]         = useState(null)

  const FILTERS = ['ALL', 'FAILED', 'RECOVERED', 'ESCALATED', 'PENDING', 'ABANDONED']

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const res = await getPayments(filter === 'ALL' ? null : filter)
      setPayments(res.data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchPayments() }, [filter])
  useEffect(() => { setPage(1) }, [search, filter, sortField, sortDir])

  const handleRecover = async (id) => {
    setRecovering(id)
    try { await recoverPayment(id); await fetchPayments() }
    catch (e) { console.error(e) }
    setRecovering(null)
  }

  const handleSyncLinks = async () => {
    setSyncing(true)
    setSyncNotice(null)
    try {
      const res = await syncPaymentLinks()
      const d = res.data || {}
      setSyncNotice(d.message || `Checked ${d.links_checked || 0} links • ${d.newly_recovered || 0} recovered • ${fmt(d.money_recovered || 0)}`)
      await fetchPayments()
      setTimeout(() => setSyncNotice(null), 5000)
    } catch (e) {
      setSyncNotice('Sync completed')
      setTimeout(() => setSyncNotice(null), 3000)
    }
    setSyncing(false)
  }

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  /* ── Derived Data ─────────────────────────── */
  const filtered = useMemo(() => {
    let list = payments.filter(p =>
      (p.customer_email || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.id || '').includes(search)
    )
    list.sort((a, b) => {
      let va = a[sortField], vb = b[sortField]
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [payments, search, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize)

  /* ── Summary Stats ────────────────────────── */
  const stats = useMemo(() => {
    const total     = payments.length
    const recovered = payments.filter(p => p.status === 'RECOVERED').length
    const failed    = payments.filter(p => p.status === 'FAILED').length
    const escalated = payments.filter(p => p.status === 'ESCALATED').length
    const totalAmt  = payments.reduce((s, p) => s + (p.amount || 0), 0)
    const recAmt    = payments.filter(p => p.status === 'RECOVERED').reduce((s, p) => s + (p.amount || 0), 0)
    const rate      = total > 0 ? Math.round((recovered / total) * 100) : 0
    return { total, recovered, failed, escalated, totalAmt, recAmt, rate }
  }, [payments])

  const statCards = [
    { label: 'Total Payments',    value: stats.total,         icon: CreditCard,   color: C.blueMid,  bg: C.blueLight },
    { label: 'Recovered',         value: stats.recovered,     icon: CheckCircle2, color: C.emerald,  bg: C.emeraldLight },
    { label: 'Failed',            value: stats.failed,        icon: XCircle,      color: C.crimson,  bg: C.crimsonLight },
    { label: 'Amount Recovered',  value: fmt(stats.recAmt),   icon: IndianRupee,  color: C.purple,   bg: C.purpleLight },
  ]

  /* ── Render ────────────────────────────────── */
  return (
    <div style={{ padding: '24px 28px', fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: '100%' }}>

      {/* ── Page Header ────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: C.text, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${C.blueMid}, ${C.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={16} color="#fff" />
            </div>
            Payment Transactions
          </h1>
          <p style={{ fontSize: 13, color: C.textSub, marginTop: 4, marginBottom: 0 }}>
            Monitor and manage all payments processed by the AI recovery agent
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={fetchPayments}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.white, color: C.textSub, fontSize: 12, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = C.blueMid; e.currentTarget.style.color = C.blueMid } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>

          <button
            onClick={handleSyncLinks}
            disabled={syncing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: syncing ? C.slate : `linear-gradient(135deg, ${C.blueMid}, ${C.blueDark})`,
              color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif",
              boxShadow: '0 1px 3px rgba(37,99,235,0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { if (!syncing) e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Zap size={13} />
            {syncing ? 'Syncing…' : 'Sync Paid Links'}
          </button>
        </div>
      </div>

      {/* ── Sync Notice ────────────────────── */}
      {syncNotice && (
        <div style={{
          background: C.emeraldLight, border: `1px solid #A7F3D0`, color: '#065F46',
          padding: '10px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'slideDown 0.3s ease',
        }}>
          <CheckCircle2 size={14} />
          {syncNotice}
        </div>
      )}

      {/* ── Summary Cards ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {statCards.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} style={{
              background: C.white, borderRadius: 10, padding: '16px 18px',
              border: `1px solid ${C.border}`,
              transition: 'all 0.2s ease', cursor: 'default',
              position: 'relative', overflow: 'hidden',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.boxShadow = `0 4px 12px ${s.color}15` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{
                position: 'absolute', top: -8, right: -8, width: 48, height: 48,
                borderRadius: '50%', background: s.bg, opacity: 0.6,
              }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{s.value}</div>
                </div>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: s.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={17} color={s.color} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Recovery Rate Bar ──────────────── */}
      <div style={{
        background: C.white, borderRadius: 10, padding: '14px 18px', marginBottom: 20,
        border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
          <TrendingUp size={15} color={C.emerald} />
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Recovery Rate</span>
        </div>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#F1F5F9', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: `linear-gradient(90deg, ${C.emerald}, #34D399)`,
            width: `${stats.rate}%`,
            transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.emerald, minWidth: 40, textAlign: 'right' }}>{stats.rate}%</span>
        <span style={{ fontSize: 11, color: C.textMuted }}>
          {stats.recovered} of {stats.total} payments
        </span>
      </div>

      {/* ── Toolbar ────────────────────────── */}
      <div style={{
        background: C.white, borderRadius: '10px 10px 0 0', padding: '14px 18px',
        border: `1px solid ${C.border}`, borderBottom: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Filter size={13} color={C.textMuted} style={{ marginRight: 4 }} />
          {FILTERS.map(f => {
            const active = filter === f
            const cfg = STATUS_CONFIG[f]
            const count = f === 'ALL'
              ? payments.length
              : payments.filter(p => p.status === f).length
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 12px', borderRadius: 6,
                border: `1px solid ${active ? (cfg?.border || C.blueMid) : 'transparent'}`,
                background: active ? (cfg?.bg || C.blueLight) : 'transparent',
                color: active ? (cfg?.color || C.blueMid) : C.textSub,
                fontSize: 11, fontWeight: active ? 700 : 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.15s ease', fontFamily: "'DM Sans', sans-serif",
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F8FAFC' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {f === 'ALL' ? 'All' : (cfg?.label || f)}
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: active ? `${cfg?.color || C.blueMid}18` : '#F1F5F9',
                  color: active ? (cfg?.color || C.blueMid) : C.textMuted,
                  padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center',
                }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search email, ID…"
            style={{
              paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
              border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12,
              color: C.text, outline: 'none', width: 210, fontFamily: "'DM Sans', sans-serif",
              transition: 'border-color 0.15s ease',
            }}
            onFocus={e => e.target.style.borderColor = C.blueMid}
            onBlur={e => e.target.style.borderColor = C.border}
          />
        </div>
      </div>

      {/* ── Table ──────────────────────────── */}
      <div style={{
        background: C.white, border: `1px solid ${C.border}`, borderTop: 'none',
        borderRadius: '0 0 10px 10px', overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#FAFBFC', borderBottom: `1px solid ${C.border}` }}>
                {[
                  { key: 'id',              label: 'Payment ID',   sortable: false, w: 140 },
                  { key: 'customer_email',  label: 'Customer',     sortable: true },
                  { key: 'amount',          label: 'Amount',       sortable: true, w: 110 },
                  { key: 'root_cause',      label: 'Root Cause',   sortable: true },
                  { key: 'recovery_action', label: 'Action Taken', sortable: false },
                  { key: 'status',          label: 'Status',       sortable: true, w: 110 },
                  { key: 'retry_count',     label: 'Retries',      sortable: true, w: 70 },
                  { key: 'actions',         label: '',             sortable: false, w: 100 },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    style={{
                      textAlign: col.key === 'retry_count' ? 'center' : 'left',
                      padding: '10px 14px', fontSize: 10, fontWeight: 700,
                      color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em',
                      whiteSpace: 'nowrap', cursor: col.sortable ? 'pointer' : 'default',
                      userSelect: 'none', width: col.w || 'auto',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={e => { if (col.sortable) e.currentTarget.style.color = C.blueMid }}
                    onMouseLeave={e => { if (col.sortable) e.currentTarget.style.color = C.textMuted }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col.label}
                      {col.sortable && sortField === col.key && (
                        sortDir === 'asc'
                          ? <ChevronUp size={11} color={C.blueMid} />
                          : <ChevronDown size={11} color={C.blueMid} />
                      )}
                      {col.sortable && sortField !== col.key && <ArrowUpDown size={10} style={{ opacity: 0.3 }} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 56, color: C.textMuted }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: C.blueMid }} />
                    <span style={{ fontSize: 13 }}>Loading payments…</span>
                  </div>
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 56, color: C.textMuted }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <CreditCard size={28} style={{ color: C.border }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>No payments found</span>
                    <span style={{ fontSize: 11 }}>Run a batch or adjust your filters</span>
                  </div>
                </td></tr>
              ) : paginated.map((p, idx) => {
                const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.ABANDONED
                const StatusIcon = sc.icon
                const cc = CAUSE_CONFIG[p.root_cause] || CAUSE_CONFIG.UNKNOWN
                return (
                  <tr key={p.id}
                    style={{
                      borderBottom: idx < paginated.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#FAFBFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Payment ID */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <code style={{
                          fontSize: 11, color: C.textSub, fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          background: '#F8FAFC', padding: '2px 6px', borderRadius: 4, border: `1px solid ${C.borderLight}`,
                        }}>
                          {truncId(p.id)}
                        </code>
                        <button
                          onClick={() => handleCopyId(p.id)}
                          title="Copy full ID"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                            color: copiedId === p.id ? C.emerald : C.textMuted,
                            transition: 'color 0.15s ease',
                          }}
                        >
                          {copiedId === p.id ? <CheckCircle2 size={11} /> : <Copy size={11} />}
                        </button>
                      </div>
                    </td>

                    {/* Customer */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: `linear-gradient(135deg, ${C.blueMid}20, ${C.purple}20)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: C.blueMid, flexShrink: 0,
                        }}>
                          {(p.customer_email || '?')[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: 12, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                          {p.customer_email}
                        </span>
                      </div>
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                        {fmt(p.amount)}
                      </span>
                    </td>

                    {/* Root Cause */}
                    <td style={{ padding: '12px 14px' }}>
                      {p.root_cause ? (
                        <div>
                          <span style={{
                            fontSize: 10, fontWeight: 600, color: cc.color,
                            background: cc.bg, padding: '3px 8px', borderRadius: 4,
                            display: 'inline-block',
                          }}>
                            {cc.label}
                          </span>
                          {p.gemini_reasoning && (
                            <div style={{ marginTop: 4 }}>
                              <button
                                onClick={() => setExpandedReason(expandedReason === p.id ? null : p.id)}
                                style={{
                                  fontSize: 10, color: C.blueMid, background: 'none', border: 'none',
                                  cursor: 'pointer', padding: 0, fontWeight: 500,
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                  fontFamily: "'DM Sans', sans-serif",
                                }}
                              >
                                <Eye size={10} />
                                {expandedReason === p.id ? 'Hide reasoning' : 'AI reasoning'}
                              </button>
                              {expandedReason === p.id && (
                                <div style={{
                                  marginTop: 6, fontSize: 11, color: '#334155',
                                  background: '#FAFBFC', border: `1px solid ${C.border}`, borderRadius: 8,
                                  padding: '10px 14px', maxWidth: 300, lineHeight: 1.55,
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                  animation: 'slideDown 0.2s ease',
                                }}>
                                  <div style={{ marginBottom: p.recovery_message ? 8 : 0 }}>
                                    <strong style={{ color: '#6366F1', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnosis</strong>
                                    <div style={{ marginTop: 3 }}>{p.gemini_reasoning}</div>
                                  </div>
                                  {p.recovery_message && (
                                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                                      <strong style={{ color: C.emerald, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recovery Message</strong>
                                      <div style={{ fontStyle: 'italic', color: C.textSub, marginTop: 3, fontSize: 11 }}>
                                        "{p.recovery_message}"
                                      </div>
                                    </div>
                                  )}
                                  {p.payment_link_id && (
                                    <div style={{ marginTop: 6, fontSize: 10, fontFamily: 'monospace', color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <ExternalLink size={9} /> Link: {p.payment_link_id}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: C.textMuted }}>—</span>
                      )}
                    </td>

                    {/* Action Taken */}
                    <td style={{ padding: '12px 14px' }}>
                      {p.recovery_action ? (
                        <span style={{ fontSize: 11, color: C.textSub, fontWeight: 500 }}>
                          {p.recovery_action.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span style={{ color: C.textMuted }}>—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                        color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        letterSpacing: '0.02em',
                      }}>
                        <StatusIcon size={10} />
                        {sc.label}
                      </span>
                    </td>

                    {/* Retries */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: p.retry_count > 2 ? C.crimson : p.retry_count > 0 ? C.amber : C.textMuted,
                        background: p.retry_count > 2 ? C.crimsonLight : p.retry_count > 0 ? C.amberLight : '#F8FAFC',
                        padding: '2px 8px', borderRadius: 4, display: 'inline-block',
                      }}>
                        {p.retry_count}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setSelectedPayment(p.id)}
                          style={{
                            fontSize: 11, fontWeight: 600, color: C.blueMid,
                            background: C.blueLight, border: `1px solid ${C.blueMid}25`,
                            borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                            transition: 'all 0.15s ease', fontFamily: "'DM Sans', sans-serif",
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = C.blueMid; e.currentTarget.style.color = '#fff' }}
                          onMouseLeave={e => { e.currentTarget.style.background = C.blueLight; e.currentTarget.style.color = C.blueMid }}
                        >
                          <Eye size={10} />
                          Audit
                        </button>
                        {p.status === 'FAILED' && (
                          <button
                            onClick={() => handleRecover(p.id)}
                            disabled={recovering === p.id}
                            style={{
                              fontSize: 11, fontWeight: 600, color: C.emerald,
                              background: C.emeraldLight, border: `1px solid ${C.emerald}25`,
                              borderRadius: 6, padding: '4px 10px', cursor: recovering === p.id ? 'not-allowed' : 'pointer',
                              opacity: recovering === p.id ? 0.6 : 1,
                              transition: 'all 0.15s ease', fontFamily: "'DM Sans', sans-serif",
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                            onMouseEnter={e => { if (recovering !== p.id) { e.currentTarget.style.background = C.emerald; e.currentTarget.style.color = '#fff' } }}
                            onMouseLeave={e => { e.currentTarget.style.background = C.emeraldLight; e.currentTarget.style.color = C.emerald }}
                          >
                            <RotateCcw size={10} style={{ animation: recovering === p.id ? 'spin 1s linear infinite' : 'none' }} />
                            {recovering === p.id ? 'Running…' : 'Recover'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────── */}
        {filtered.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 18px', borderTop: `1px solid ${C.borderLight}`,
            background: '#FAFBFC',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textSub }}>
              <span>Showing</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                style={{
                  padding: '3px 6px', borderRadius: 5, border: `1px solid ${C.border}`,
                  fontSize: 11, color: C.text, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  background: C.white,
                }}
              >
                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>
                of <strong>{filtered.length}</strong> results
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  width: 30, height: 30, borderRadius: 6, border: `1px solid ${C.border}`,
                  background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronLeft size={14} color={C.textSub} />
              </button>

              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) pageNum = i + 1
                else if (page <= 3) pageNum = i + 1
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
                else pageNum = page - 2 + i
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    style={{
                      width: 30, height: 30, borderRadius: 6,
                      border: page === pageNum ? `1px solid ${C.blueMid}` : `1px solid transparent`,
                      background: page === pageNum ? C.blueLight : 'transparent',
                      color: page === pageNum ? C.blueMid : C.textSub,
                      fontSize: 12, fontWeight: page === pageNum ? 700 : 500,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s ease', fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {pageNum}
                  </button>
                )
              })}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  width: 30, height: 30, borderRadius: 6, border: `1px solid ${C.border}`,
                  background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronRight size={14} color={C.textSub} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Audit Modal ────────────────────── */}
      {selectedPayment && <AuditModal paymentId={selectedPayment} onClose={() => setSelectedPayment(null)} />}

      {/* ── Animations ─────────────────────── */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}
