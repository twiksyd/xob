import { CSSProperties } from 'react'

// Chrome profile tag — color-coded by profile name (same name always gets
// the same color, so accounts in the same profile are visually groupable
// at a glance), with a static glow. Styles in globals.css (.chrome-profile-badge).
const PALETTE = [
  '#f43f5e', '#f59e0b', '#84cc16', '#10b981',
  '#06b6d4', '#6366f1', '#a855f7', '#ec4899',
]

function colorForProfile(profile: string): string {
  let hash = 0
  for (let i = 0; i < profile.length; i++) hash = (hash * 31 + profile.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export default function ChromeProfileBadge({ profile }: { profile: string }) {
  const color = colorForProfile(profile)
  const style = { background: color, '--chrome-glow': `${color}33` } as CSSProperties
  return (
    <span className="chrome-profile-badge" style={style} title={`Chrome profile: ${profile}`}>
      {profile}
    </span>
  )
}
