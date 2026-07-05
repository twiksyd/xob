export const BATCH_COLORS = [
  { key: 'red', label: 'Red', value: '#ef4444', soft: 'rgba(239,68,68,0.12)' },
  { key: 'orange', label: 'Orange', value: '#f97316', soft: 'rgba(249,115,22,0.12)' },
  { key: 'yellow', label: 'Yellow', value: '#eab308', soft: 'rgba(234,179,8,0.12)' },
  { key: 'green', label: 'Green', value: '#22c55e', soft: 'rgba(34,197,94,0.12)' },
  { key: 'blue', label: 'Blue', value: '#3b82f6', soft: 'rgba(59,130,246,0.12)' },
  { key: 'purple', label: 'Purple', value: '#a855f7', soft: 'rgba(168,85,247,0.12)' },
  { key: 'gray', label: 'Gray', value: '#94a3b8', soft: 'rgba(148,163,184,0.12)' },
  { key: 'pink', label: 'Pink', value: '#ec4899', soft: 'rgba(236,72,153,0.12)' },
  { key: 'brown', label: 'Brown', value: '#a16207', soft: 'rgba(161,98,7,0.12)' },
] as const

export type BatchColorKey = typeof BATCH_COLORS[number]['key']

export function getBatchColor(key?: string | null) {
  return BATCH_COLORS.find(color => color.key === key) ?? BATCH_COLORS[4]
}
