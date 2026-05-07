import { useQuery } from '@tanstack/react-query'
import { bossesQueryKeys } from '@/lib/query-keys'
import { BossesService } from '../services/bosses.service'

export const useRecentBossFights = (encounterId?: number) =>
  useQuery({
    queryKey: bossesQueryKeys.recentFights(encounterId ?? -1),
    queryFn: () => BossesService.listRecentBossFights(encounterId ?? -1),
    enabled: Number.isFinite(encounterId),
  })
