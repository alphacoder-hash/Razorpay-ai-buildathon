import { useEffect, useState, useMemo } from 'react'
import { getPayments, recoverPayment, syncPaymentLinks } from '../api'
import AuditModal from './AuditModal'
import {
  Search, RefreshCw, ChevronLeft, ChevronRight,
  Filter, Eye, RotateCcw, CreditCard, ArrowUpDown,
  ShieldCheck, AlertTriangle, Clock, XCircle, Ban, TrendingUp,
  IndianRupee, Zap, CheckCircle2, ExternalLink, Copy,
  Brain, MessageSquare, Link2, ChevronDown
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
  indigo:       '#6366F1',
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
  FAILED:    { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: XCircle,       label: 'Failed',    gradient: 'linear-gradient(135deg, #DC2626, #EF4444)' },
  RECOVERED: { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: CheckCircle2,  label: 'Recovered', gradient: 'linear-gradient(135deg, #059669, #34D399)' },
  ESCALATED: { color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', icon: AlertTriangle, label: 'Escalated', gradient: 'linear-gradient(135deg, #D97706, #FBBF24)' },
  PENDING:   { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: Clock,         label: 'Pending',   gradient: 'linear-gradient(135deg, #2563EB, #60A5FA)' },
  ABANDONED: { color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1', icon: Ban,           label: 'Abandoned', gradient: 'linear-gradient(135deg, #64748B, #94A3B8)' },
}

const CAUSE_CONFIG = {
  BANK_DECLINE:        { color: '#DC2626', bg: '#FEF2F2', label: 'Bank Decline',        emoji: '🏦' },
  NETWORK_TIMEOUT:     { color: '#2563EB', bg: '#EFF6FF', label: 'Network Timeout',     emoji: '🌐' },
  INSUFFICIENT_FUNDS:  { color: '#D97706', bg: '#FEF3C7', label: 'Insufficient Funds',  emoji: '💳' },
  CARD_EXPIRED:        { color: '#7C3AED', bg: '#F5F3FF', label: 'Card Expired',        emoji: '📅' },
  FRAUD_FLAG:          { color: '#DC2626', bg: '#FEF2F2', label: 'Fraud Flag',          emoji: '🚨' },
  CHECKOUT_ABANDONED:  { color: '#0891B2', bg: '#ECFEFF', label: 'Checkout Abandoned',  emoji: '🛒' },
  SUBSCRIPTION_FAILED: { color: '#BE185D', bg: '#FDF2F8', label: 'Subscription Failed', emoji: '🔄' },
  OVERDUE_INVOICE:     { color: '#0D9488', bg: '#F0FDFA', label: 'Overdue Invoice',     emoji: '📄' },
  UNKNOWN:             { color: '#94A3B8', bg: '#F1F5F9', label: 'Unknown',             emoji: '❓' },
}

const PAGE_SIZE_OPTIONS = [9, 12, 24]

/* ── Helpers ─────────────────────────────────── */
const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—'
const truncId = (id) => id ? `${id.slice(0, 10)}…${id.slice(-4)}` : '—'
const timeAgo = (d) => {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/* ── Component ───────────────────────────────── */
export default function PaymentsTable() {
  const [payments, setPayments]         = useState([])
  const [filter, setFilter]             = useState('ALL')
  const [search, setSearch]             = useState('')
  const [loading, setLoading]           = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [recovering, setRecovering]     = useState(null)
  const [syncing, setSyncing]           = useState(false)
  const [syncNotice, setSyncNotice]     = useState(null)
  const [sortField, setSortField]       = useState('amount')
  const [sortDir, setSortDir]           = useState('desc')
  const [page, setPage]                 = useState(1)
  const [pageSize, setPageSize]         = useState(12)
  const [copiedId, setCopiedId]         = useState(null)
  const [viewMode, setViewMode]         = useState('cards') // cards | compact

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
      setSyncNotice(d.message || `Checked ${d.links_checked || 0} links • ${d.newly_recovered || 0} recovered`)
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
    { label: 'Total Payments',   value: stats.total,       icon: CreditCard,   color: C.blueMid,  bg: C.blueLight },
    { label: 'Recovered',        value: stats.recovered,   icon: CheckCircle2, color: C.emerald,  bg: C.emeraldLight },
    { label: 'Failed',           value: stats.failed,      icon: XCircle,      color: C.crimson,  bg: C.crimsonLight },
    { label: 'Money Recovered',  value: fmt(stats.recAmt), icon: IndianRupee,  color: C.purple,   bg: C.purpleLight },
  ]

  /* ── Render ────────────────────────────────── */
  return (
    <div style={{ padding: '24px 28px', fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: '100%' }}>

      {/* ── Header ─────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: C.text, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${C.blueMid}, ${C.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
              <CreditCard size={16} color="#fff" />
            </div>
            Payment Transactions
          </h1>
          <p style={{ fontSize: 13, color: C.textSub, marginTop: 4, marginBottom: 0 }}>
            Every payment analyzed, diagnosed, and actioned by the AI recovery agent
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchPayments} disabled={loading}
            style={{ ...btnSecondary, opacity: loading ? 0.6 : 1 }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = C.blueMid; e.currentTarget.style.color = C.blueMid }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
          <button onClick={handleSyncLinks} disabled={syncing}
            style={{ ...btnPrimary, opacity: syncing ? 0.7 : 1 }}
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
        <div style={{ background: C.emeraldLight, border: '1px solid #A7F3D0', color: '#065F46', padding: '10px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, animation: 'slideDown 0.3s ease' }}>
          <CheckCircle2 size={14} /> {syncNotice}
        </div>
      )}

      {/* ── Stat Cards ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        {statCards.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} style={{
              background: C.white, borderRadius: 10, padding: '16px 18px',
              border: `1px solid ${C.border}`, position: 'relative', overflow: 'hidden',
              transition: 'all 0.2s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.boxShadow = `0 4px 14px ${s.color}18` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ position: 'absolute', top: -10, right: -10, width: 50, height: 50, borderRadius: '50%', background: s.bg, opacity: 0.5 }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{s.value}</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={17} color={s.color} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Recovery Rate ──────────────────── */}
      <div style={{ background: C.white, borderRadius: 10, padding: '12px 18px', marginBottom: 18, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 130 }}>
          <TrendingUp size={14} color={C.emerald} />
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Recovery Rate</span>
        </div>
        <div style={{ flex: 1, height: 7, borderRadius: 4, background: '#F1F5F9', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${C.emerald}, #34D399)`, width: `${stats.rate}%`, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.emerald, minWidth: 40, textAlign: 'right' }}>{stats.rate}%</span>
      </div>

      {/* ── Toolbar ────────────────────────── */}
      <div style={{ background: C.white, borderRadius: 10, padding: '14px 18px', marginBottom: 16, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <Filter size={13} color={C.textMuted} style={{ marginRight: 4 }} />
          {FILTERS.map(f => {
            const active = filter === f
            const cfg = STATUS_CONFIG[f]
            const count = f === 'ALL' ? payments.length : payments.filter(p => p.status === f).length
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 11px', borderRadius: 6,
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
                {f === 'ALL' ? 'All' : cfg?.label || f}
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  background: active ? `${cfg?.color || C.blueMid}15` : '#F1F5F9',
                  color: active ? (cfg?.color || C.blueMid) : C.textMuted,
                  padding: '1px 5px', borderRadius: 8, minWidth: 16, textAlign: 'center',
                }}>{count}</span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Sort Dropdown */}
          <select
            value={`${sortField}-${sortDir}`}
            onChange={e => { const [f, d] = e.target.value.split('-'); setSortField(f); setSortDir(d) }}
            style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11, color: C.textSub, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: C.white }}
          >
            <option value="amount-desc">Amount ↓</option>
            <option value="amount-asc">Amount ↑</option>
            <option value="status-asc">Status A-Z</option>
            <option value="customer_email-asc">Customer A-Z</option>
            <option value="retry_count-desc">Most Retries</option>
          </select>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search email, ID…"
              style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, color: C.text, outline: 'none', width: 190, fontFamily: "'DM Sans', sans-serif", transition: 'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = C.blueMid}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>
        </div>
      </div>

      {/* ── Payment Cards Grid ─────────────── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, color: C.textMuted }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: C.blueMid, marginBottom: 10 }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Loading payments…</span>
        </div>
      ) : paginated.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, color: C.textMuted }}>
          <CreditCard size={32} style={{ color: C.border, marginBottom: 10 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.textSub }}>No payments found</span>
          <span style={{ fontSize: 12, marginTop: 4 }}>Run a batch or adjust your filters</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(370, 1fr))', gap: 14 }}>
          {paginated.map(p => {
            const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.ABANDONED
            const StatusIcon = sc.icon
            const cc = CAUSE_CONFIG[p.root_cause] || CAUSE_CONFIG.UNKNOWN

            return (
              <div key={p.id} style={{
                background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
                overflow: 'hidden', transition: 'all 0.2s ease', cursor: 'default',
                position: 'relative',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = sc.color; e.currentTarget.style.boxShadow = `0 6px 20px ${sc.color}12`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {/* Status stripe on top */}
                <div style={{ height: 3, background: sc.gradient }} />

                {/* Card Body */}
                <div style={{ padding: '16px 18px' }}>

                  {/* Top Row: ID + Status + Amount */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: `linear-gradient(135deg, ${sc.color}20, ${sc.color}08)`,
                        border: `2px solid ${sc.color}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: sc.color, flexShrink: 0,
                      }}>
                        {(p.customer_email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.customer_email}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <code style={{ fontSize: 10, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace", background: '#F8FAFC', padding: '1px 5px', borderRadius: 3 }}>
                            {truncId(p.id)}
                          </code>
                          <button onClick={() => handleCopyId(p.id)} title="Copy ID"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, color: copiedId === p.id ? C.emerald : C.textMuted, transition: 'color 0.15s' }}>
                            {copiedId === p.id ? <CheckCircle2 size={10} /> : <Copy size={10} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Amount */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{fmt(p.amount)}</div>
                      <span style={{
                        padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                        color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`,
                        display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4,
                      }}>
                        <StatusIcon size={9} />
                        {sc.label}
                      </span>
                    </div>
                  </div>

                  {/* Info Row: Root Cause + Action + Retries */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {p.root_cause && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: cc.bg, padding: '4px 10px', borderRadius: 6,
                        fontSize: 11, fontWeight: 600, color: cc.color,
                      }}>
                        <span style={{ fontSize: 12 }}>{cc.emoji}</span>
                        {cc.label}
                      </div>
                    )}
                    {p.recovery_action && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: '#F8FAFC', padding: '4px 10px', borderRadius: 6,
                        fontSize: 11, fontWeight: 500, color: C.textSub,
                        border: `1px solid ${C.borderLight}`,
                      }}>
                        <Zap size={10} color={C.amber} />
                        {p.recovery_action.replace(/_/g, ' ')}
                      </div>
                    )}
                    {p.retry_count > 0 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: p.retry_count > 2 ? C.crimsonLight : C.amberLight,
                        padding: '4px 9px', borderRadius: 6,
                        fontSize: 11, fontWeight: 600,
                        color: p.retry_count > 2 ? C.crimson : C.amber,
                      }}>
                        <RotateCcw size={10} />
                        {p.retry_count} retries
                      </div>
                    )}
                  </div>

                  {/* AI Reasoning — Always Visible */}
                  {p.gemini_reasoning && (
                    <div style={{
                      background: `linear-gradient(135deg, #FAFBFF, #F8FAFC)`,
                      border: `1px solid ${C.border}`, borderRadius: 10,
                      padding: '12px 14px', marginBottom: 12,
                    }}>
                      {/* Diagnosis */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: p.recovery_message ? 10 : 0 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: `linear-gradient(135deg, ${C.indigo}15, ${C.purple}15)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                        }}>
                          <Brain size={11} color={C.indigo} />
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: C.indigo, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                            AI Diagnosis
                          </div>
                          <div style={{ fontSize: 11, color: C.textSub, lineHeight: 1.55 }}>
                            {p.gemini_reasoning}
                          </div>
                        </div>
                      </div>

                      {/* Recovery Message */}
                      {p.recovery_message && (
                        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 6,
                            background: `linear-gradient(135deg, ${C.emerald}15, #34D39915)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                          }}>
                            <MessageSquare size={11} color={C.emerald} />
                          </div>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: C.emerald, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                              Recovery Message
                            </div>
                            <div style={{ fontSize: 11, color: C.textSub, lineHeight: 1.55, fontStyle: 'italic' }}>
                              "{p.recovery_message}"
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Payment Link */}
                      {p.payment_link_id && (
                        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Link2 size={10} color={C.textMuted} />
                          <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.textMuted }}>
                            Link: {p.payment_link_id}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card Footer Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setSelectedPayment(p.id)}
                        style={{ ...actionBtn, color: C.blueMid, background: C.blueLight, borderColor: `${C.blueMid}25` }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.blueMid; e.currentTarget.style.color = '#fff' }}
                        onMouseLeave={e => { e.currentTarget.style.background = C.blueLight; e.currentTarget.style.color = C.blueMid }}
                      >
                        <Eye size={11} /> View Audit
                      </button>
                      {p.status === 'FAILED' && (
                        <button onClick={() => handleRecover(p.id)} disabled={recovering === p.id}
                          style={{ ...actionBtn, color: C.emerald, background: C.emeraldLight, borderColor: `${C.emerald}25`, opacity: recovering === p.id ? 0.6 : 1 }}
                          onMouseEnter={e => { if (recovering !== p.id) { e.currentTarget.style.background = C.emerald; e.currentTarget.style.color = '#fff' }}}
                          onMouseLeave={e => { e.currentTarget.style.background = C.emeraldLight; e.currentTarget.style.color = C.emerald }}
                        >
                          <RotateCcw size={11} style={{ animation: recovering === p.id ? 'spin 1s linear infinite' : 'none' }} />
                          {recovering === p.id ? 'Running…' : 'Recover'}
                        </button>
                      )}
                    </div>
                    {p.retry_count === 0 && !p.root_cause && (
                      <span style={{ fontSize: 10, color: C.textMuted, fontStyle: 'italic' }}>Awaiting analysis</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pagination ─────────────────────── */}
      {filtered.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 18, padding: '12px 18px', background: C.white,
          borderRadius: 10, border: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textSub }}>
            <span>Show</span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
              style={{ padding: '3px 6px', borderRadius: 5, border: `1px solid ${C.border}`, fontSize: 11, color: C.text, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", background: C.white }}>
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>of <strong>{filtered.length}</strong> payments</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ ...pageBtn, opacity: page <= 1 ? 0.3 : 1 }}>
              <ChevronLeft size={14} color={C.textSub} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pn
              if (totalPages <= 5) pn = i + 1
              else if (page <= 3) pn = i + 1
              else if (page >= totalPages - 2) pn = totalPages - 4 + i
              else pn = page - 2 + i
              return (
                <button key={pn} onClick={() => setPage(pn)} style={{
                  ...pageBtn,
                  border: page === pn ? `1px solid ${C.blueMid}` : '1px solid transparent',
                  background: page === pn ? C.blueLight : 'transparent',
                  color: page === pn ? C.blueMid : C.textSub,
                  fontWeight: page === pn ? 700 : 500,
                }}>{pn}</button>
              )
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              style={{ ...pageBtn, opacity: page >= totalPages ? 0.3 : 1 }}>
              <ChevronRight size={14} color={C.textSub} />
            </button>
          </div>
        </div>
      )}

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

/* ── Shared Styles ───────────────────────────── */
const btnSecondary = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
  background: C.white, color: C.textSub, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s ease',
}

const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 8, border: 'none',
  background: `linear-gradient(135deg, ${C.blueMid}, ${C.blueDark})`,
  color: '#fff', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
  boxShadow: '0 2px 8px rgba(37,99,235,0.25)', transition: 'all 0.15s ease',
}

const actionBtn = {
  fontSize: 11, fontWeight: 600, borderRadius: 7,
  padding: '5px 12px', cursor: 'pointer',
  border: '1px solid', display: 'inline-flex', alignItems: 'center', gap: 5,
  transition: 'all 0.15s ease', fontFamily: "'DM Sans', sans-serif",
}

const pageBtn = {
  width: 30, height: 30, borderRadius: 6, border: `1px solid ${C.border}`,
  background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontSize: 12, transition: 'all 0.15s ease', fontFamily: "'DM Sans', sans-serif",
}
