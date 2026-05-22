import { apiFetch } from '@/lib/http-client'
import { apiUrl } from '@/lib/api-base-url'
import type { FightReview } from '../types/fight-review'

export const FightsRestService = {
  getFightReview: (code: string, fightId: number): Promise<FightReview> =>
    apiFetch(apiUrl(`/api/reports/${code}/fights/${fightId}/review`)),
}
