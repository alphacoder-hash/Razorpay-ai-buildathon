import { LayoutDashboard, CreditCard, ScrollText, AlertTriangle, Radar } from 'lucide-react'

const NAV = [
  { label: 'Overview',    icon: <LayoutDashboard size={15} />, id: 'dashboard'  },
  { label: 'Payments',    icon: <CreditCard size={15} />,      id: 'payments'   },
  { label: 'Exceptions',  icon: <AlertTriangle size={15} />,   id: 'exceptions' },
  { label: 'Live Detect', icon: <Radar size={15} />,           id: 'detector'   },
  { label: 'Audit Logs',  icon: <ScrollText size={15} />,      id: 'audit'      },
]

export default function Sidebar({ active, onChange }) {
  return (
    <aside style={{ width: 210, background: '#0A1628', display: 'flex', flexDirection: 'column', minHeight: '100vh', flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #2563EB, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 12L6.5 4H8.5L12 12H10L9.5 10.5H7.5L7 12H3ZM8 6.5L7.3 9H8.7L8 6.5Z" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#F8FAFC', letterSpacing: '-0.2px', fontFamily: "'DM Sans', sans-serif" }}>PayBack AI</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Revenue Recovery</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 8px 8px', fontFamily: "'DM Sans', sans-serif" }}>
          Agent
        </div>
        {NAV.map(item => (
          <button key={item.id} onClick={() => onChange(item.id)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: active === item.id ? 600 : 400,
            color: active === item.id ? '#F8FAFC' : 'rgba(255,255,255,0.45)',
            background: active === item.id ? 'rgba(37,99,235,0.35)' : 'transparent',
            marginBottom: 2, transition: 'all 0.15s', textAlign: 'left',
            fontFamily: "'DM Sans', sans-serif",
          }}
            onMouseEnter={e => { if (active !== item.id) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { if (active !== item.id) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ color: active === item.id ? '#60A5FA' : 'rgba(255,255,255,0.3)', display: 'flex' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Sans', sans-serif" }}>Razorpay Buildathon 2025</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', marginTop: 2 }}>Track 03 · Revenue Recovery</div>
      </div>
    </aside>
  )
}
