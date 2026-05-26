const toTrimmed = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const hasExplicitReportCodes = (reportCodes: unknown): boolean =>
  Array.isArray(reportCodes) && reportCodes.some((code) => toTrimmed(code).length > 0)

const hasExplicitFightSelection = (fightIdsByReport: unknown): boolean => {
  if (!fightIdsByReport || typeof fightIdsByReport !== 'object') return false
  for (const [reportCode, fightIds] of Object.entries(fightIdsByReport as Record<string, unknown>)) {
    if (toTrimmed(reportCode).length === 0) continue
    if (!Array.isArray(fightIds) || fightIds.length === 0) continue
    const hasFightId = fightIds.some((fightId) => typeof fightId === 'number' && Number.isFinite(fightId) && fightId > 0)
    if (hasFightId) return true
  }
  return false
}

export const hasExplicitReportScope = (requestBody: {
  reportCodes?: unknown
  fightIdsByReport?: unknown
}): boolean =>
  hasExplicitReportCodes(requestBody.reportCodes) || hasExplicitFightSelection(requestBody.fightIdsByReport)

export const requiresGuildScopedReportDiscovery = (requestBody: {
  reportCodes?: unknown
  fightIdsByReport?: unknown
}): boolean => !hasExplicitReportScope(requestBody)
