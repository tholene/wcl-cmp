import { apiUrl } from '@/lib/api-base-url'
import type { ApiErrorResponse } from '@/features/reports/types/api-error-response'
import type { PlayerFightReview } from '../types/player-fight-review'

export const PlayersRestService = {
  getPlayerFightReview: async (code: string, fightId: number, playerId: number): Promise<PlayerFightReview> => {
    const response = await fetch(apiUrl(`/api/reports/${code}/fights/${fightId}/players/${playerId}/review`))

    if (!response.ok) {
      const data = (await response.json()) as ApiErrorResponse
      throw new Error(data.error ?? 'Failed to fetch player fight review.')
    }

    return (await response.json()) as PlayerFightReview
  },
}