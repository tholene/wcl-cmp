import type { FC } from 'react'
import { cn } from '@/lib/utils'
import { StepDot } from '@/features/player-analysis/components/step-dot'
import { ROSTER_STEP_LABELS } from '../lib/roster-steps'
import type { RosterReviewStep } from '../types/roster-review.types'

type RosterStepperProps = {
  step: RosterReviewStep
  maxReachable: RosterReviewStep
  loadingStep?: RosterReviewStep | null
  onSelect: (step: RosterReviewStep) => void
}

export const RosterStepper: FC<RosterStepperProps> = ({ step, maxReachable, loadingStep, onSelect }) => (
  <nav aria-label="Roster review steps" className="glass flex flex-wrap items-center gap-1 px-2 py-2">
    {ROSTER_STEP_LABELS.map((label, index) => {
      const value = index as RosterReviewStep
      const reachable = value <= maxReachable
      const active = value === step
      return (
        <button
          key={label}
          type="button"
          disabled={!reachable}
          onClick={() => onSelect(value)}
          className={cn(
            'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
            active ? 'bg-indigo-500/15 text-indigo-100' : reachable ? 'text-slate-300 hover:bg-white/[0.05]' : 'text-hint',
            !reachable && 'cursor-not-allowed'
          )}
        >
          <StepDot number={index + 1} completed={value < step} active={active} loading={loadingStep === value} />
          <span>{label}</span>
        </button>
      )
    })}
  </nav>
)
