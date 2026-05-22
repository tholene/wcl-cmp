import { apiFetch } from '@/lib/http-client'
import { apiUrl } from '@/lib/api-base-url'
import type { RecentBossFightsResponse } from '../types/recent-boss-fights-response'
import type { RecentBossesResponse } from '../types/recent-bosses-response'

export const BossesRestService = {
  listRecentBosses: (): Promise<RecentBossesResponse> =>
    apiFetch(apiUrl('/api/bosses/recent')),

  listRecentBossFights: (encounterId: number): Promise<RecentBossFightsResponse> =>
    apiFetch(apiUrl(`/api/bosses/${encounterId}/recent-fights`)),
}
