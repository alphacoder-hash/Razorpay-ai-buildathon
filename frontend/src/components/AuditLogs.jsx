import { useEffect, useState } from 'react'
import { getAllLogs } from '../api'
import { Bot, RefreshCw } from 'lucide-react'

const RESULT_META = {
  SUCCESS:   { color: '#00BA88', bg: '#ECFDF5' },
  FAILED:    { color: '#F05454', bg: '#FEF2F2' },
  ERROR:     { color: '#F05454', bg: '#FEF2F2' },
  DONE:      { color: '#2563EB', bg: '#EFF6FF' },
  STARTED:   { color: '#6B7280', bg: '#F3F4F6' },
  ESCALATED: { color: '#F4A100', bg: '#FFFBEB' },
  TRIGGERED: { color: '#F4A100', bg: '#FFFBEB' },
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = () => {
    setLoading(true)
    getAllLogs()
      .then(res => setLogs(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchLogs() }, [])

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>Audit Logs</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Every action taken by the AI agent — immutable trail</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{logs.length} entries</span>
          <button onClick={fetchLogs} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', color: '#4B5563', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
              {['Timestamp', 'Payment ID', 'Action', 'Actor', 'Result', 'Detail'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Loading logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>No logs yet. Run a batch first.</td></tr>
            ) : logs.map((log, i) => {
              const meta = RESULT_META[log.result] || RESULT_META.STARTED
              return (
                <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px 16px', color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>
                    {log.payment_id.slice(0, 16)}…
                  </td>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1A1A2E' }}>{log.action}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6B7280', fontSize: 11 }}>
                      <Bot size={11} /> {log.actor}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: meta.color, background: meta.bg }}>
                      {log.result}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#4B5563', maxWidth: 320 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.detail}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
