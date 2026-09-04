import { useEffect, useState } from 'react'
import { getAuditTrail, getPaymentDetails, triggerVoiceRecovery, analyzeCustomerReply } from '../api'
import {
  X, Bot, CheckCircle2, XCircle, AlertTriangle, Clock, 
  PhoneCall, Volume2, Play, Square, Brain, MessageSquare,
  CreditCard, Shield, Link2, Copy, ExternalLink, Zap,
  Activity, Eye, RefreshCw, ChevronRight, PhoneOutgoing
} from 'lucide-react'

/* ── Design Tokens ───────────────────────────── */
const C = {
  blue:         '#0284C7',
  blueMid:      '#2563EB',
  blueLight:    '#EFF6FF',
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

const STATUS_CONFIG = {
  FAILED:    { color: '#DC2626', bg: '#FEF2F2', label: 'Failed' },
  RECOVERED: { color: '#059669', bg: '#ECFDF5', label: 'Recovered' },
  ESCALATED: { color: '#D97706', bg: '#FEF3C7', label: 'Escalated' },
  PENDING:   { color: '#2563EB', bg: '#EFF6FF', label: 'Pending' },
}

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—'

export default function AuditModal({ paymentId, onClose }) {
  const [logs, setLogs] = useState([])
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isTriggering, setIsTriggering] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [sentimentReply, setSentimentReply] = useState('')
  const [sentimentResult, setSentimentResult] = useState(null)
  const [analyzingReply, setAnalyzingReply] = useState(false)
  const [showSentimentPanel, setShowSentimentPanel] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [resLog, resPay] = await Promise.all([
        getAuditTrail(paymentId).catch(() => ({ data: [] })),
        getPaymentDetails(paymentId).catch(() => ({ data: null }))
      ])
      setLogs(resLog.data || [])
      setPayment(resPay.data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleTriggerVoice = async () => {
    if (isTriggering) return
    setIsTriggering(true)
    try {
      await triggerVoiceRecovery(paymentId)
      await fetchData()
    } catch (e) {
      console.error(e)
    }
    setIsTriggering(false)
  }

  const handleAnalyzeReply = async () => {
    if (!sentimentReply.trim() || analyzingReply) return
    setAnalyzingReply(true)
    setSentimentResult(null)
    try {
      const res = await analyzeCustomerReply(paymentId, sentimentReply)
      setSentimentResult(res.data)
      await fetchData() // refresh audit trail
    } catch (e) {
      setSentimentResult({ error: 'Analysis failed. Please try again.' })
    }
    setAnalyzingReply(false)
  }

  useEffect(() => {
    fetchData()
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [paymentId])

  const handleVoicePlay = () => {
    if (!('speechSynthesis' in window)) return
    if (isPlaying) {
      window.speechSynthesis.cancel()
      setIsPlaying(false)
      return
    }
    const text = payment?.recovery_message ||
      "Namaste, this is an automated update regarding your recent pending payment. Please use the secure link sent to your phone to complete the transaction."
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.95; u.pitch = 1.05
    u.onend = () => setIsPlaying(false)
    u.onerror = () => setIsPlaying(false)
    setIsPlaying(true)
    window.speechSynthesis.speak(u)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(paymentId)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 1500)
  }

  const sc = payment ? (STATUS_CONFIG[payment.status] || STATUS_CONFIG.PENDING) : null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: 16,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 16, width: '100%', maxWidth: 640,
          maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
          animation: 'modalSlideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ─────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 22px', borderBottom: `1px solid ${C.border}`,
          background: 'linear-gradient(135deg, #FAFBFF, #F8FAFC)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.indigo}, ${C.purple})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
            }}>
              <Shield size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Audit Trail & Recovery</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <code style={{ fontSize: 10, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace", background: '#F1F5F9', padding: '1px 6px', borderRadius: 3 }}>
                  {paymentId.slice(0, 14)}…{paymentId.slice(-4)}
                </code>
                <button onClick={handleCopy}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: copiedId ? C.emerald : C.textMuted }}>
                  {copiedId ? <CheckCircle2 size={10} /> : <Copy size={10} />}
                </button>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#F1F5F9', border: 'none', borderRadius: 8, width: 32, height: 32,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.textSub, transition: 'all 0.15s ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = C.crimsonLight; e.currentTarget.style.color = C.crimson }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = C.textSub }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Payment Summary Card ───────────── */}
        {payment && (
          <div style={{ padding: '14px 22px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{
              background: 'linear-gradient(135deg, #FAFBFF, #F8FAFC)',
              border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${C.blueMid}15, ${C.purple}15)`,
                  border: `2px solid ${C.blueMid}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: C.blueMid,
                }}>
                  {(payment.customer_email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{payment.customer_email}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    {payment.root_cause && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.amber, background: C.amberLight, padding: '2px 7px', borderRadius: 4 }}>
                        {payment.root_cause.replace(/_/g, ' ')}
                      </span>
                    )}
                    {payment.recovery_action && (
                      <span style={{ fontSize: 10, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Zap size={9} /> {payment.recovery_action.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{fmt(payment.amount)}</div>
                {sc && (
                  <span style={{
                    padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    color: sc.color, background: sc.bg, display: 'inline-block', marginTop: 3,
                  }}>
                    {sc.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Voice Recovery Banner ──────────── */}
        {payment && (
          <div style={{
            background: 'linear-gradient(135deg, #F0FDF4, #EFF6FF)',
            borderBottom: `1px solid ${C.border}`, padding: '12px 22px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{
                  fontSize: 9, background: '#047857', color: '#FFF', padding: '2px 8px',
                  borderRadius: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4,
                  letterSpacing: '0.03em',
                }}>
                  <PhoneCall size={9} /> HINGLISH VOICE RECOVERY
                </span>
                <span style={{ fontSize: 10, color: C.textMuted }}>
                  Target: {payment.customer_phone || '+91 98765 43210'}
                </span>
              </div>
              <p style={{ fontSize: 11, color: C.textSub, margin: 0, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                "{payment.recovery_message || 'Aapka payment pending hai, direct link se complete karein.'}"
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={handleTriggerVoice} disabled={isTriggering} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: '#FFF', color: '#047857',
                border: '1px solid #059669', padding: '8px 14px', borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: isTriggering ? 'not-allowed' : 'pointer',
                opacity: isTriggering ? 0.6 : 1, transition: 'all 0.2s ease',
              }}>
                <PhoneOutgoing size={12} />
                {isTriggering ? 'Calling…' : 'Initiate Call'}
              </button>
              <button onClick={handleVoicePlay} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: isPlaying ? `linear-gradient(135deg, #DC2626, #EF4444)` : `linear-gradient(135deg, ${C.blueMid}, ${C.blue})`,
                color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                boxShadow: isPlaying ? '0 2px 8px rgba(220,38,38,0.25)' : '0 2px 8px rgba(37,99,235,0.25)',
                transition: 'all 0.2s ease',
              }}>
                {isPlaying ? <Square size={11} fill="white" /> : <Volume2 size={12} />}
                {isPlaying ? 'Stop' : 'Listen Script'}
              </button>
            </div>
          </div>
        )}

        {/* ── Sentiment Analysis Panel ───────── */}
        {payment && (
          <div style={{
            borderBottom: `1px solid ${C.border}`,
            background: '#FAFBFC',
          }}>
            <button
              onClick={() => setShowSentimentPanel(p => !p)}
              style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                color: C.textSub, fontSize: 11, fontWeight: 600,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={12} color={C.purple} />
                Simulate Customer Reply (Sentiment Analysis)
              </span>
              <ChevronRight size={12} style={{ transform: showSentimentPanel ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {showSentimentPanel && (
              <div style={{ padding: '0 22px 14px' }}>
                <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
                  Enter what the customer wrote back (e.g. WhatsApp/email reply). AI will classify sentiment and take an automated action.
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <textarea
                    value={sentimentReply}
                    onChange={e => setSentimentReply(e.target.value)}
                    placeholder='e.g. "Bhai meri job chali gayi hai, please thoda time do" or "I never authorized this charge"'
                    rows={2}
                    style={{
                      flex: 1, border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: '8px 10px', fontSize: 11, fontFamily: "'DM Sans', sans-serif",
                      resize: 'none', color: C.text, background: C.white,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleAnalyzeReply}
                    disabled={analyzingReply || !sentimentReply.trim()}
                    style={{
                      background: analyzingReply ? C.border : `linear-gradient(135deg, ${C.purple}, ${C.indigo})`,
                      color: '#fff', border: 'none', borderRadius: 8,
                      padding: '8px 14px', fontSize: 11, fontWeight: 700,
                      cursor: analyzingReply || !sentimentReply.trim() ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    {analyzingReply ? 'Analyzing…' : '🧠 Analyze'}
                  </button>
                </div>

                {sentimentResult && !sentimentResult.error && (
                  <div style={{
                    marginTop: 10, padding: '10px 14px', borderRadius: 8,
                    border: `1px solid ${C.border}`, background: C.white,
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                        background: sentimentResult.sentiment === 'HARDSHIP' ? '#FEF3C7' :
                                    sentimentResult.sentiment === 'DISPUTE' ? '#FEE2E2' :
                                    sentimentResult.sentiment === 'READY_TO_PAY' ? '#ECFDF5' : '#F5F3FF',
                        color: sentimentResult.sentiment === 'HARDSHIP' ? '#92400E' :
                               sentimentResult.sentiment === 'DISPUTE' ? '#991B1B' :
                               sentimentResult.sentiment === 'READY_TO_PAY' ? '#065F46' : '#5B21B6',
                      }}>
                        {sentimentResult.sentiment}
                      </span>
                      <span style={{ fontSize: 10, color: C.textMuted }}>
                        {Math.round((sentimentResult.confidence || 0) * 100)}% confidence
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.blue, marginLeft: 'auto' }}>
                        → {sentimentResult.action_taken}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: C.textSub, margin: 0 }}>{sentimentResult.reasoning}</p>
                    <p style={{ fontSize: 11, color: C.emerald, margin: 0, fontStyle: 'italic' }}>
                      💬 AI: "{sentimentResult.empathy_response}"
                    </p>
                  </div>
                )}
                {sentimentResult?.error && (
                  <p style={{ fontSize: 11, color: C.crimson, marginTop: 8 }}>{sentimentResult.error}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Timeline ──────────────────────── */}
        <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1 }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 40, color: C.textMuted }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: C.indigo, marginBottom: 8 }} />
              <span style={{ fontSize: 12 }}>Loading audit trail…</span>
            </div>
          )}
          {!loading && logs.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 40, color: C.textMuted }}>
              <Activity size={24} style={{ color: C.border, marginBottom: 8 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: C.textSub }}>No audit logs found</span>
            </div>
          )}

          {!loading && logs.length > 0 && (
            <div style={{ position: 'relative' }}>
              {/* Vertical line */}
              <div style={{
                position: 'absolute', left: 16, top: 4, bottom: 4, width: 2,
                background: `linear-gradient(180deg, ${C.indigo}30, ${C.border}, transparent)`, borderRadius: 1,
              }} />

              {logs.map((log, i) => {
                const meta = RESULT_CONFIG[log.result] || RESULT_CONFIG.STARTED
                const ResultIcon = meta.icon

                return (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < logs.length - 1 ? 4 : 0, position: 'relative' }}>
                    {/* Node */}
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                      background: `linear-gradient(135deg, ${meta.bg}, ${C.white})`,
                      border: `2px solid ${meta.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      zIndex: 1, boxShadow: `0 2px 6px ${meta.color}10`,
                    }}>
                      <ResultIcon size={13} color={meta.color} />
                    </div>

                    {/* Content */}
                    <div style={{
                      flex: 1, background: '#FAFBFC', border: `1px solid ${C.borderLight}`,
                      borderRadius: 9, padding: '10px 14px', marginBottom: 6,
                      transition: 'all 0.15s ease',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = `${meta.color}35`; e.currentTarget.style.background = '#FAFBFF' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderLight; e.currentTarget.style.background = '#FAFBFC' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{log.action}</span>
                          <span style={{
                            padding: '1px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                            color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`,
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                          }}>
                            <ResultIcon size={8} />
                            {meta.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontSize: 9, fontWeight: 600, color: C.textMuted, background: '#F1F5F9', padding: '2px 6px', borderRadius: 4,
                          }}>
                            <Bot size={9} /> {log.actor}
                          </span>
                          <span style={{ fontSize: 9, color: C.textMuted }}>
                            {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: C.textSub, margin: 0, lineHeight: 1.5 }}>{log.detail}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────── */}
        <div style={{
          padding: '10px 22px', borderTop: `1px solid ${C.border}`,
          background: '#FAFBFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Shield size={10} /> {logs.length} audit events • Immutable trail
          </span>
          <button onClick={onClose} style={{
            padding: '6px 16px', borderRadius: 7, border: `1px solid ${C.border}`,
            background: C.white, color: C.textSub, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            transition: 'all 0.15s ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.blueMid; e.currentTarget.style.color = C.blueMid }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub }}
          >
            Close
          </button>
        </div>
      </div>

      {/* ── Animations ─────────────────────── */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
