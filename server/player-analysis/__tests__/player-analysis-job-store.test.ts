import { describe, expect, it } from 'vitest'
import { JobStore } from '../player-analysis-job-store'
import type {
  PlayerAnalysisBenchmarkSummary,
  PlayerAnalysisExportFile,
  PlayerAnalysisExportResultSummary,
  PlayerAnalysisViewSummary,
  PlayerAnalysisWarningGroups,
} from '../player-analysis.types'

const makeExportId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

const makeFile = (filename: string, kind: PlayerAnalysisExportFile['kind']): PlayerAnalysisExportFile => ({
  filename,
  kind,
  sizeBytes: 123,
  downloadUrl: `/api/player-analysis/exports/test/${filename}`,
})

const BENCHMARK_SUMMARY: PlayerAnalysisBenchmarkSummary = {
  requested: true,
  included: true,
  mode: 'auto',
  selectedCount: 1,
  exportedCount: 1,
  skippedCount: 0,
  skippedCandidates: [],
  omittedReason: null,
}

const VIEW_SUMMARY: PlayerAnalysisViewSummary = {
  selectedViews: ['fightMetadata'],
  exportedViews: ['fightMetadata'],
  skippedViews: [],
  truncatedViews: [],
}

const RESULT_SUMMARY: PlayerAnalysisExportResultSummary = {
  readyForChatGpt: true,
  qualityChecks: [],
  topReasons: [],
  summary: {
    playerName: 'Fink',
    nextStepInstruction: 'Review benchmark deltas.',
  },
}

describe('JobStore', () => {
  it('create initializes queued job shape with counters and timestamps', () => {
    const exportId = makeExportId('create')

    const job = JobStore.create(exportId, 5)

    expect(job.exportId).toBe(exportId)
    expect(job.status).toBe('queued')
    expect(job.currentStep).toBe('Queued')
    expect(job.completedSteps).toBe(0)
    expect(job.totalSteps).toBe(5)
    expect(job.percentComplete).toBe(0)
    expect(job.warnings).toEqual([])
    expect(job.errors).toEqual([])
    expect(job.warningGroups).toEqual({})
    expect(Number.isNaN(Date.parse(job.createdAt))).toBe(false)
    expect(Number.isNaN(Date.parse(job.updatedAt))).toBe(false)
    expect(JobStore.get(exportId)).toBe(job)
  })

  it('setStep marks the job as running and records context fields', () => {
    const exportId = makeExportId('set-step')
    JobStore.create(exportId, 3)

    JobStore.setStep(exportId, 'Fetching deaths', {
      view: 'deaths',
      reportCode: 'ABC123',
      fightId: 7,
      playerName: 'Katie',
    })

    const job = JobStore.get(exportId)
    expect(job).toBeDefined()
    expect(job?.status).toBe('running')
    expect(job?.currentStep).toBe('Fetching deaths')
    expect(job?.currentView).toBe('deaths')
    expect(job?.currentReportCode).toBe('ABC123')
    expect(job?.currentFightId).toBe(7)
    expect(job?.currentPlayerName).toBe('Katie')
  })

  it('advance increments completed steps and recalculates percent complete', () => {
    const exportId = makeExportId('advance')
    JobStore.create(exportId, 4)

    JobStore.advance(exportId)
    JobStore.advance(exportId)

    const job = JobStore.get(exportId)
    expect(job?.completedSteps).toBe(2)
    expect(job?.percentComplete).toBe(50)
  })

  it('complete finalizes status/files and merges warnings and errors', () => {
    const exportId = makeExportId('complete')
    JobStore.create(exportId, 2)
    JobStore.addWarning(exportId, 'Existing warning')

    const files = [makeFile('player-fights.csv', 'csv'), makeFile('bundle.zip', 'zip')]
    const warningGroups: PlayerAnalysisWarningGroups = {
      benchmark: ['Benchmark warning'],
    }

    JobStore.complete(exportId, files, {
      warnings: ['Extra warning'],
      errors: ['Non-fatal error'],
      warningGroups,
      benchmarkSummary: BENCHMARK_SUMMARY,
      viewSummary: VIEW_SUMMARY,
      resultSummary: RESULT_SUMMARY,
      currentStep: 'Completed custom step',
    })

    const job = JobStore.get(exportId)
    expect(job?.status).toBe('complete')
    expect(job?.files).toEqual(files)
    expect(job?.warnings).toEqual(['Existing warning', 'Extra warning'])
    expect(job?.errors).toEqual(['Non-fatal error'])
    expect(job?.warningGroups).toEqual(warningGroups)
    expect(job?.benchmarkSummary).toEqual(BENCHMARK_SUMMARY)
    expect(job?.viewSummary).toEqual(VIEW_SUMMARY)
    expect(job?.resultSummary).toEqual(RESULT_SUMMARY)
    expect(job?.completedSteps).toBe(2)
    expect(job?.percentComplete).toBe(100)
    expect(job?.currentStep).toBe('Completed custom step')
  })

  it('complete uses default currentStep when not provided', () => {
    const exportId = makeExportId('complete-default-step')
    JobStore.create(exportId, 1)

    JobStore.complete(exportId, [makeFile('player-fights.csv', 'csv')])

    const job = JobStore.get(exportId)
    expect(job?.status).toBe('complete')
    expect(job?.currentStep).toBe('Export complete.')
    expect(job?.percentComplete).toBe(100)
  })

  it('partial finalizes as partial with default completion step', () => {
    const exportId = makeExportId('partial')
    JobStore.create(exportId, 3)

    JobStore.partial(exportId, [makeFile('player-fights.csv', 'csv')], {
      warnings: ['Missing one fight view'],
    })

    const job = JobStore.get(exportId)
    expect(job?.status).toBe('partial')
    expect(job?.warnings).toEqual(['Missing one fight view'])
    expect(job?.completedSteps).toBe(3)
    expect(job?.percentComplete).toBe(100)
    expect(job?.currentStep).toBe('Export complete with partial data.')
  })

  it('fail marks status failed, sets error, and merges optional details', () => {
    const exportId = makeExportId('fail')
    JobStore.create(exportId, 2)
    JobStore.addWarning(exportId, 'Pre-existing warning')

    const files = [makeFile('manifest.json', 'manifest')]
    const warningGroups: PlayerAnalysisWarningGroups = {
      runtimeApi: ['WCL query timeout'],
    }

    JobStore.fail(exportId, 'Export failed', {
      files,
      warnings: ['Failed after retries'],
      errors: ['Timeout'],
      warningGroups,
      benchmarkSummary: BENCHMARK_SUMMARY,
      viewSummary: VIEW_SUMMARY,
      resultSummary: { ...RESULT_SUMMARY, readyForChatGpt: false },
      currentStep: 'Failure captured',
    })

    const job = JobStore.get(exportId)
    expect(job?.status).toBe('failed')
    expect(job?.error).toBe('Export failed')
    expect(job?.files).toEqual(files)
    expect(job?.warnings).toEqual(['Pre-existing warning', 'Failed after retries'])
    expect(job?.errors).toEqual(['Timeout'])
    expect(job?.warningGroups).toEqual(warningGroups)
    expect(job?.benchmarkSummary).toEqual(BENCHMARK_SUMMARY)
    expect(job?.viewSummary).toEqual(VIEW_SUMMARY)
    expect(job?.currentStep).toBe('Failure captured')
  })
})

