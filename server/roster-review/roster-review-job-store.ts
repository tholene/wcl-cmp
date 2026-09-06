import type { RosterEvidenceJob, RosterEvidenceResult } from './roster-review.types'

const jobs = new Map<string, RosterEvidenceJob>()

const JOB_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours, matches the player-analysis export store

const now = (): string => new Date().toISOString()

const scheduleCleanup = (jobId: string): void => {
  const timer = setTimeout(() => jobs.delete(jobId), JOB_TTL_MS)
  if (typeof timer === 'object' && 'unref' in timer) timer.unref()
}

const recalcPercent = (job: RosterEvidenceJob): number => {
  if (job.totalSteps <= 0) return 0
  return Math.min(100, Math.round((job.completedSteps / job.totalSteps) * 100))
}

export const RosterJobStore = {
  create(jobId: string, totalSteps: number): RosterEvidenceJob {
    const job: RosterEvidenceJob = {
      jobId,
      status: 'queued',
      currentStep: 'Queued',
      completedSteps: 0,
      totalSteps,
      percentComplete: 0,
      warnings: [],
      createdAt: now(),
      updatedAt: now(),
    }
    jobs.set(jobId, job)
    return job
  },

  get(jobId: string): RosterEvidenceJob | undefined {
    return jobs.get(jobId)
  },

  setStep(jobId: string, currentStep: string): void {
    const job = jobs.get(jobId)
    if (!job) return
    job.status = 'running'
    job.currentStep = currentStep
    job.updatedAt = now()
  },

  setTotalSteps(jobId: string, totalSteps: number): void {
    const job = jobs.get(jobId)
    if (!job) return
    job.totalSteps = Math.max(totalSteps, job.completedSteps)
    job.percentComplete = recalcPercent(job)
    job.updatedAt = now()
  },

  advance(jobId: string): void {
    const job = jobs.get(jobId)
    if (!job) return
    job.completedSteps += 1
    job.percentComplete = recalcPercent(job)
    job.updatedAt = now()
  },

  addWarning(jobId: string, warning: string): void {
    const job = jobs.get(jobId)
    if (!job) return
    job.warnings.push(warning)
    job.updatedAt = now()
  },

  complete(jobId: string, result: RosterEvidenceResult, status: 'complete' | 'partial' = 'complete'): void {
    const job = jobs.get(jobId)
    if (!job) return
    job.status = status
    job.result = result
    job.completedSteps = job.totalSteps
    job.percentComplete = 100
    job.currentStep = status === 'complete' ? 'Evidence ready.' : 'Evidence ready with gaps.'
    job.updatedAt = now()
    scheduleCleanup(jobId)
  },

  fail(jobId: string, error: string, result?: RosterEvidenceResult): void {
    const job = jobs.get(jobId)
    if (!job) return
    job.status = 'failed'
    job.error = error
    if (result) job.result = result
    job.currentStep = 'Evidence collection failed.'
    job.updatedAt = now()
    scheduleCleanup(jobId)
  },
}
