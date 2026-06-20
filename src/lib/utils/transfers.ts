// Daily Transfer Tracker — shared helpers. Replaces lib/utils/instantSend.ts.

// Two independent caps per account, both enforced server-side:
//   - DAILY: resets every local midnight.
//   - LIFETIME: cumulative across all time, never resets — once an account
//     has sent this much total, it can never instant-send again even
//     though its daily counter keeps resetting.
// available = min(daily remaining, lifetime remaining); whichever is more
// restrictive wins, so an account can show 0 available well before its
// daily counter would otherwise allow more.
export const DAILY_TRANSFER_LIMIT    = 500
export const LIFETIME_TRANSFER_LIMIT = 1000

// Start of "today" in the operator's local time, as an ISO string — passed to
// the record_transfer / create_transfer_reservation / get_transfer_allowance_summary
// RPCs as p_start_of_today, so "today" resets at local midnight, not UTC.
export function getStartOfTodayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export type AllowanceBand = 'green' | 'yellow' | 'red'

// Based on the account's actual remaining capacity (already the lesser of
// daily/lifetime), as a fraction of the daily limit — so an account that's
// fine on its daily counter but near its lifetime cap still shows red,
// which is the accurate "can this account still send" signal.
// >50% remaining -> green, 10-50% -> yellow, <=10% -> red.
export function getAllowanceBand(available: number): AllowanceBand {
  const pct = DAILY_TRANSFER_LIMIT > 0 ? available / DAILY_TRANSFER_LIMIT : 0
  if (pct <= 0.1) return 'red'
  if (pct <= 0.5) return 'yellow'
  return 'green'
}

export const ALLOWANCE_BAND_COLORS: Record<AllowanceBand, { text: string; bg: string; border: string; icon: string }> = {
  green:  { text: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.20)', icon: '🟢' },
  yellow: { text: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.20)', icon: '🟡' },
  red:    { text: '#f87171', bg: 'rgba(244,63,94,0.08)',  border: 'rgba(244,63,94,0.20)',  icon: '🔴' },
}

export const QUICK_TRANSFER_AMOUNTS = [50, 100, 250] as const
