import { useMutation } from '@tanstack/react-query'
import { PlayerAnalysisService } from '../services/player-analysis.service'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import type { BenchmarkCandidatesRequest } from '../types/player-analysis.types'

export const useBenchmarkCandidates = (context: AppSettingsRequestContext) =>
  useMutation({
    mutationFn: (request: BenchmarkCandidatesRequest) => PlayerAnalysisService.getBenchmarkCandidates(request, context),
  })
