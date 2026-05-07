import { BossesRestService } from '../api/bosses-rest.service'
import type { RecentBossFightsResponse } from '../types/recent-boss-fights-response'
import type { RecentBossesResponse } from '../types/recent-bosses-response'

export const BossesService = {
  listRecentBosses: async (): Promise<RecentBossesResponse> => BossesRestService.listRecentBosses(),

  listRecentBossFights: async (encounterId: number): Promise<RecentBossFightsResponse> =>
    BossesRestService.listRecentBossFights(encounterId),
}
