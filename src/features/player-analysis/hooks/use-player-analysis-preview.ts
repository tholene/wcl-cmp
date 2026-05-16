import { useMutation } from '@tanstack/react-query'
import { PlayerAnalysisService } from '../services/player-analysis.service'

export const usePlayerAnalysisPreview = () =>
  useMutation({
    mutationFn: PlayerAnalysisService.getExportPreview,
  })
