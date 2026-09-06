export const formatPercentile = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : `${Math.round(value)}`

export const formatIlvl = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : `${Math.round(value)}`

export const formatAmount = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return `${Math.round(value)}`
}

export const formatDate = (epochMs: number | null | undefined): string => {
  if (!epochMs) return 'unknown date'
  return new Date(epochMs).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export const formatDateTime = (epochMs: number | null | undefined): string => {
  if (!epochMs) return 'unknown'
  return new Date(epochMs).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const formatFraction = (part: number, total: number): string => `${part}/${total}`
