import type { ReportSummary } from '@/features/reports/types/report-summary'
import type { RecentReportsResponse } from '@/features/reports/types/recent-reports-response'

export const createMockReport = (overrides: Partial<ReportSummary> = {}): ReportSummary => ({
  code: 'abc123',
  title: 'Test Report',
  startTime: 1_700_000_000_000,
  endTime: 1_700_003_600_000,
  visibility: 'public',
  ownerName: 'TestPlayer',
  zoneId: 1,
  zoneName: 'Test Zone',
  url: 'https://www.warcraftlogs.com/reports/abc123',
  ...overrides,
})

export const createMockRecentReportsResponse = (
  overrides: Partial<RecentReportsResponse> = {}
): RecentReportsResponse => ({
  guildId: 'guild-1',
  region: 'EU',
  reports: [createMockReport()],
  ...overrides,
})
