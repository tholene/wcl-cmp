import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { rosterReviewQueryKeys } from '@/lib/query-keys'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import { RosterReviewService } from '../services/roster-review.service'
import type { RosterEvidenceJob, RosterEvidenceRequest, RosterEvidenceResult } from '../types/roster-review.types'

const isTerminal = (job: RosterEvidenceJob | undefined): boolean =>
  job?.status === 'complete' || job?.status === 'partial' || job?.status === 'failed'

type UseRosterEvidenceJobOptions = {
  onResult: (result: RosterEvidenceResult, job: RosterEvidenceJob) => void
}

/** Start an evidence job and poll it until it reaches a terminal state. */
export const useRosterEvidenceJob = (context: AppSettingsRequestContext, options: UseRosterEvidenceJobOptions) => {
  const [jobId, setJobId] = useState<string | null>(null)
  const deliveredJobId = useRef<string | null>(null)

  const startMutation = useMutation({
    mutationFn: (request: RosterEvidenceRequest) => RosterReviewService.startEvidenceJob(request, context),
    onSuccess: (response) => setJobId(response.jobId),
  })

  const statusQuery = useQuery({
    queryKey: rosterReviewQueryKeys.evidenceJob(jobId ?? 'none'),
    queryFn: () => RosterReviewService.getEvidenceJob(jobId as string),
    enabled: jobId !== null,
    refetchInterval: (query) => (isTerminal(query.state.data) ? false : 1200),
    // Officers often switch tabs while evidence builds; keep polling in the background.
    refetchIntervalInBackground: true,
  })

  const job = statusQuery.data
  const { onResult } = options

  useEffect(() => {
    if (!jobId || !job || deliveredJobId.current === jobId) return
    if (!isTerminal(job)) return
    deliveredJobId.current = jobId
    if (job.result) onResult(job.result, job)
  }, [job, jobId, onResult])

  const reset = () => {
    setJobId(null)
    deliveredJobId.current = null
    startMutation.reset()
  }

  return {
    start: startMutation.mutate,
    isStarting: startMutation.isPending,
    startError: startMutation.error instanceof Error ? startMutation.error.message : null,
    pollError: statusQuery.error instanceof Error ? statusQuery.error.message : null,
    job,
    jobId,
    isRunning: jobId !== null && !isTerminal(job),
    reset,
  }
}
