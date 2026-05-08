import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary
    fallback={({ error, resetError }) => (
      <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 500, margin: '4rem auto', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
          This crash has been reported automatically. Try refreshing or clicking below.
        </p>
        <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#ef4444', background: '#1f1f1f', padding: '8px 12px', borderRadius: 6, marginBottom: 20, textAlign: 'left', overflowX: 'auto' }}>
          {error?.message || 'Unknown error'}
        </p>
        <button onClick={resetError} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#e97316', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 14, marginRight: 8 }}>
          Try again
        </button>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #404040', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 14 }}>
          Reload page
        </button>
      </div>
    )}
  >
    <App />
  </Sentry.ErrorBoundary>
)
