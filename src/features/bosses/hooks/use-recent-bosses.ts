import { useQuery } from '@tanstack/react-query'
import { bossesQueryKeys } from '@/lib/query-keys'
import { BossesService } from '../services/bosses.service'

export const useRecentBosses = () =>
  useQuery({
    queryKey: bossesQueryKeys.recent(),
    queryFn: BossesService.listRecentBosses,
  })
