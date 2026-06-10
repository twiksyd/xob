import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function GET() {
  const data = await readFile(join(process.cwd(), 'public', 'icon.png'))
  const src = `data:image/png;base64,${data.toString('base64')}`

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <img src={src} width={512} height={512} />
      </div>
    ),
    { width: 512, height: 512 }
  )
}
