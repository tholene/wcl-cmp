import { useQuery } from '@tanstack/react-query'
import { playersQueryKeys } from '@/lib/query-keys'
import { PlayersService } from '../services/players.service'

export const usePlayerFightReview = (code?: string, fightId?: number, playerId?: number) =>
  useQuery({
    queryKey: playersQueryKeys.fightReview(code ?? 'missing', fightId ?? -1, playerId ?? -1),
    queryFn: () => PlayersService.getPlayerFightReview(code ?? '', fightId ?? -1, playerId ?? -1),
    enabled:
      Boolean(code) && Number.isFinite(fightId) && (fightId ?? 0) > 0 && Number.isFinite(playerId) && (playerId ?? 0) > 0,
  })