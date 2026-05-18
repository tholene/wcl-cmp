import type {
  PlayerAnalysisBenchmarkSummary,
  PlayerAnalysisExportFile,
  PlayerAnalysisExportJob,
  PlayerAnalysisExportView,
  PlayerAnalysisJobStatus,
  PlayerAnalysisViewSummary,
  PlayerAnalysisWarningGroups,
} from './player-analysis.types'

const exportJobs = new Map<string, PlayerAnalysisExportJob>()

const now = (): string => new Date().toISOString()

const recalcPercent = (job: PlayerAnalysisExportJob): number => {
  if (job.totalSteps <= 0) return 0
  return Math.min(100, Math.round((job.completedSteps / job.totalSteps) * 100))
}

export const JobStore = {
  create(exportId: string, totalSteps: number): PlayerAnalysisExportJob {
    const job: PlayerAnalysisExportJob = {
      exportId,
      status: 'queued',
      currentStep: 'Queued',
      completedSteps: 0,
      totalSteps,
      percentComplete: 0,
      warnings: [],
      errors: [],
      warningGroups: {},
      createdAt: now(),
      updatedAt: now(),
    }
    exportJobs.set(exportId, job)
    return job
  },

  get(exportId: string): PlayerAnalysisExportJob | undefined {
    return exportJobs.get(exportId)
  },

  setStep(
    exportId: string,
    currentStep: string,
    opts?: {
      view?: PlayerAnalysisExportView
      reportCode?: string
      fightId?: number
      playerName?: string
    }
  ): void {
    const job = exportJobs.get(exportId)
    if (!job) return
    job.status = 'running'
    job.currentStep = currentStep
    if (opts?.view !== undefined) job.currentView = opts.view
    if (opts?.reportCode !== undefined) job.currentReportCode = opts.reportCode
    if (opts?.fightId !== undefined) job.currentFightId = opts.fightId
    if (opts?.playerName !== undefined) job.currentPlayerName = opts.playerName
    job.updatedAt = now()
  },

  advance(exportId: string): void {
    const job = exportJobs.get(exportId)
    if (!job) return
    job.completedSteps += 1
    job.percentComplete = recalcPercent(job)
    job.updatedAt = now()
  },

  addWarning(exportId: string, warning: string): void {
    const job = exportJobs.get(exportId)
    if (!job) return
    job.warnings.push(warning)
    job.updatedAt = now()
  },

  complete(
    exportId: string,
    files: PlayerAnalysisExportFile[],
    details?: {
      warnings?: string[]
      errors?: string[]
      warningGroups?: PlayerAnalysisWarningGroups
      benchmarkSummary?: PlayerAnalysisBenchmarkSummary
      viewSummary?: PlayerAnalysisViewSummary
      currentStep?: string
    }
  ): void {
    const job = exportJobs.get(exportId)
    if (!job) return
    job.status = 'complete'
    job.files = files
    if (details?.warnings) job.warnings = [...job.warnings, ...details.warnings]
    if (details?.errors) job.errors = [...job.errors, ...details.errors]
    if (details?.warningGroups) job.warningGroups = details.warningGroups
    if (details?.benchmarkSummary) job.benchmarkSummary = details.benchmarkSummary
    if (details?.viewSummary) job.viewSummary = details.viewSummary
    job.completedSteps = job.totalSteps
    job.percentComplete = 100
    job.currentStep = details?.currentStep ?? 'Export complete.'
    job.updatedAt = now()
  },

  partial(
    exportId: string,
    files: PlayerAnalysisExportFile[],
    details?: {
      warnings?: string[]
      errors?: string[]
      warningGroups?: PlayerAnalysisWarningGroups
      benchmarkSummary?: PlayerAnalysisBenchmarkSummary
      viewSummary?: PlayerAnalysisViewSummary
      currentStep?: string
    }
  ): void {
    const job = exportJobs.get(exportId)
    if (!job) return
    job.status = 'partial'
    job.files = files
    if (details?.warnings) job.warnings = [...job.warnings, ...details.warnings]
    if (details?.errors) job.errors = [...job.errors, ...details.errors]
    if (details?.warningGroups) job.warningGroups = details.warningGroups
    if (details?.benchmarkSummary) job.benchmarkSummary = details.benchmarkSummary
    if (details?.viewSummary) job.viewSummary = details.viewSummary
    job.completedSteps = job.totalSteps
    job.percentComplete = 100
    job.currentStep = details?.currentStep ?? 'Export complete with partial data.'
    job.updatedAt = now()
  },

  fail(
    exportId: string,
    error: string,
    details?: {
      files?: PlayerAnalysisExportFile[]
      warnings?: string[]
      errors?: string[]
      warningGroups?: PlayerAnalysisWarningGroups
      benchmarkSummary?: PlayerAnalysisBenchmarkSummary
      viewSummary?: PlayerAnalysisViewSummary
      currentStep?: string
    }
  ): void {
    const job = exportJobs.get(exportId)
    if (!job) return
    job.status = 'failed'
    job.error = error
    if (details?.files) job.files = details.files
    if (details?.warnings) job.warnings = [...job.warnings, ...details.warnings]
    if (details?.errors) job.errors = [...job.errors, ...details.errors]
    if (details?.warningGroups) job.warningGroups = details.warningGroups
    if (details?.benchmarkSummary) job.benchmarkSummary = details.benchmarkSummary
    if (details?.viewSummary) job.viewSummary = details.viewSummary
    if (details?.currentStep) job.currentStep = details.currentStep
    job.updatedAt = now()
  },

  setStatus(exportId: string, status: PlayerAnalysisJobStatus): void {
    const job = exportJobs.get(exportId)
    if (!job) return
    job.status = status
    job.updatedAt = now()
  },
}
