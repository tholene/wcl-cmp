import type { BossFightListItem } from '../types/boss-fight-list-item'
import type { BossSummary } from '../types/boss-summary'

const formatDateTime = (value: number): string => new Date(value).toLocaleString()

const formatDuration = (value: number): string => {
  const totalSeconds = Math.max(Math.floor(value / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

export const BossesMapper = {
  formatLastSeen: (boss: Pick<BossSummary, 'lastSeenAt'>): string => formatDateTime(boss.lastSeenAt),

  formatFightDate: (fight: Pick<BossFightListItem, 'startTime'>): string => formatDateTime(fight.startTime),

  formatDifficulties: (difficulties: number[]): string => {
    if (!difficulties.length) {
      return '—'
    }

    return difficulties.sort((left, right) => left - right).join(', ')
  },

  formatKillRate: (boss: Pick<BossSummary, 'killCount' | 'pullCount'>): string => {
    if (!boss.pullCount) {
      return '0%'
    }

    const killRate = Math.round((boss.killCount / boss.pullCount) * 100)
    return `${killRate}%`
  },

  formatFightDuration: (fight: Pick<BossFightListItem, 'durationMs'>): string => formatDuration(fight.durationMs),
}
