import { useQuery } from '@tanstack/react-query'
import { fightsQueryKeys } from '@/lib/query-keys'
import { FightsService } from '../services/fights.service'

export const useFightReview = (code?: string, fightId?: number) =>
  useQuery({
    queryKey: fightsQueryKeys.review(code ?? 'missing', fightId ?? -1),
    queryFn: () => FightsService.getFightReview(code ?? '', fightId ?? -1),
    enabled: Boolean(code) && Number.isFinite(fightId) && (fightId ?? 0) > 0,
  })