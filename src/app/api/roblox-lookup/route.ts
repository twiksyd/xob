import { NextRequest, NextResponse } from 'next/server'

const USERNAME_LOOKUP_ENDPOINT = 'https://users.roblox.com/v1/usernames/users'

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get('username')?.trim()
  if (!username) {
    return NextResponse.json({ error: 'Missing username' }, { status: 400 })
  }

  const res = await fetch(USERNAME_LOOKUP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  })
  if (!res.ok) {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 502 })
  }

  const json = await res.json()
  const userId: number | undefined = json?.data?.[0]?.id
  return NextResponse.json({ userId: userId ? String(userId) : null })
}
