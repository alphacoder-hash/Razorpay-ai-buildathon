import { useEffect, useState, useMemo } from 'react'
import { getAllLogs } from '../api'
import {
  Bot, RefreshCw, Search, Filter, Clock, CheckCircle2, XCircle,
  AlertTriangle, FileText, Shield, ChevronLeft, ChevronRight,
  Activity, Zap, Eye, Copy, ArrowUpDown, ChevronDown, ChevronUp
} from 'lucide-react'

/* ── Design Tokens ───────────────────────────── */
const C = {
  blue:         '#0284C7',
  blueMid:      '#2563EB',
  blueLight:    '#EFF6FF',
  blueDark:     '#1E40AF',
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
  text:         '#0F172A',
  textSub:      '#475569',
  textMuted:    '#94A3B8',
  white:        '#FFFFFF',
  bg:           '#F8FAFC',
  border:       '#E2E8F0',
  borderLight:  '#F1F5F9',
}

const RESULT_CONFIG = {
  SUCCESS:   { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: CheckCircle2, label: 'Success' },
  FAILED:    { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: XCircle,      label: 'Failed' },
  ERROR:     { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: XCircle,      label: 'Error' },
  DONE:      { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: CheckCircle2, label: 'Done' },
  STARTED:   { color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1', icon: Clock,        label: 'Started' },
  ESCALATED: { color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', icon: AlertTriangle,label: 'Escalated' },
  TRIGGERED: { color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', icon: Zap,          label: 'Triggered' },
}

const ACTION_ICONS = {
  DIAGNOSE:   { icon: Eye,       color: C.indigo },
  RETRY:      { icon: RefreshCw, color: C.blue },
  SEND_LINK:  { icon: Zap,       color: C.emerald },
  ESCALATE:   { icon: AlertTriangle, color: C.amber },
  RECOVER:    { icon: CheckCircle2,  color: C.emerald },
  BATCH_RUN:  { icon: Activity,  color: C.blueMid },
}

const PAGE_SIZE = 20

/* ── Helpers ─────────────────────────────────── */
const truncId = (id) => id ? `${id.slice(0, 10)}…${id.slice(-4)}` : '—'
const fmtTime = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
const fmtFull = (ts) => ts ? new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }) : '—'

export default function AuditLogs() {
  const [logs, setLogs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterResult, setFilterResult] = useState('ALL')
  const [page, setPage]             = useState(1)
  const [expandedRow, setExpandedRow] = useState(null)
  const [copiedId, setCopiedId]     = useState(null)
  const [sortDir, setSortDir]       = useState('desc') // desc = newest first

  const fetchLogs = () => {
    setLoading(true)
    getAllLogs()
      .then(res => setLogs(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchLogs() }, [])
  useEffect(() => { setPage(1) }, [search, filterResult])

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  /* ── Derived Data ─────────────────────────── */
  const RESULT_FILTERS = ['ALL', 'SUCCESS', 'FAILED', 'ESCALATED', 'STARTED', 'DONE']

  const filtered = useMemo(() => {
    let list = logs.filter(l => {
      const matchSearch =
        (l.payment_id || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.action || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.detail || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.actor || '').toLowerCase().includes(search.toLowerCase())
      const matchResult = filterResult === 'ALL' || l.result === filterResult
      return matchSearch && matchResult
    })
    list.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime()
      const tb = new Date(b.timestamp).getTime()
      return sortDir === 'desc' ? tb - ta : ta - tb
    })
    return list
  }, [logs, search, filterResult, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  /* ── Stats ────────────────────────────────── */
  const stats = useMemo(() => ({
    total:     logs.length,
    success:   logs.filter(l => l.result === 'SUCCESS' || l.result === 'DONE').length,
    failed:    logs.filter(l => l.result === 'FAILED' || l.result === 'ERROR').length,
    escalated: logs.filter(l => l.result === 'ESCALATED' || l.result === 'TRIGGERED').length,
  }), [logs])

  const statCards = [
    { label: 'Total Events',  value: stats.total,     icon: Activity,      color: C.blueMid,  bg: C.blueLight },
    { label: 'Successful',    value: stats.success,    icon: CheckCircle2,  color: C.emerald,  bg: C.emeraldLight },
    { label: 'Failed',        value: stats.failed,     icon: XCircle,       color: C.crimson,  bg: C.crimsonLight },
    { label: 'Escalated',     value: stats.escalated,  icon: AlertTriangle, color: C.amber,    bg: C.amberLight },
  ]

  /* ── Render ────────────────────────────────── */
  return (
    <div style={{ padding: '24px 28px', fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: '100%' }}>

      {/* ── Header ─────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: C.text, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: `linear-gradient(135deg, ${C.indigo}, ${C.purple})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
            }}>
              <FileText size={16} color="#fff" />
            </div>
            Audit Trail
          </h1>
          <p style={{ fontSize: 13, color: C.textSub, marginTop: 4, marginBottom: 0 }}>
            Immutable log of every AI agent action — full transparency & compliance
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
            fontSize: 11, color: C.textMuted, fontWeight: 500,
          }}>
            <Shield size={12} color={C.emerald} />
            Tamper-proof
          </div>
          <button onClick={fetchLogs} disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.white, color: C.textSub, fontSize: 12, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = C.blueMid; e.currentTarget.style.color = C.blueMid }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        {statCards.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} style={{
              background: C.white, borderRadius: 10, padding: '14px 16px',
              border: `1px solid ${C.border}`, position: 'relative', overflow: 'hidden',
              transition: 'all 0.2s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.boxShadow = `0 4px 14px ${s.color}15` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ position: 'absolute', top: -10, right: -10, width: 46, height: 46, borderRadius: '50%', background: s.bg, opacity: 0.5 }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{s.value}</div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={s.color} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Toolbar ────────────────────────── */}
      <div style={{
        background: C.white, borderRadius: '10px 10px 0 0', padding: '12px 16px',
        border: `1px solid ${C.border}`, borderBottom: `1px solid ${C.borderLight}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Filter size={12} color={C.textMuted} style={{ marginRight: 4 }} />
          {RESULT_FILTERS.map(f => {
            const active = filterResult === f
            const cfg = RESULT_CONFIG[f]
            const count = f === 'ALL'
              ? logs.length
              : logs.filter(l => l.result === f).length
            return (
              <button key={f} onClick={() => setFilterResult(f)} style={{
                padding: '4px 10px', borderRadius: 6,
                border: `1px solid ${active ? (cfg?.border || C.blueMid) : 'transparent'}`,
                background: active ? (cfg?.bg || C.blueLight) : 'transparent',
                color: active ? (cfg?.color || C.blueMid) : C.textSub,
                fontSize: 10, fontWeight: active ? 700 : 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.15s ease', fontFamily: "'DM Sans', sans-serif",
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F8FAFC' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? (cfg?.bg || C.blueLight) : 'transparent' }}
              >
                {f === 'ALL' ? 'All' : (cfg?.label || f)}
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  background: active ? `${cfg?.color || C.blueMid}15` : '#F1F5F9',
                  color: active ? (cfg?.color || C.blueMid) : C.textMuted,
                  padding: '1px 5px', borderRadius: 8, minWidth: 14, textAlign: 'center',
                }}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Search + Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
              background: C.white, color: C.textSub, fontSize: 10, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <Clock size={10} />
            {sortDir === 'desc' ? 'Newest' : 'Oldest'}
            {sortDir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
          </button>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actions, IDs, details…"
              style={{
                paddingLeft: 28, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
                border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11,
                color: C.text, outline: 'none', width: 200, fontFamily: "'DM Sans', sans-serif",
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = C.blueMid}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>
        </div>
      </div>

      {/* ── Timeline Log Entries ───────────── */}
      <div style={{
        background: C.white, border: `1px solid ${C.border}`, borderTop: 'none',
        borderRadius: '0 0 10px 10px', overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 56, color: C.textMuted }}>
            <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: C.indigo, marginBottom: 10 }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Loading audit trail…</span>
          </div>
        ) : paginated.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 56, color: C.textMuted }}>
            <FileText size={28} style={{ color: C.border, marginBottom: 10 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.textSub }}>No audit logs found</span>
            <span style={{ fontSize: 12, marginTop: 4 }}>Run a batch to generate agent activity logs</span>
          </div>
        ) : (
          <div style={{ padding: '16px 20px' }}>
            {/* Timeline */}
            <div style={{ position: 'relative' }}>
              {/* Vertical line */}
              <div style={{
                position: 'absolute', left: 17, top: 0, bottom: 0, width: 2,
                background: `linear-gradient(180deg, ${C.indigo}30, ${C.border}, transparent)`,
                borderRadius: 1,
              }} />

              {paginated.map((log, i) => {
                const meta = RESULT_CONFIG[log.result] || RESULT_CONFIG.STARTED
                const actionMeta = ACTION_ICONS[log.action] || { icon: Activity, color: C.slate }
                const ActionIcon = actionMeta.icon
                const ResultIcon = meta.icon
                const isExpanded = expandedRow === i

                return (
                  <div key={i} style={{
                    display: 'flex', gap: 14, marginBottom: i < paginated.length - 1 ? 4 : 0,
                    position: 'relative', paddingLeft: 0,
                  }}>
                    {/* Timeline node */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: `linear-gradient(135deg, ${meta.bg}, ${C.white})`,
                      border: `2px solid ${meta.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      zIndex: 1, boxShadow: `0 2px 6px ${meta.color}12`,
                    }}>
                      <ResultIcon size={14} color={meta.color} />
                    </div>

                    {/* Content card */}
                    <div
                      onClick={() => setExpandedRow(isExpanded ? null : i)}
                      style={{
                        flex: 1, background: isExpanded ? '#FAFBFF' : '#FAFBFC',
                        border: `1px solid ${isExpanded ? `${C.indigo}30` : C.borderLight}`,
                        borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
                        transition: 'all 0.2s ease', marginBottom: 8,
                      }}
                      onMouseEnter={e => { if (!isExpanded) { e.currentTarget.style.borderColor = `${meta.color}40`; e.currentTarget.style.boxShadow = `0 2px 8px ${meta.color}08` }}}
                      onMouseLeave={e => { if (!isExpanded) { e.currentTarget.style.borderColor = C.borderLight; e.currentTarget.style.boxShadow = 'none' }}}
                    >
                      {/* Top row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* Action name */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <ActionIcon size={12} color={actionMeta.color} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{log.action}</span>
                          </div>
                          {/* Result badge */}
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                            color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`,
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                          }}>
                            <ResultIcon size={9} />
                            {meta.label}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {/* Actor */}
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 10, fontWeight: 600, color: C.textMuted,
                            background: '#F1F5F9', padding: '2px 8px', borderRadius: 4,
                          }}>
                            <Bot size={10} />
                            {log.actor}
                          </span>
                          {/* Time */}
                          <span style={{ fontSize: 10, color: C.textMuted, whiteSpace: 'nowrap' }}>
                            {fmtTime(log.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Detail preview */}
                      <div style={{
                        fontSize: 12, color: C.textSub, lineHeight: 1.5,
                        overflow: isExpanded ? 'visible' : 'hidden',
                        textOverflow: isExpanded ? 'unset' : 'ellipsis',
                        whiteSpace: isExpanded ? 'normal' : 'nowrap',
                        maxWidth: isExpanded ? 'none' : '100%',
                      }}>
                        {log.detail || 'No detail provided'}
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div style={{
                          marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`,
                          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                          animation: 'slideDown 0.2s ease',
                        }}>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Payment ID</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <code style={{
                                fontSize: 11, color: C.textSub,
                                fontFamily: "'JetBrains Mono', monospace",
                                background: '#F8FAFC', padding: '2px 6px', borderRadius: 4,
                                border: `1px solid ${C.borderLight}`,
                              }}>
                                {truncId(log.payment_id)}
                              </code>
                              <button onClick={(e) => { e.stopPropagation(); handleCopyId(log.payment_id) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: copiedId === log.payment_id ? C.emerald : C.textMuted }}>
                                {copiedId === log.payment_id ? <CheckCircle2 size={10} /> : <Copy size={10} />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Timestamp</div>
                            <div style={{ fontSize: 11, color: C.textSub }}>{fmtFull(log.timestamp)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Pagination ─────────────────────── */}
        {filtered.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 18px', borderTop: `1px solid ${C.borderLight}`, background: '#FAFBFC',
          }}>
            <span style={{ fontSize: 12, color: C.textSub }}>
              Showing <strong>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</strong> of <strong>{filtered.length}</strong> events
            </span>
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
                    border: page === pn ? `1px solid ${C.indigo}` : '1px solid transparent',
                    background: page === pn ? C.purpleLight : 'transparent',
                    color: page === pn ? C.indigo : C.textSub,
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
      </div>

      {/* ── Animations ─────────────────────── */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}

const pageBtn = {
  width: 30, height: 30, borderRadius: 6, border: `1px solid #E2E8F0`,
  background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontSize: 12, transition: 'all 0.15s ease', fontFamily: "'DM Sans', sans-serif",
}
