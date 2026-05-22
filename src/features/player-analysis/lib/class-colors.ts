import { getWowClassColor } from '@/lib/wow-class'

export function classColor(name: string | null | undefined): string {
  return getWowClassColor(name)
}

export function parseColor(percentile: number): string {
  if (percentile >= 99) return '#e268a8'
  if (percentile >= 95) return '#ff8000'
  if (percentile >= 75) return '#a335ee'
  if (percentile >= 50) return '#0070dd'
  if (percentile >= 25) return '#1eff00'
  return '#666666'
}
