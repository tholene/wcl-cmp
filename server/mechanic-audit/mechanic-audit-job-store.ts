import type { MechanicAuditExportFile, MechanicAuditExportResultSummary, MechanicAuditJob, MechanicAuditJobStatus } from './mechanic-audit.types'

// Kept as its own store rather than extracting a shared primitive from
// player-analysis-job-store.ts: the two job shapes (view/report/fight/player
// progress fields vs. mechanic-audit's simpler summary shape) have already
// diverged, and extracting a generic primitive mid-feature is a larger, riskier
// change than duplicating ~150 lines of well-understood, already-tested logic.
const auditJobs = new Map<string, MechanicAuditJob>()

const JOB_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

const scheduleCleanup = (auditId: string): void => {
  const timer = setTimeout(() => auditJobs.delete(auditId), JOB_TTL_MS)
  if (typeof timer === 'object' && 'unref' in timer) timer.unref()
}

const now = (): string => new Date().toISOString()

const recalcPercent = (job: MechanicAuditJob): number => {
  if (job.totalSteps <= 0) return 0
  return Math.min(100, Math.round((job.completedSteps / job.totalSteps) * 100))
}

export const MechanicAuditJobStore = {
  create(auditId: string, totalSteps: number): MechanicAuditJob {
    const job: MechanicAuditJob = {
      auditId,
      status: 'queued',
      currentStep: 'Queued',
      completedSteps: 0,
      totalSteps,
      percentComplete: 0,
      warnings: [],
      errors: [],
      createdAt: now(),
      updatedAt: now(),
    }
    auditJobs.set(auditId, job)
    return job
  },

  get(auditId: string): MechanicAuditJob | undefined {
    return auditJobs.get(auditId)
  },

  setStep(auditId: string, currentStep: string): void {
    const job = auditJobs.get(auditId)
    if (!job) return
    job.status = 'running'
    job.currentStep = currentStep
    job.updatedAt = now()
  },

  advance(auditId: string): void {
    const job = auditJobs.get(auditId)
    if (!job) return
    job.completedSteps += 1
    job.percentComplete = recalcPercent(job)
    job.updatedAt = now()
  },

  addWarning(auditId: string, warning: string): void {
    const job = auditJobs.get(auditId)
    if (!job) return
    job.warnings.push(warning)
    job.updatedAt = now()
  },

  complete(
    auditId: string,
    files: MechanicAuditExportFile[],
    details?: { warnings?: string[]; resultSummary?: MechanicAuditExportResultSummary; currentStep?: string }
  ): void {
    const job = auditJobs.get(auditId)
    if (!job) return
    job.status = 'complete'
    job.files = files
    if (details?.warnings) job.warnings = [...job.warnings, ...details.warnings]
    if (details?.resultSummary) job.resultSummary = details.resultSummary
    job.completedSteps = job.totalSteps
    job.percentComplete = 100
    job.currentStep = details?.currentStep ?? 'Export complete.'
    job.updatedAt = now()
    scheduleCleanup(auditId)
  },

  partial(
    auditId: string,
    files: MechanicAuditExportFile[],
    details?: { warnings?: string[]; resultSummary?: MechanicAuditExportResultSummary; currentStep?: string }
  ): void {
    const job = auditJobs.get(auditId)
    if (!job) return
    job.status = 'partial'
    job.files = files
    if (details?.warnings) job.warnings = [...job.warnings, ...details.warnings]
    if (details?.resultSummary) job.resultSummary = details.resultSummary
    job.completedSteps = job.totalSteps
    job.percentComplete = 100
    job.currentStep = details?.currentStep ?? 'Export complete with partial data.'
    job.updatedAt = now()
    scheduleCleanup(auditId)
  },

  fail(auditId: string, error: string, details?: { warnings?: string[]; currentStep?: string }): void {
    const job = auditJobs.get(auditId)
    if (!job) return
    job.status = 'failed'
    job.error = error
    if (details?.warnings) job.warnings = [...job.warnings, ...details.warnings]
    if (details?.currentStep) job.currentStep = details.currentStep
    job.updatedAt = now()
    scheduleCleanup(auditId)
  },

  setStatus(auditId: string, status: MechanicAuditJobStatus): void {
    const job = auditJobs.get(auditId)
    if (!job) return
    job.status = status
    job.updatedAt = now()
  },
}
