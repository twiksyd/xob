export const BATCH_COLORS = [
  // ── Primary palette (shown in the color picker) ───────────────────────────
  // Warm, premium tones chosen to stand out against the dark glass UI without
  // blending into the dashboard's own blue / teal / green / purple accent colors.
  { key: 'green',  label: 'Chartreuse', value: '#82B418', soft: 'rgba(130,180,24,0.10)',  border: 'rgba(130,180,24,0.42)'  },
  { key: 'blue',   label: 'Crimson',    value: '#C02E48', soft: 'rgba(192,46,72,0.10)',   border: 'rgba(192,46,72,0.42)'   },
  { key: 'purple', label: 'Magenta',    value: '#A02888', soft: 'rgba(160,40,136,0.10)',  border: 'rgba(160,40,136,0.42)'  },
  { key: 'amber',  label: 'Amber',      value: '#C08820', soft: 'rgba(192,136,32,0.10)',  border: 'rgba(192,136,32,0.42)'  },
  { key: 'rose',   label: 'Rose',       value: '#C84878', soft: 'rgba(200,72,120,0.10)',  border: 'rgba(200,72,120,0.42)'  },
  { key: 'cyan',   label: 'Coral',      value: '#C85838', soft: 'rgba(200,88,56,0.10)',   border: 'rgba(200,88,56,0.42)'   },
  { key: 'slate',  label: 'Copper',     value: '#B07028', soft: 'rgba(176,112,40,0.10)',  border: 'rgba(176,112,40,0.42)'  },
  { key: 'red',    label: 'Burgundy',   value: '#8C2038', soft: 'rgba(140,32,56,0.10)',   border: 'rgba(140,32,56,0.42)'   },
  // ── Legacy aliases — DB compat only, never shown in the picker ────────────
  { key: 'orange', label: 'Coral',      value: '#C85838', soft: 'rgba(200,88,56,0.10)',   border: 'rgba(200,88,56,0.42)'   },
  { key: 'yellow', label: 'Amber',      value: '#C08820', soft: 'rgba(192,136,32,0.10)',  border: 'rgba(192,136,32,0.42)'  },
  { key: 'gray',   label: 'Copper',     value: '#B07028', soft: 'rgba(176,112,40,0.10)',  border: 'rgba(176,112,40,0.42)'  },
  { key: 'pink',   label: 'Rose',       value: '#C84878', soft: 'rgba(200,72,120,0.10)',  border: 'rgba(200,72,120,0.42)'  },
  { key: 'brown',  label: 'Copper',     value: '#B07028', soft: 'rgba(176,112,40,0.10)',  border: 'rgba(176,112,40,0.42)'  },
] as const

export type BatchColorKey = typeof BATCH_COLORS[number]['key']

// The 8 primary colors available in the color picker (excludes legacy aliases)
export const BATCH_PALETTE = BATCH_COLORS.slice(0, 8)

export function getBatchColor(key?: string | null) {
  return BATCH_COLORS.find(color => color.key === key) ?? BATCH_COLORS[1]
}
