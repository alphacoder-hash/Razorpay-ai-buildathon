import { useEffect, useState } from 'react'
import { getDetectorData, ingestLivePayment } from '../api'
import { Radar, RefreshCw, AlertTriangle, Clock, ShieldCheck, Zap, CheckCircle2 } from 'lucide-react'

export default function Detector() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(24)
  const [recoveringMap, setRecoveringMap] = useState({})

  const fetchData = () => {
    setLoading(true)
    getDetectorData(hours)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [hours])

  const handleIngestAndRecover = async (payment) => {
    setRecoveringMap(m => ({ ...m, [payment.id]: { status: 'loading' } }))
    try {
      const res = await ingestLivePayment(payment)
      setRecoveringMap(m => ({
        ...m,
        [payment.id]: {
          status: 'done',
          result: res.data?.status || 'PROCESSED',
          action: res.data?.action || res.data?.recovery_action || 'RECOVERED',
          link: res.data?.link,
        }
      }))
    } catch (e) {
      console.error(e)
      setRecoveringMap(m => ({ ...m, [payment.id]: { status: 'error', error: e.message } }))
    }
  }


  return (
    <div style={{ padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0 }}>Live Detector</h1>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#D1FAE5', padding: '3px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              RAZORPAY TEST MODE
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
            Real-time poll of Razorpay API — detects failed and at-risk payments in your test account
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={hours}
            onChange={e => setHours(Number(e.target.value))}
            style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12, color: '#4B5563', background: '#fff', cursor: 'pointer' }}
          >
            {[6, 12, 24, 48, 72].map(h => <option key={h} value={h}>Last {h}h</option>)}
          </select>
          <button onClick={fetchData} style={btnSecondary} disabled={loading}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Polling...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error / empty state */}
      {data?.error && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>Razorpay API Error</div>
              <div style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>{data.error}</div>
              <div style={{ fontSize: 11, color: '#D97706', marginTop: 6 }}>{data.note}</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      {data && !data.error && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            <StatCard label="Total Fetched" value={data.total_fetched} icon={<Radar size={15} />} color="#2563EB" bg="#EFF6FF" />
            <StatCard label="Failed Payments" value={data.failed_count} icon={<AlertTriangle size={15} />} color="#DC2626" bg="#FEF2F2" />
            <StatCard label="Authorized (At Risk)" value={data.authorized_not_captured} icon={<Clock size={15} />} color="#D97706" bg="#FFFBEB" sub="not yet captured" />
            <StatCard label="Captured" value={data.captured_count} icon={<ShieldCheck size={15} />} color="#059669" bg="#D1FAE5" />
          </div>

          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 16 }}>
            Polled at: {new Date(data.polled_at).toLocaleString()} · Last {data.hours_back}h
          </div>

          {/* Failed payments table */}
          {data.failed_payments.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} color="#DC2626" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Failed Payments from Razorpay</span>
                <span style={{ fontSize: 11, color: '#DC2626', background: '#FEF2F2', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                  {data.failed_payments.length}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                    {['Payment ID', 'Amount', 'Error Code', 'Description', 'Created At', 'Action'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.failed_payments.map(p => {
                    const rec = recoveringMap[p.id]
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F9FAFB' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{p.id}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: '#0F172A', fontFamily: "'DM Mono', monospace" }}>₹{p.amount.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#DC2626', background: '#FEF2F2', padding: '2px 6px', borderRadius: 4 }}>
                            {p.error_code || 'N/A'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', color: '#4B5563', maxWidth: 280 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.error_description || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap' }}>
                          {new Date(p.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                          {rec?.status === 'loading' ? (
                            <span style={{ fontSize: 11, color: '#2563EB', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Processing...
                            </span>
                          ) : rec?.status === 'done' ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#D1FAE5', padding: '3px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={11} /> {rec.action}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleIngestAndRecover(p)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '5px 10px', borderRadius: 6, border: 'none',
                                background: '#2563EB', color: '#fff', fontSize: 11,
                                fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                              }}
                            >
                              <Zap size={11} /> Recover
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* At-risk payments */}
          {data.at_risk_payments.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #FDE68A', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #FEF3C7', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={14} color="#D97706" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Authorized but Not Captured (At Risk)</span>
                <span style={{ fontSize: 11, color: '#D97706', background: '#FFFBEB', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                  {data.at_risk_payments.length}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#FFFBEB', borderBottom: '1px solid #FEF3C7' }}>
                    {['Payment ID', 'Amount', 'Risk', 'Created At'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.at_risk_payments.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #FFF9EB' }}>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{p.id}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: '#0F172A', fontFamily: "'DM Mono', monospace" }}>₹{p.amount.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#D97706', background: '#FFFBEB', padding: '2px 6px', borderRadius: 4 }}>AUTHORIZED — NOT CAPTURED</span>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#9CA3AF', fontSize: 11 }}>
                        {new Date(p.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.failed_payments.length === 0 && data.at_risk_payments.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <ShieldCheck size={40} color="#059669" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>Connected & Polling Razorpay Live Test API</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4, maxWidth: 500, margin: '6px auto 16px' }}>
                Your Razorpay account is connected, but no failed payments have occurred yet in the last {data.hours_back}h.
              </div>
              <a
                href="http://localhost:8000/test-checkout"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', background: '#0284C7', color: '#fff',
                  borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13,
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                }}
              >
                ⚡ Launch Razorpay Test Checkout (Simulate Failure) &rarr;
              </a>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 10 }}>
                Trigger a decline with test card <code>4000 0000 0000 0002</code>, then click Refresh above!
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}

function StatCard({ label, value, sub, icon, color, bg }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color, background: bg, padding: 6, borderRadius: 8, display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#64748B' }}>{label}</span>
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
