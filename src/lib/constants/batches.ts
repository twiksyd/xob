export const BATCH_COLORS = [
  // ── Primary palette (shown in the color picker) ───────────────────────────
  { key: 'green',  label: 'Emerald',  value: '#10A86E', soft: 'rgba(16,168,110,0.10)',  border: 'rgba(16,168,110,0.42)'  },
  { key: 'blue',   label: 'Sapphire', value: '#2B72D8', soft: 'rgba(43,114,216,0.10)',  border: 'rgba(43,114,216,0.42)'  },
  { key: 'purple', label: 'Violet',   value: '#7040D0', soft: 'rgba(112,64,208,0.10)',  border: 'rgba(112,64,208,0.42)'  },
  { key: 'amber',  label: 'Amber',    value: '#C07A12', soft: 'rgba(192,122,18,0.10)',  border: 'rgba(192,122,18,0.42)'  },
  { key: 'rose',   label: 'Rose',     value: '#B0365E', soft: 'rgba(176,54,94,0.10)',   border: 'rgba(176,54,94,0.42)'   },
  { key: 'cyan',   label: 'Teal',     value: '#0E87A8', soft: 'rgba(14,135,168,0.10)',  border: 'rgba(14,135,168,0.42)'  },
  { key: 'slate',  label: 'Slate',    value: '#5A7090', soft: 'rgba(90,112,144,0.10)',  border: 'rgba(90,112,144,0.40)'  },
  { key: 'red',    label: 'Crimson',  value: '#C03838', soft: 'rgba(192,56,56,0.10)',   border: 'rgba(192,56,56,0.42)'   },
  // ── Legacy aliases — DB compat only, never shown in the picker ────────────
  { key: 'orange', label: 'Amber',    value: '#C07A12', soft: 'rgba(192,122,18,0.10)',  border: 'rgba(192,122,18,0.42)'  },
  { key: 'yellow', label: 'Amber',    value: '#C07A12', soft: 'rgba(192,122,18,0.10)',  border: 'rgba(192,122,18,0.42)'  },
  { key: 'gray',   label: 'Slate',    value: '#5A7090', soft: 'rgba(90,112,144,0.10)',  border: 'rgba(90,112,144,0.40)'  },
  { key: 'pink',   label: 'Rose',     value: '#B0365E', soft: 'rgba(176,54,94,0.10)',   border: 'rgba(176,54,94,0.42)'   },
  { key: 'brown',  label: 'Slate',    value: '#5A7090', soft: 'rgba(90,112,144,0.10)',  border: 'rgba(90,112,144,0.40)'  },
] as const

export type BatchColorKey = typeof BATCH_COLORS[number]['key']

// The 8 primary colors available in the color picker (excludes legacy aliases)
export const BATCH_PALETTE = BATCH_COLORS.slice(0, 8)

export function getBatchColor(key?: string | null) {
  return BATCH_COLORS.find(color => color.key === key) ?? BATCH_COLORS[1]
}
