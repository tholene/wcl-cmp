import type { FC } from 'react'
import { useParams } from 'react-router-dom'
import { FightReviewPage } from '../components/fight-review-page'
import { useFightReview } from '../hooks/use-fight-review'

export const FightReviewContainer: FC = () => {
  const params = useParams()
  const reportCode = params.code
  const fightIdValue = Number(params.fightId)
  const fightId = Number.isFinite(fightIdValue) && fightIdValue > 0 ? fightIdValue : undefined

  const fightReviewQuery = useFightReview(reportCode, fightId)

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

  if (fightReviewQuery.isPending) {
    return <p className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">Loading fight review...</p>
  }

  if (fightReviewQuery.error) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        <p className="font-medium">Could not load fight review.</p>
        <p className="mt-1 text-rose-100">{fightReviewQuery.error.message}</p>
      </div>
    )
  }

  return <FightReviewPage review={fightReviewQuery.data} />
}