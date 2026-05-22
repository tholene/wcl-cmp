import type { PlayerAnalysisExportLimits } from './player-analysis.types'

export const PLAYER_ANALYSIS_EXPORT_DEFAULT_LIMITS: PlayerAnalysisExportLimits = {
  maxReports: 15,
  maxFights: 30,
  maxRowsPerCsv: 20_000,
  maxEventsPerFightPerView: Number.MAX_SAFE_INTEGER,
  maxTotalExportBytes: 25 * 1024 * 1024,
}

export const PLAYER_ANALYSIS_EXPORT_HARD_LIMITS: PlayerAnalysisExportLimits = {
  maxReports: 25,
  maxFights: 60,
  maxRowsPerCsv: 100_000,
  maxEventsPerFightPerView: Number.MAX_SAFE_INTEGER,
  maxTotalExportBytes: 100 * 1024 * 1024,
}

export function clampLimits(requested?: Partial<PlayerAnalysisExportLimits>): {
  limits: PlayerAnalysisExportLimits
  warnings: string[]
} {
  if (!requested) {
    return { limits: { ...PLAYER_ANALYSIS_EXPORT_DEFAULT_LIMITS }, warnings: [] }
  }

  const warnings: string[] = []
  const hard = PLAYER_ANALYSIS_EXPORT_HARD_LIMITS
  const defaults = PLAYER_ANALYSIS_EXPORT_DEFAULT_LIMITS

  const clamp = (field: keyof PlayerAnalysisExportLimits, requested?: number): number => {
    const value = requested ?? defaults[field]
    if (value > hard[field]) {
      warnings.push(`${field} clamped from ${value} to ${hard[field]}`)
      return hard[field]
    }
    return value
  }

  return {
    limits: {
      maxReports: clamp('maxReports', requested.maxReports),
      maxFights: clamp('maxFights', requested.maxFights),
      maxRowsPerCsv: clamp('maxRowsPerCsv', requested.maxRowsPerCsv),
      maxEventsPerFightPerView: clamp('maxEventsPerFightPerView', requested.maxEventsPerFightPerView),
      maxTotalExportBytes: clamp('maxTotalExportBytes', requested.maxTotalExportBytes),
    },
    warnings,
  }
}
