// Scalable badge renderer for account-trait tags (PLUS, DISCOUNT ACTIVE, and
// whatever comes next — RESERVED/PRIORITY/VIP, etc.). Add a new entry to
// BADGE_CONFIG and a matching .account-badge--<type> class in globals.css to
// introduce a new badge type; nothing else needs to change.
export type AccountBadgeType = 'plus' | 'discount'

const BADGE_CONFIG: Record<AccountBadgeType, { label: string; className: string }> = {
  plus:     { label: 'PLUS',            className: 'account-badge--plus' },
  discount: { label: 'DISCOUNT ACTIVE', className: 'account-badge--discount' },
}

export default function AccountBadge({ type }: { type: AccountBadgeType }) {
  const { label, className } = BADGE_CONFIG[type]
  return <span className={`account-badge ${className}`}>{label}</span>
}
