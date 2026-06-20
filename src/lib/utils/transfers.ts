// Daily Transfer Tracker — shared helpers. Replaces lib/utils/instantSend.ts.

export const DAILY_TRANSFER_LIMIT = 500

// Start of "today" in the operator's local time, as an ISO string — passed to
// the record_transfer / create_transfer_reservation / get_transfer_allowance_summary
// RPCs as p_start_of_today, so "today" resets at local midnight, not UTC.
export function getStartOfTodayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export type AllowanceBand = 'green' | 'yellow' | 'red'

// 0-249 used/reserved -> green, 250-449 -> yellow, 450-500 -> red.
export function getAllowanceBand(sentToday: number, reserved: number): AllowanceBand {
  const committed = sentToday + reserved
  if (committed >= 450) return 'red'
  if (committed >= 250) return 'yellow'
  return 'green'
}

export const ALLOWANCE_BAND_COLORS: Record<AllowanceBand, { text: string; bg: string; border: string; icon: string }> = {
  green:  { text: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.20)', icon: '🟢' },
  yellow: { text: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.20)', icon: '🟡' },
  red:    { text: '#f87171', bg: 'rgba(244,63,94,0.08)',  border: 'rgba(244,63,94,0.20)',  icon: '🔴' },
}

export const QUICK_TRANSFER_AMOUNTS = [50, 100, 250] as const
