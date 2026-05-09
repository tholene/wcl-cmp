import type { FightDamageEvent } from '../types/fight-review'

const formatDateTime = (value: number): string => new Date(value).toLocaleString()

const formatDurationFromMilliseconds = (value: number): string => {
  const totalSeconds = Math.max(Math.floor(value / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

const formatRelativeTimestamp = (value: number): string => {
  const totalSeconds = Math.max(Math.floor(value / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatDamageAmount = (value?: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return value.toLocaleString()
}

const formatDamageEventLine = (event: FightDamageEvent): string => {
  const amount = formatDamageAmount(event.amount)
  const source = event.sourceName ?? 'Unknown source'
  return `${event.abilityName} · ${source} · ${amount}`
}

export const FightsMapper = {
  formatDateTime,
  formatDurationFromMilliseconds,
  formatRelativeTimestamp,
  formatDamageAmount,
  formatDamageEventLine,
}