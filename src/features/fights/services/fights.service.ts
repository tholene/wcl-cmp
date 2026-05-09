import { FightsRestService } from '../api/fights-rest.service'
import type { FightReview } from '../types/fight-review'

export const FightsService = {
  getFightReview: async (code: string, fightId: number): Promise<FightReview> =>
    FightsRestService.getFightReview(code, fightId),
}