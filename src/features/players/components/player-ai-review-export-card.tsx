import { useState } from 'react'
import type { FC } from 'react'
import type { PlayerFightReview } from '../types/player-fight-review'
import { buildOfficerReviewPrompt, buildPlayerFeedbackPrompt, buildStructuredPlayerReviewJson } from '../utils/player-ai-review-export'

type CopyStatus = 'idle' | 'copied' | 'error'
type CopyKey = 'officer' | 'player' | 'json'

const buttons: Array<{ key: CopyKey; label: string; build: (review: PlayerFightReview) => string }> = [
  { key: 'officer', label: 'Officer Prompt', build: buildOfficerReviewPrompt },
  { key: 'player', label: 'Player Feedback', build: buildPlayerFeedbackPrompt },
  { key: 'json', label: 'Structured JSON', build: buildStructuredPlayerReviewJson },
]

export const PlayerAiReviewExportCard: FC<{ review: PlayerFightReview }> = ({ review }) => {
  const [status, setStatus] = useState<Record<CopyKey, CopyStatus>>({ officer: 'idle', player: 'idle', json: 'idle' })

  const handleCopy = async (key: CopyKey, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setStatus((s) => ({ ...s, [key]: 'copied' }))
      setTimeout(() => setStatus((s) => ({ ...s, [key]: 'idle' })), 2000)
    } catch {
      setStatus((s) => ({ ...s, [key]: 'error' }))
      setTimeout(() => setStatus((s) => ({ ...s, [key]: 'idle' })), 3000)
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">AI Review Export</h3>
      <p className="mt-1 text-xs text-slate-500">Copy a prompt and paste it into ChatGPT or another AI assistant.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {buttons.map(({ key, label, build }) => {
          const s = status[key]
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleCopy(key, build(review))}
              className={`rounded border px-3 py-1.5 text-xs transition-colors ${
                s === 'copied'
                  ? 'border-emerald-700 text-emerald-300'
                  : s === 'error'
                    ? 'border-rose-700 text-rose-300'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {s === 'copied' ? 'Copied!' : s === 'error' ? 'Copy failed' : label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
