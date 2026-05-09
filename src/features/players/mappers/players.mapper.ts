import type { PlayerReviewEvent } from '../types/player-fight-review'

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

const formatAmount = (value?: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return value.toLocaleString()
}

const formatEventLine = (event: PlayerReviewEvent): string => {
  const source = event.sourceName ?? 'Unknown source'
  const target = event.targetName ? ` → ${event.targetName}` : ''
  const amount = formatAmount(event.amount)
  return `${event.abilityName} · ${source}${target} · ${amount}`
}

export const PlayersMapper = {
  formatDateTime,
  formatDurationFromMilliseconds,
  formatRelativeTimestamp,
  formatAmount,
  formatEventLine,
}