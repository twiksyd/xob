export const BATCH_COLORS = [
  // ── Primary palette (shown in the color picker) ───────────────────────────
  { key: 'green',  label: 'Sage',    value: '#52A878', soft: 'rgba(82,168,120,0.14)',  border: 'rgba(82,168,120,0.52)'  },
  { key: 'blue',   label: 'Cobalt',  value: '#4870A8', soft: 'rgba(72,112,168,0.14)',  border: 'rgba(72,112,168,0.52)'  },
  { key: 'purple', label: 'Dusk',    value: '#7B6EAB', soft: 'rgba(123,110,171,0.14)', border: 'rgba(123,110,171,0.52)' },
  { key: 'amber',  label: 'Amber',   value: '#C49A36', soft: 'rgba(196,154,54,0.14)',  border: 'rgba(196,154,54,0.52)'  },
  { key: 'rose',   label: 'Rose',    value: '#B8607A', soft: 'rgba(184,96,122,0.14)',  border: 'rgba(184,96,122,0.52)'  },
  { key: 'cyan',   label: 'Steel',   value: '#4A8EA2', soft: 'rgba(74,142,162,0.14)',  border: 'rgba(74,142,162,0.52)'  },
  { key: 'slate',  label: 'Slate',   value: '#607888', soft: 'rgba(96,120,136,0.14)',  border: 'rgba(96,120,136,0.50)'  },
  { key: 'red',    label: 'Crimson', value: '#A85E5E', soft: 'rgba(168,94,94,0.14)',   border: 'rgba(168,94,94,0.52)'   },
  // ── Legacy aliases — DB compat only, never shown in the picker ────────────
  { key: 'orange', label: 'Amber',   value: '#C49A36', soft: 'rgba(196,154,54,0.14)',  border: 'rgba(196,154,54,0.52)'  },
  { key: 'yellow', label: 'Amber',   value: '#C49A36', soft: 'rgba(196,154,54,0.14)',  border: 'rgba(196,154,54,0.52)'  },
  { key: 'gray',   label: 'Slate',   value: '#607888', soft: 'rgba(96,120,136,0.14)',  border: 'rgba(96,120,136,0.50)'  },
  { key: 'pink',   label: 'Rose',    value: '#B8607A', soft: 'rgba(184,96,122,0.14)',  border: 'rgba(184,96,122,0.52)'  },
  { key: 'brown',  label: 'Slate',   value: '#607888', soft: 'rgba(96,120,136,0.14)',  border: 'rgba(96,120,136,0.50)'  },
] as const

export type BatchColorKey = typeof BATCH_COLORS[number]['key']

// The 8 primary colors available in the color picker (excludes legacy aliases)
export const BATCH_PALETTE = BATCH_COLORS.slice(0, 8)

export function getBatchColor(key?: string | null) {
  return BATCH_COLORS.find(color => color.key === key) ?? BATCH_COLORS[1]
}
