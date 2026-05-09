import type { FC } from 'react'
import { useParams } from 'react-router-dom'
import { PlayerFightReviewPage } from '../components/player-fight-review-page'
import { usePlayerFightReview } from '../hooks/use-player-fight-review'

export const PlayerFightReviewContainer: FC = () => {
  const params = useParams()
  const reportCode = params.code
  const fightIdValue = Number(params.fightId)
  const playerIdValue = Number(params.playerId)

  const fightId = Number.isFinite(fightIdValue) && fightIdValue > 0 ? fightIdValue : undefined
  const playerId = Number.isFinite(playerIdValue) && playerIdValue > 0 ? playerIdValue : undefined

  const playerReviewQuery = usePlayerFightReview(reportCode, fightId, playerId)

  if (!reportCode) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        Missing report code in URL.
      </div>
    )
  }

  if (!fightId) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        Invalid fight ID in URL.
      </div>
    )
  }

  if (!playerId) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        Invalid player ID in URL.
      </div>
    )
  }

  if (playerReviewQuery.isPending) {
    return (
      <p className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
        Loading player fight review...
      </p>
    )
  }

  if (playerReviewQuery.error) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        <p className="font-medium">Could not load player fight review.</p>
        <p className="mt-1 text-rose-100">{playerReviewQuery.error.message}</p>
      </div>
    )
  }

  return <PlayerFightReviewPage review={playerReviewQuery.data} />
}