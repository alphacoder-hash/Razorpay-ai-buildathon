import { useEffect, useState } from 'react'
import { getAuditTrail, getPaymentDetails } from '../api'
import { X, Bot, CheckCircle, XCircle, AlertTriangle, Clock, Info, PhoneCall, Volume2, Play, Square, Sparkles } from 'lucide-react'

const RESULT_META = {
  SUCCESS:   { color: '#00BA88', bg: '#ECFDF5', icon: <CheckCircle size={13} /> },
  FAILED:    { color: '#F05454', bg: '#FEF2F2', icon: <XCircle size={13} /> },
  ERROR:     { color: '#F05454', bg: '#FEF2F2', icon: <XCircle size={13} /> },
  DONE:      { color: '#2563EB', bg: '#EFF6FF', icon: <CheckCircle size={13} /> },
  STARTED:   { color: '#6B7280', bg: '#F3F4F6', icon: <Clock size={13} /> },
  ESCALATED: { color: '#F4A100', bg: '#FFFBEB', icon: <AlertTriangle size={13} /> },
  TRIGGERED: { color: '#F4A100', bg: '#FFFBEB', icon: <AlertTriangle size={13} /> },
}

export default function AuditModal({ paymentId, onClose }) {
  const [logs, setLogs] = useState([])
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    Promise.all([
      getAuditTrail(paymentId).catch(() => ({ data: [] })),
      getPaymentDetails(paymentId).catch(() => ({ data: null })),
    ]).then(([trailRes, payRes]) => {
      setLogs(trailRes.data || [])
      setPayment(payRes.data || null)
    }).finally(() => setLoading(false))

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [paymentId])

  const handleVoicePlay = () => {
    if (!('speechSynthesis' in window)) {
      alert("Speech synthesis is not supported in this browser.")
      return
    }

    if (isPlaying) {
      window.speechSynthesis.cancel()
      setIsPlaying(false)
      return
    }

    const textToSpeak = payment?.recovery_message || 
      "Namaste, this is an automated update regarding your recent pending payment on Razorpay. Please use the secure link sent to your phone to complete the transaction."

    const utterance = new SpeechSynthesisUtterance(textToSpeak)
    utterance.rate = 0.95
    utterance.pitch = 1.05
    utterance.onend = () => setIsPlaying(false)
    utterance.onerror = () => setIsPlaying(false)

    setIsPlaying(true)
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 620, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #E5E7EB' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>Audit Trail & Recovery Timeline</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2 }}>{paymentId}</div>
          </div>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex', color: '#6B7280' }}>
            <X size={16} />
          </button>
        </div>

        {/* Hinglish Voice Recovery Dispatch Banner */}
        {payment && (
          <div style={{
            background: 'linear-gradient(135deg, #F0FDF4 0%, #EFF6FF 100%)',
            borderBottom: '1px solid #E0E7FF',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{
                  fontSize: 10,
                  background: '#047857',
                  color: '#FFF',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <PhoneCall size={10} /> Hinglish Voice Recovery
                </span>
                <span style={{ fontSize: 11, color: '#64748B' }}>
                  Target: {payment.customer_phone || '+91 98765 43210'}
                </span>
              </div>
              <p style={{
                fontSize: 12,
                color: '#1E293B',
                margin: 0,
                fontStyle: 'italic',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                "{payment.recovery_message || 'Aapka payment pending hai, direct link se complete karein.'}"
              </p>
            </div>

            <button
              onClick={handleVoicePlay}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: isPlaying ? '#EF4444' : '#0284C7',
                color: '#FFF',
                border: 'none',
                padding: '7px 13px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              {isPlaying ? <Square size={12} fill="white" /> : <Volume2 size={13} />}
              {isPlaying ? 'Stop Voice' : 'Listen Call'}
            </button>
          </div>
        )}

        {/* Timeline */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          {loading && <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>Loading audit trail...</div>}
          {!loading && logs.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>No audit logs found.</div>}

          <div style={{ position: 'relative' }}>
            {logs.map((log, i) => {
              const meta = RESULT_META[log.result] || RESULT_META.STARTED
              return (
                <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16, position: 'relative' }}>
                  {/* Timeline line */}
                  {i < logs.length - 1 && (
                    <div style={{ position: 'absolute', left: 15, top: 28, bottom: -16, width: 1, background: '#E5E7EB' }} />
                  )}
                  {/* Icon */}
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: meta.color, border: `1px solid ${meta.color}22` }}>
                    {meta.icon}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, background: '#FAFAFA', border: '1px solid #F3F4F6', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E' }}>{log.action}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: meta.color, background: meta.bg, padding: '1px 6px', borderRadius: 3 }}>{log.result}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#9CA3AF', fontSize: 10 }}>
                        <Bot size={10} /> {log.actor}
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: '#4B5563', margin: 0 }}>{log.detail}</p>
                    <p style={{ fontSize: 10, color: '#9CA3AF', margin: '6px 0 0' }}>{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
