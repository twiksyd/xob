import { NextRequest, NextResponse } from 'next/server'

const THUMBNAIL_ENDPOINT = 'https://thumbnails.roblox.com/v1/users/avatar-headshot'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId || !/^\d+$/.test(userId)) {
    return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
  }

  const url = `${THUMBNAIL_ENDPOINT}?userIds=${userId}&size=150x150&format=Png&isCircular=true`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch avatar' }, { status: 502 })
  }

  const json = await res.json()
  const imageUrl: string | undefined = json?.data?.[0]?.imageUrl
  if (!imageUrl) {
    return NextResponse.json({ error: 'No avatar found' }, { status: 404 })
  }

  return NextResponse.redirect(imageUrl, {
    status: 302,
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
