import { useEffect, useRef, useState } from 'react'
import { PlayerAnalysisService } from '../services/player-analysis.service'
import type { PlayerAnalysisExportJob, PlayerAnalysisExportRequest } from '../types/player-analysis.types'

export function usePlayerAnalysisExportJob() {
  const [exportId, setExportId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<PlayerAnalysisExportJob | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const startExport = async (request: PlayerAnalysisExportRequest) => {
    stopPolling()
    setIsStarting(true)
    setStartError(null)
    setJobStatus(null)
    setExportId(null)

    try {
      const start = await PlayerAnalysisService.startExport(request)
      setExportId(start.exportId)

      pollingRef.current = setInterval(async () => {
        try {
          const status = await PlayerAnalysisService.getExportStatus(start.exportId)
          setJobStatus(status)
          if (status.status === 'complete' || status.status === 'partial' || status.status === 'failed') {
            stopPolling()
          }
        } catch {
          // Non-fatal poll failure — keep polling
        }
      }, 1500)
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Failed to start export.')
    } finally {
      setIsStarting(false)
    }
  }

  const reset = () => {
    stopPolling()
    setExportId(null)
    setJobStatus(null)
    setIsStarting(false)
    setStartError(null)
  }

  useEffect(() => stopPolling, [])

  return { startExport, exportId, jobStatus, isStarting, startError, reset }
}
