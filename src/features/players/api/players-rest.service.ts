import { apiFetch } from '@/lib/http-client'
import { apiUrl } from '@/lib/api-base-url'
import type { PlayerFightReview } from '../types/player-fight-review'

export const PlayersRestService = {
  getPlayerFightReview: (code: string, fightId: number, playerId: number): Promise<PlayerFightReview> =>
    apiFetch(apiUrl(`/api/reports/${code}/fights/${fightId}/players/${playerId}/review`)),
}
