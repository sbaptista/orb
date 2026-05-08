import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 29,
            height: 29,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 36% 30%, #ffffff, #d4e4d4 45%, #6a9a7a 100%)',
            display: 'flex',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              width: 11,
              height: 8,
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
