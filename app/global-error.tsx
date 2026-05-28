'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fafafa', color: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '420px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 500, marginBottom: '0.75rem' }}>Something went wrong</h1>
          <p style={{ fontSize: '0.95rem', color: '#666', marginBottom: '1.5rem' }}>
            An unexpected error occurred. You can try again or refresh the page.
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '1rem', fontFamily: 'monospace' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: 500, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
