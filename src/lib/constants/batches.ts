export const BATCH_COLORS = [
  // ── Primary palette (shown in the color picker) ───────────────────────────
  { key: 'green',  label: 'Bright Green',  value: '#22c55e', soft: 'rgba(34,197,94,0.28)',   border: 'rgba(34,197,94,0.58)',   dominant: true  },
  { key: 'blue',   label: 'Crimson',       value: '#C02E48', soft: 'rgba(192,46,72,0.10)',   border: 'rgba(192,46,72,0.42)',   dominant: false },
  { key: 'purple', label: 'Magenta',       value: '#A02888', soft: 'rgba(160,40,136,0.10)',  border: 'rgba(160,40,136,0.42)', dominant: false },
  { key: 'amber',  label: 'Amber',         value: '#C08820', soft: 'rgba(192,136,32,0.10)',  border: 'rgba(192,136,32,0.42)', dominant: false },
  { key: 'rose',   label: 'Rose',          value: '#C84878', soft: 'rgba(200,72,120,0.10)',  border: 'rgba(200,72,120,0.42)', dominant: false },
  { key: 'cyan',   label: 'Coral',         value: '#C85838', soft: 'rgba(200,88,56,0.10)',   border: 'rgba(200,88,56,0.42)',  dominant: false },
  { key: 'slate',  label: 'Copper',        value: '#B07028', soft: 'rgba(176,112,40,0.10)',  border: 'rgba(176,112,40,0.42)', dominant: false },
  { key: 'red',    label: 'Bright Red',    value: '#ef2020', soft: 'rgba(239,32,32,0.28)',   border: 'rgba(239,32,32,0.58)',   dominant: true  },
  { key: 'orange', label: 'Bright Orange', value: '#f97316', soft: 'rgba(249,115,22,0.28)',  border: 'rgba(249,115,22,0.58)',  dominant: true  },
  // ── Legacy aliases — DB compat only, never shown in the picker ────────────
  { key: 'yellow', label: 'Amber',  value: '#C08820', soft: 'rgba(192,136,32,0.10)',  border: 'rgba(192,136,32,0.42)', dominant: false },
  { key: 'gray',   label: 'Copper', value: '#B07028', soft: 'rgba(176,112,40,0.10)',  border: 'rgba(176,112,40,0.42)', dominant: false },
  { key: 'pink',   label: 'Rose',   value: '#C84878', soft: 'rgba(200,72,120,0.10)',  border: 'rgba(200,72,120,0.42)', dominant: false },
  { key: 'brown',  label: 'Copper', value: '#B07028', soft: 'rgba(176,112,40,0.10)',  border: 'rgba(176,112,40,0.42)', dominant: false },
] as const

export type BatchColorKey = typeof BATCH_COLORS[number]['key']

// The 9 primary colors available in the color picker (excludes legacy aliases)
export const BATCH_PALETTE = BATCH_COLORS.slice(0, 9)

export function getBatchColor(key?: string | null) {
  return BATCH_COLORS.find(color => color.key === key) ?? BATCH_COLORS[1]
}
