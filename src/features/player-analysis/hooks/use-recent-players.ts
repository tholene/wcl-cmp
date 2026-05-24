import { useQuery } from '@tanstack/react-query'
import { PlayerAnalysisService } from '../services/player-analysis.service'
import { playerAnalysisQueryKeys } from '@/lib/query-keys'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'

export const useRecentPlayers = (context: AppSettingsRequestContext) =>
  useQuery({
    queryKey: playerAnalysisQueryKeys.recentPlayers(context),
    queryFn: () => PlayerAnalysisService.getRecentPlayers(context),
  })
