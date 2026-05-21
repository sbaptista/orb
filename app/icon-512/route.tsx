import { ImageResponse } from 'next/og'

export async function GET() {
  const s = 512
  const orb = Math.round(s * 0.73)
  const hlTop = Math.round(s * 0.14)
  const hlLeft = Math.round(s * 0.14)
  const hlW = Math.round(s * 0.28)
  const hlH = Math.round(s * 0.19)

  return new ImageResponse(
    (
      <div style={{ width: s, height: s, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: orb, height: orb, borderRadius: '50%',
          background: 'radial-gradient(circle at 36% 30%, #ffffff, #d4e4d4 45%, #6a9a7a 100%)',
          display: 'flex', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: hlTop, left: hlLeft,
            width: hlW, height: hlH, borderRadius: '50%',
            background: 'rgba(255,255,255,0.55)', display: 'flex',
          }} />
        </div>
      </div>
    ),
    { width: s, height: s },
  )
}
