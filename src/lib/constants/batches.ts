export const BATCH_COLORS = [
  // ── Primary luxury palette (shown in the color picker) ────────────────────
  { key: 'green',  label: 'Green',  value: '#3CBF7A', soft: 'rgba(60,191,122,0.16)',  border: 'rgba(60,191,122,0.55)'  },
  { key: 'blue',   label: 'Blue',   value: '#4B7DFF', soft: 'rgba(75,125,255,0.16)',  border: 'rgba(75,125,255,0.55)'  },
  { key: 'purple', label: 'Purple', value: '#8B5CF6', soft: 'rgba(139,92,246,0.16)',  border: 'rgba(139,92,246,0.55)'  },
  { key: 'amber',  label: 'Amber',  value: '#D4A441', soft: 'rgba(212,164,65,0.16)',  border: 'rgba(212,164,65,0.55)'  },
  { key: 'rose',   label: 'Rose',   value: '#C85D8E', soft: 'rgba(200,93,142,0.16)',  border: 'rgba(200,93,142,0.55)'  },
  { key: 'cyan',   label: 'Cyan',   value: '#39A8C7', soft: 'rgba(57,168,199,0.16)',  border: 'rgba(57,168,199,0.55)'  },
  { key: 'slate',  label: 'Slate',  value: '#60738A', soft: 'rgba(96,115,138,0.16)',  border: 'rgba(96,115,138,0.55)'  },
  { key: 'red',    label: 'Red',    value: '#C45A5A', soft: 'rgba(196,90,90,0.16)',   border: 'rgba(196,90,90,0.55)'   },
  // ── Legacy aliases — DB compat only, never shown in the picker ────────────
  { key: 'orange', label: 'Amber',  value: '#D4A441', soft: 'rgba(212,164,65,0.16)',  border: 'rgba(212,164,65,0.55)'  },
  { key: 'yellow', label: 'Amber',  value: '#D4A441', soft: 'rgba(212,164,65,0.16)',  border: 'rgba(212,164,65,0.55)'  },
  { key: 'gray',   label: 'Slate',  value: '#60738A', soft: 'rgba(96,115,138,0.16)',  border: 'rgba(96,115,138,0.55)'  },
  { key: 'pink',   label: 'Rose',   value: '#C85D8E', soft: 'rgba(200,93,142,0.16)',  border: 'rgba(200,93,142,0.55)'  },
  { key: 'brown',  label: 'Slate',  value: '#60738A', soft: 'rgba(96,115,138,0.16)',  border: 'rgba(96,115,138,0.55)'  },
] as const

export type BatchColorKey = typeof BATCH_COLORS[number]['key']

// The 8 primary colors available in the color picker (excludes legacy aliases)
export const BATCH_PALETTE = BATCH_COLORS.slice(0, 8)

export function getBatchColor(key?: string | null) {
  return BATCH_COLORS.find(color => color.key === key) ?? BATCH_COLORS[1]
}
