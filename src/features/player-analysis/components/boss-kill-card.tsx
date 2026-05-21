import type { FC } from 'react'
import { getDifficultyLabel } from '@/lib/difficulty'
import { cn } from '@/lib/utils'

type Props = {
  encounterName: string
  difficulty: number
  durationMs: number
  startTime: number
  playerItemLevel?: number | null
  reportCode: string
  fightId: number
  isSelected: boolean
  onClick: () => void
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(Math.floor(durationMs / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getDifficultyBadgeClass(difficulty: number): string {
  switch (difficulty) {
    case 5:
      return 'bg-fuchsia-900/40 text-fuchsia-300 border border-fuchsia-700/40'
    case 4:
      return 'bg-indigo-900/40 text-indigo-300 border border-indigo-700/40'
    case 3:
      return 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40'
    default:
      return 'bg-slate-800 text-slate-400 border border-slate-700'
  }
}

export const BossKillCard: FC<Props> = ({
  encounterName,
  difficulty,
  durationMs,
  startTime,
  playerItemLevel,
  isSelected,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full rounded-xl border p-4 text-left transition-colors',
      isSelected
        ? 'border-violet-500 bg-violet-900/20'
        : 'border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900/80',
    )}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="text-base font-semibold text-slate-100">{encounterName}</span>
      <span className={cn('shrink-0 rounded px-2 py-0.5 text-xs font-medium', getDifficultyBadgeClass(difficulty))}>
        {getDifficultyLabel(difficulty)}
      </span>
    </div>
    <div className="mt-1.5 flex flex-wrap gap-3 text-sm text-slate-400">
      <span>{formatDuration(durationMs)}</span>
      {playerItemLevel != null && <span>{playerItemLevel} ilvl</span>}
      <span>{new Date(startTime).toLocaleDateString()}</span>
    </div>
  </button>
)
