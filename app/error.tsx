'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '420px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, marginBottom: '0.75rem' }}>Something went wrong</h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--muted, #666)', marginBottom: '1.5rem' }}>
          An unexpected error occurred. You can try again or refresh the page.
        </p>
        {error.digest && (
          <p style={{ fontSize: '0.75rem', color: 'var(--muted, #999)', marginBottom: '1rem', fontFamily: 'monospace' }}>
            Error ID: {error.digest}
          </p>
        )}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: 500, background: 'var(--text, #1a1a1a)', color: 'var(--bg, #fff)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: 500, background: 'transparent', color: 'var(--text, #1a1a1a)', border: '1px solid var(--border, #ddd)', borderRadius: '8px', cursor: 'pointer' }}
          >
            Refresh page
          </button>
        </div>
      </div>
    </div>
  )
}
