import { ImageResponse } from 'next/og'

export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(140deg, #0d0b1e 0%, #14103a 55%, #1e0838 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '76%',
            height: '76%',
            borderRadius: '22%',
            background: 'rgba(139,92,246,0.14)',
            border: '2px solid rgba(167,139,250,0.35)',
          }}
        >
          <span
            style={{
              fontSize: 62,
              fontWeight: 900,
              color: '#c4b5fd',
              letterSpacing: '-2px',
            }}
          >
            XOB
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
