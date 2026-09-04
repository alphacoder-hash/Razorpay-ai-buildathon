import { useState } from 'react'
import Sidebar from './components/Sidebar'
import HomePage from './components/HomePage'
import Dashboard from './components/Dashboard'
import PaymentsTable from './components/PaymentsTable'
import AuditLogs from './components/AuditLogs'
import Exceptions from './components/Exceptions'
import Detector from './components/Detector'

const PAGE_LABELS = {
  home:       'Home',
  dashboard:  'Overview',
  payments:   'Payments',
  exceptions: 'Exception List',
  detector:   'Live Detector',
  audit:      'Audit Logs',
}

export default function App() {
  const [page, setPage] = useState('home')

  if (page === 'home') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        <HomePage onGoToDashboard={setPage} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9', fontFamily: "'DM Sans', sans-serif" }}>
      <Sidebar active={page} onChange={setPage} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{ height: 48, background: '#fff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setPage('home')}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: '#2563EB',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              ← Home
            </button>
            <span style={{ color: '#CBD5E1' }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#64748B' }}>{PAGE_LABELS[page]}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, background: '#EFF6FF', color: '#2563EB', padding: '3px 9px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.05em' }}>
              TEST MODE
            </span>
            <span style={{ fontSize: 10, background: '#ECFDF5', color: '#059669', padding: '3px 9px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              AGENT ACTIVE
            </span>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', minWidth: 0, width: '100%' }}>
          {page === 'dashboard'  && <Dashboard />}
          {page === 'payments'   && <PaymentsTable />}
          {page === 'exceptions' && <Exceptions />}
          {page === 'detector'   && <Detector />}
          {page === 'audit'      && <AuditLogs />}
        </main>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
