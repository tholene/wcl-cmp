import { PlayersRestService } from '../api/players-rest.service'
import type { PlayerFightReview } from '../types/player-fight-review'

export const PlayersService = {
  getPlayerFightReview: async (code: string, fightId: number, playerId: number): Promise<PlayerFightReview> =>
    PlayersRestService.getPlayerFightReview(code, fightId, playerId),
}