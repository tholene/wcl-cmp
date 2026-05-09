import type { ApiErrorResponse } from '@/features/reports/types/api-error-response'
import type { FightReview } from '../types/fight-review'

export const FightsRestService = {
  getFightReview: async (code: string, fightId: number): Promise<FightReview> => {
    const response = await fetch(`/api/reports/${code}/fights/${fightId}/review`)

    if (!response.ok) {
      const data = (await response.json()) as ApiErrorResponse
      throw new Error(data.error ?? 'Failed to fetch fight review.')
    }

    return (await response.json()) as FightReview
  },
}