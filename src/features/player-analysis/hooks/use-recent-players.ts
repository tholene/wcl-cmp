import { useQuery } from '@tanstack/react-query'
import { PlayerAnalysisService } from '../services/player-analysis.service'
import { playerAnalysisQueryKeys } from '@/lib/query-keys'

export const useRecentPlayers = () =>
  useQuery({
    queryKey: playerAnalysisQueryKeys.recentPlayers(),
    queryFn: PlayerAnalysisService.getRecentPlayers,
  })
