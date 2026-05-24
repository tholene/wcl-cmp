import { useMutation } from '@tanstack/react-query'
import { PlayerAnalysisService } from '../services/player-analysis.service'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import type { PlayerAnalysisExportRequest } from '../types/player-analysis.types'

export const usePlayerAnalysisPreview = (context: AppSettingsRequestContext) =>
  useMutation({
    mutationFn: (request: PlayerAnalysisExportRequest) => PlayerAnalysisService.getExportPreview(request, context),
  })
