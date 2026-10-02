import { useEffect, useRef, useState } from 'react'
import { MechanicAuditService } from '../services/mechanic-audit.service'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import type { MechanicAuditJob, MechanicAuditRequest } from '../types/mechanic-audit.types'

export function useMechanicAuditExportJob(context: AppSettingsRequestContext) {
  const [auditId, setAuditId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<MechanicAuditJob | null>(null)
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

  const startExport = async (request: MechanicAuditRequest) => {
    stopPolling()
    setIsStarting(true)
    setStartError(null)
    setPollError(null)
    setJobStatus(null)
    setAuditId(null)
    pollFailuresRef.current = 0

    try {
      const start = await MechanicAuditService.startExport(request, context)
      setAuditId(start.auditId)

      pollingRef.current = setInterval(async () => {
        try {
          const status = await MechanicAuditService.getExportStatus(start.auditId)
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
    setAuditId(null)
    setJobStatus(null)
    setIsStarting(false)
    setStartError(null)
    setPollError(null)
    pollFailuresRef.current = 0
  }

  useEffect(() => stopPolling, [])

  return { startExport, auditId, jobStatus, isStarting, startError, pollError, reset }
}
