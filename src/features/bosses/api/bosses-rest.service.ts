import { apiUrl } from '@/lib/api-base-url'
import type { RecentBossFightsResponse } from '../types/recent-boss-fights-response'
import type { RecentBossesResponse } from '../types/recent-bosses-response'

export const BossesRestService = {
  listRecentBosses: async (): Promise<RecentBossesResponse> => {
    const response = await fetch(apiUrl('/api/bosses/recent'))

    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      throw new Error(data.error ?? 'Failed to fetch recent bosses.')
    }

    return (await response.json()) as RecentBossesResponse
  },

  listRecentBossFights: async (encounterId: number): Promise<RecentBossFightsResponse> => {
    const response = await fetch(apiUrl(`/api/bosses/${encounterId}/recent-fights`))

    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      throw new Error(data.error ?? 'Failed to fetch recent boss fights.')
    }

    return (await response.json()) as RecentBossFightsResponse
  },
}
