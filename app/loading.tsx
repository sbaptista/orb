export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100dvh',
      background: '#f8f6f3',
      gap: '1.5rem',
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 36% 30%, #ffffff, #d4e4d4 45%, #6a9a7a 100%)',
        boxShadow: '0 0 32px rgba(106, 154, 122, 0.3)',
        animation: 'orb-loading-breathe 4.2s ease-in-out infinite',
      }} />
      <style>{`
        @keyframes orb-loading-breathe {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.06); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
