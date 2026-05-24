import { describe, expect, it } from 'vitest'
import {
  validateExportBenchmarkRequest,
  validateExportStartRequest,
} from '../player-analysis-export.service'
import type {
  PlayerAnalysisExportRequest,
  SelectedBenchmarkCandidate,
} from '../player-analysis.types'

const makeBaseRequest = (): PlayerAnalysisExportRequest => ({
  playerName: 'Fink',
  includeKills: true,
  includeWipes: true,
  views: ['fightMetadata'],
})

const makeCandidate = (
  overrides: Partial<SelectedBenchmarkCandidate> = {}
): SelectedBenchmarkCandidate => ({
  baselineReportCode: 'BASE1',
  baselineFightId: 10,
  baselineEncounterId: 301,
  baselineEncounterName: 'Raid Boss',
  baselineDifficulty: 5,
  baselineDurationMs: 240000,
  benchmarkPlayerName: 'BenchmarkPlayer',
  benchmarkReportCode: 'BENCH1',
  benchmarkFightId: 11,
  benchmarkEncounterId: 301,
  benchmarkDifficulty: 5,
  benchmarkClassName: 'Rogue',
  benchmarkSpecName: 'Assassination',
  benchmarkPercentile: 90,
  ...overrides,
})

describe('validateExportBenchmarkRequest', () => {
  it('returns none mode when benchmark is not requested', () => {
    const result = validateExportBenchmarkRequest(makeBaseRequest())

    expect(result.benchmarkRequested).toBe(false)
    expect(result.benchmarkMode).toBe('none')
    expect(result.allowSubjectOnlyWithoutBenchmark).toBe(false)
    expect(result.blockedReason).toBeNull()
    expect(result.manualTarget).toBeNull()
    expect(result.exportableSelectedCandidates).toEqual([])
  })

  it('blocks manual mode when manual target is incomplete', () => {
    const request: PlayerAnalysisExportRequest = {
      ...makeBaseRequest(),
      benchmark: {
        requested: true,
        mode: 'manual',
        manualTarget: {
          reportCode: '',
          fightId: 0,
          playerName: '',
        },
      },
    }

    const result = validateExportBenchmarkRequest(request)

    expect(result.benchmarkRequested).toBe(true)
    expect(result.benchmarkMode).toBe('manual')
    expect(result.manualTarget).toBeNull()
    expect(result.blockedReason).toContain('Manual benchmark target is incomplete')
    expect(result.blockedReason).toContain('reportCode')
    expect(result.blockedReason).toContain('fightId')
    expect(result.blockedReason).toContain('playerName')
  })

  it('returns manual target when manual mode target is complete', () => {
    const request: PlayerAnalysisExportRequest = {
      ...makeBaseRequest(),
      benchmark: {
        requested: true,
        mode: 'manual',
        manualTarget: {
          reportCode: 'ABC123',
          fightId: 12,
          playerName: 'Katie',
        },
      },
    }

    const result = validateExportBenchmarkRequest(request)

    expect(result.benchmarkMode).toBe('manual')
    expect(result.blockedReason).toBeNull()
    expect(result.manualTarget).toEqual({
      reportCode: 'ABC123',
      fightId: 12,
      playerName: 'Katie',
    })
  })

  it('auto mode filters non-exportable candidates and blocks when none are exportable', () => {
    const request: PlayerAnalysisExportRequest = {
      ...makeBaseRequest(),
      benchmark: {
        requested: true,
        mode: 'auto',
        selectedCandidates: [
          makeCandidate({ benchmarkPlayerName: 'Anonymous' }),
          makeCandidate({ benchmarkReportCode: '   ' }),
          makeCandidate({ benchmarkFightId: 0 }),
        ],
      },
    }

    const result = validateExportBenchmarkRequest(request)

    expect(result.benchmarkMode).toBe('auto')
    expect(result.exportableSelectedCandidates).toEqual([])
    expect(result.blockedReason).toContain('Auto benchmark requires at least one exportable selected candidate')
  })

  it('auto mode passes when at least one exportable selected candidate exists', () => {
    const validCandidate = makeCandidate()
    const request: PlayerAnalysisExportRequest = {
      ...makeBaseRequest(),
      benchmark: {
        requested: true,
        mode: 'auto',
        selectedCandidates: [
          makeCandidate({ benchmarkPlayerName: 'Hidden Player' }),
          validCandidate,
        ],
      },
    }

    const result = validateExportBenchmarkRequest(request)

    expect(result.benchmarkMode).toBe('auto')
    expect(result.blockedReason).toBeNull()
    expect(result.exportableSelectedCandidates).toEqual([validCandidate])
  })
})

describe('validateExportStartRequest', () => {
  it('throws when benchmark is blocked and subject-only override is disabled', () => {
    const request: PlayerAnalysisExportRequest = {
      ...makeBaseRequest(),
      benchmark: {
        requested: true,
        mode: 'auto',
        selectedCandidates: [makeCandidate({ benchmarkPlayerName: 'Hidden Candidate' })],
      },
    }

    expect(() => validateExportStartRequest(request)).toThrow(
      'Enable "Export subject-only data without benchmark comparison." to continue without benchmark files.'
    )
  })

  it('does not throw when benchmark is blocked but subject-only override is enabled', () => {
    const request: PlayerAnalysisExportRequest = {
      ...makeBaseRequest(),
      benchmark: {
        requested: true,
        mode: 'auto',
        allowSubjectOnlyWithoutBenchmark: true,
        selectedCandidates: [makeCandidate({ benchmarkPlayerName: 'Hidden Candidate' })],
      },
    }

    expect(() => validateExportStartRequest(request)).not.toThrow()
  })
})

