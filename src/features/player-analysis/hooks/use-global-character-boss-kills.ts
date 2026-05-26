import { useMutation } from '@tanstack/react-query'
import { PlayerAnalysisService } from '../services/player-analysis.service'
import type { GlobalCharacterBossKillsRequest } from '../types/player-analysis.types'

export const useGlobalCharacterBossKills = () =>
  useMutation({
    mutationFn: (request: GlobalCharacterBossKillsRequest) =>
      PlayerAnalysisService.getGlobalCharacterBossKills(request),
  })
