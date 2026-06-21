import { RobloxAccount } from '@/lib/types/database'
import AccountBadge from './AccountBadge'

// Renders every trait badge that belongs beside an account's username
// (currently PLUS + DISCOUNT ACTIVE). Chrome Profile is intentionally NOT
// included here — it's operational (which browser profile, not an account
// trait) and gets its own placement per surface.
export default function AccountBadgeRow({
  account,
}: {
  account: Pick<RobloxAccount, 'is_plus_account' | 'has_active_discount'>
}) {
  return (
    <>
      {account.is_plus_account && <AccountBadge type="plus" />}
      {account.has_active_discount && <AccountBadge type="discount" />}
    </>
  )
}
