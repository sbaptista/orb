import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 36% 30%, #ffffff, #d4e4d4 45%, #6a9a7a 100%)',
            display: 'flex',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 25,
              left: 25,
              width: 50,
              height: 34,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.55)',
              display: 'flex',
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  )
}
