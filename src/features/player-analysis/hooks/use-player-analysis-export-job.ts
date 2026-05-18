import { useEffect, useRef, useState } from 'react'
import { PlayerAnalysisService } from '../services/player-analysis.service'
import type { PlayerAnalysisExportJob, PlayerAnalysisExportRequest } from '../types/player-analysis.types'

export function usePlayerAnalysisExportJob() {
  const [exportId, setExportId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<PlayerAnalysisExportJob | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollFailuresRef = useRef(0)

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
    setPollError(null)
    setJobStatus(null)
    setExportId(null)
    pollFailuresRef.current = 0

    try {
      const start = await PlayerAnalysisService.startExport(request)
      setExportId(start.exportId)

      pollingRef.current = setInterval(async () => {
        try {
          const status = await PlayerAnalysisService.getExportStatus(start.exportId)
          pollFailuresRef.current = 0
          setPollError(null)
          setJobStatus(status)
          if (status.status === 'complete' || status.status === 'partial' || status.status === 'failed') {
            stopPolling()
          }
        } catch (error) {
          pollFailuresRef.current += 1
          if (pollFailuresRef.current >= 3) {
            const message = error instanceof Error ? error.message : 'Status polling failed.'
            setPollError(`Status polling is failing repeatedly: ${message}`)
          }
          if (pollFailuresRef.current >= 6) {
            stopPolling()
          }
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
    setPollError(null)
    pollFailuresRef.current = 0
  }

  useEffect(() => stopPolling, [])

  return { startExport, exportId, jobStatus, isStarting, startError, pollError, reset }
}
