import { useEffect, useState } from 'react'
import { AreaChart, Area, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { getBatchRuns, runBatch } from '../api'
import { Play, Loader, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const C = {
  blue:        '#2563EB',
  blueMid:     '#3B82F6',
  blueLight:   '#DBEAFE',
  emerald:     '#059669',
  emeraldLight:'#D1FAE5',
  amber:       '#D97706',
  amberLight:  '#FDE68A',
  crimson:     '#DC2626',
  crimsonLight:'#FEE2E2',
  slate:       '#64748B',
  slateLight:  '#F1F5F9',
  border:      '#E2E8F0',
  text:        '#0F172A',
  textSub:     '#64748B',
  white:       '#FFFFFF',
}

const PIE_COLORS  = [C.emerald, C.amber, C.crimson]
const AREA_COLORS = [C.blue, C.emerald, C.crimson]

export default function Dashboard() {
  const [runs, setRuns]       = useState([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [batchSize, setBatchSize] = useState(15)

  const fetchRuns = async () => {
    setLoading(true)
    try { const r = await getBatchRuns(); setRuns(r.data) } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchRuns() }, [])

  const handleRun = async () => {
    setRunning(true)
    try { await runBatch(batchSize); await fetchRuns() } catch (e) { console.error(e) }
    setRunning(false)
  }

  const latest = runs[0]
  const prev   = runs[1]

  const rateChange = latest && prev
    ? (latest.recovery_rate - prev.recovery_rate).toFixed(1)
    : null

  const pieData = latest
    ? [
        { name: 'Recovered', value: latest.recovered },
        { name: 'Escalated', value: latest.escalated },
        { name: 'Failed',    value: latest.failed    },
      ]
    : [{ name: 'No data', value: 1 }]

  const areaData = runs.slice(0, 8).reverse().map((r, i) => ({
    i,
    run:       r.run_id.slice(-5),
    Recovered: r.recovered,
    Escalated: r.escalated,
    Failed:    r.failed,
    Skipped:   r.skipped || 0,
  }))

  return (
    <div style={{ padding: '28px 32px', fontFamily: "'DM Sans', sans-serif", minHeight: '100%' }}>

      {/* ── Running Progress Overlay ─────────────────────────── */}
      {running && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff', padding: '32px 40px', borderRadius: 16,
            textAlign: 'center', maxWidth: 420, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
              Autonomous Agent Active
            </h3>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px', lineHeight: 1.5 }}>
              Diagnosing {batchSize} payments with Grok & dispatching Razorpay recovery links...
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#2563EB', fontSize: 13, fontWeight: 600 }}>
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Processing batch, please hold...
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Revenue Recovery Agent</h1>
            {latest && (
              <span style={{ fontSize: 11, fontWeight: 600, background: C.emeraldLight, color: C.emerald, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.03em' }}>
                LAST RUN: {latest.run_id.slice(-8).toUpperCase()}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: C.textSub, margin: 0 }}>
            Detect · Classify · Recover · Audit — autonomous agent loop
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={batchSize}
            onChange={e => setBatchSize(Number(e.target.value))}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, fontWeight: 600, color: '#4B5563', background: '#fff', cursor: 'pointer' }}
          >
            <option value={15}>⚡ 15 Payments (Fast Demo)</option>
            <option value={30}>⚡ 30 Payments</option>
            <option value={60}>⚡ 60 Payments (Full Batch)</option>
          </select>
          <button onClick={fetchRuns} style={btnSecondary}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={handleRun} disabled={running} style={{ ...btnPrimary, opacity: running ? 0.7 : 1, cursor: running ? 'not-allowed' : 'pointer' }}>
            {running ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={13} />}
            {running ? 'Running...' : 'Run Recovery Batch'}
          </button>
        </div>
      </div>

      {/* ── KPI row ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard
          label="Recovery Rate"
          value={latest ? `${latest.recovery_rate}%` : '—'}
          sub={latest ? `${latest.total} payments` : 'No data'}
          change={rateChange}
          accent={C.blue}
          accentBg={C.blueLight}
          spark={areaData.map(d => ({ v: d.Recovered }))}
          sparkColor={C.blue}
        />
        <KpiCard
          label="Revenue Recovered"
          value={latest ? `₹${(latest.money_recovered / 1000).toFixed(1)}K` : '—'}
          sub={latest ? `₹${latest.money_recovered.toLocaleString('en-IN')}` : 'No data'}
          accent={C.emerald}
          accentBg={C.emeraldLight}
          spark={areaData.map(d => ({ v: d.Recovered * 800 }))}
          sparkColor={C.emerald}
        />
        <KpiCard
          label="Payments Recovered"
          value={latest ? latest.recovered : '—'}
          sub={latest ? `of ${latest.total} total` : 'No data'}
          accent={C.emerald}
          accentBg={C.emeraldLight}
          spark={areaData.map(d => ({ v: d.Recovered }))}
          sparkColor={C.emerald}
        />
        <KpiCard
          label="Escalated"
          value={latest ? latest.escalated : '—'}
          sub="Needs human review"
          accent={C.amber}
          accentBg={C.amberLight}
          spark={areaData.map(d => ({ v: d.Escalated }))}
          sparkColor={C.amber}
        />
      </div>

      {/* ── Charts row ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 20 }}>

        {/* Donut */}
        <div style={card}>
          <SectionHeader title="Batch Breakdown" sub={latest ? `Run ${latest.run_id.slice(-8)}` : 'Latest run'} />
          <div style={{ position: 'relative' }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={80} innerRadius={50}
                  paddingAngle={latest ? 3 : 0}
                  strokeWidth={0}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={latest ? PIE_COLORS[i] : '#E2E8F0'} />
                  ))}
                </Pie>
                {latest && (
                  <Tooltip
                    contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(v, n) => [`${v} payments`, n]}
                  />
                )}
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            {latest && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>{latest.recovery_rate}%</div>
                <div style={{ fontSize: 10, color: C.textSub, marginTop: 3 }}>recovered</div>
              </div>
            )}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 4 }}>
            {['Recovered', 'Escalated', 'Failed'].map((l, i) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textSub }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i], display: 'inline-block' }} />
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Area chart */}
        <div style={card}>
          <SectionHeader title="Recovery Trend" sub={`Last ${areaData.length || 0} batch runs`} />
          {areaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  {['blue','emerald','crimson'].map((k, i) => (
                    <linearGradient key={k} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={AREA_COLORS[i]} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={AREA_COLORS[i]} stopOpacity={0}    />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="run" tick={{ fontSize: 10, fill: C.textSub, fontFamily: "'DM Mono', monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.textSub }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="Recovered" stroke={C.emerald} strokeWidth={2} fill="url(#grad1)" dot={false} />
                <Area type="monotone" dataKey="Escalated" stroke={C.amber}   strokeWidth={2} fill="url(#grad0)" dot={false} />
                <Area type="monotone" dataKey="Failed"    stroke={C.crimson}  strokeWidth={2} fill="url(#grad2)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart height={200} />
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            {[['Recovered', C.emerald], ['Escalated', C.amber], ['Failed', C.crimson]].map(([l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textSub }}>
                <span style={{ width: 20, height: 2, background: c, display: 'inline-block', borderRadius: 1 }} />
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Batch history table ─────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <SectionHeader title="Batch Run History" sub={`${runs.length} total runs`} />
        </div>

        {runs.length === 0 ? (
          <EmptyState />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Run ID', 'Total', 'Recovered', 'Escalated', 'Failed', 'Skipped', '₹ Recovered', 'Recovery Rate', 'Status', 'Completed'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 600, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((r, idx) => (
                <tr key={r.run_id}
                  style={{ borderBottom: `1px solid ${C.slateLight}`, background: idx === 0 ? '#FAFBFF' : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.slateLight}
                  onMouseLeave={e => e.currentTarget.style.background = idx === 0 ? '#FAFBFF' : 'transparent'}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {idx === 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.blue, display: 'inline-block', flexShrink: 0 }} />}
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.textSub }}>{r.run_id}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: C.text }}>{r.total}</td>
                  <td style={{ padding: '10px 12px' }}><Chip c={C.emerald} bg={C.emeraldLight}>{r.recovered}</Chip></td>
                  <td style={{ padding: '10px 12px' }}><Chip c={C.amber}   bg={C.amberLight}>{r.escalated}</Chip></td>
                  <td style={{ padding: '10px 12px' }}><Chip c={C.crimson} bg={C.crimsonLight}>{r.failed}</Chip></td>
                  <td style={{ padding: '10px 12px' }}><Chip c={C.slate} bg={C.slateLight}>{r.skipped || 0}</Chip></td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: C.emerald, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                    ₹{r.money_recovered.toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '10px 12px', minWidth: 130 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${r.recovery_rate}%`, height: '100%', background: `linear-gradient(90deg, ${C.blue}, ${C.emerald})`, borderRadius: 4, transition: 'width 0.6s ease' }} />
                      </div>
                      <span style={{ fontWeight: 700, color: C.blue, fontSize: 11, minWidth: 34, fontFamily: "'DM Mono', monospace" }}>{r.recovery_rate}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {r.stopped_early
                      ? <span style={{ fontSize: 10, fontWeight: 700, color: C.crimson, background: C.crimsonLight, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.04em' }}>⚠ STOPPED EARLY</span>
                      : <span style={{ fontSize: 10, fontWeight: 600, color: C.emerald, background: C.emeraldLight, padding: '2px 7px', borderRadius: 4 }}>✓ COMPLETE</span>
                    }
                  </td>
                  <td style={{ padding: '10px 12px', color: C.textSub, fontSize: 11 }}>
                    {r.completed_at ? new Date(r.completed_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────── */

function KpiCard({ label, value, sub, change, accent, accentBg, spark, sparkColor }) {
  const up   = change > 0
  const down = change < 0
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      {/* Top accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '12px 12px 0 0' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: C.textSub, letterSpacing: '0.02em' }}>{label}</span>
        {change !== null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: up ? C.emerald : down ? C.crimson : C.textSub, background: up ? C.emeraldLight : down ? C.crimsonLight : C.slateLight, padding: '2px 6px', borderRadius: 4 }}>
            {up ? <TrendingUp size={10} /> : down ? <TrendingDown size={10} /> : <Minus size={10} />}
            {up ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: '-0.6px', lineHeight: 1, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 10, color: C.textSub }}>{sub}</div>
      {/* Sparkline */}
      {spark && spark.length > 1 && (
        <div style={{ marginTop: 12, height: 32 }}>
          <ResponsiveContainer width="100%" height={32}>
            <AreaChart data={spark} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`sg${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={sparkColor} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={1.5} fill={`url(#sg${label})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.1px' }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Chip({ c, bg, children }) {
  return <span style={{ background: bg, color: c, padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{children}</span>
}

function EmptyChart({ height }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.slateLight, borderRadius: 8, border: `1px dashed ${C.border}` }}>
      <span style={{ fontSize: 11, color: C.textSub }}>Run a batch to see data</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: C.blueLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        <Play size={20} color={C.blue} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>No batch runs yet</div>
      <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>Click "Run Recovery Batch" to start the agent</div>
    </div>
  )
}

const card = {
  background: '#fff',
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: '20px 22px',
}

const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 8, border: 'none',
  background: C.blue, color: '#fff',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
  boxShadow: '0 1px 3px rgba(37,99,235,0.3)',
}

const btnSecondary = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '8px 13px', borderRadius: 8,
  border: `1px solid ${C.border}`, background: '#fff',
  color: C.textSub, fontSize: 12, fontWeight: 500,
  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
}
