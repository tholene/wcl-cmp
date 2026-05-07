import type { ReportDetails } from '../types/report-details'
import type { ReportSummary } from '../types/report-summary'

const formatDateTime = (value: number): string => new Date(value).toLocaleString()

const formatDurationFromMilliseconds = (value: number): string => {
  const totalSeconds = Math.max(Math.floor(value / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

export const ReportsMapper = {
  formatReportDate: (report: Pick<ReportSummary, 'startTime'>): string => formatDateTime(report.startTime),

  formatReportDuration: (report: Pick<ReportSummary, 'startTime' | 'endTime'>): string =>
    formatDurationFromMilliseconds(report.endTime - report.startTime),

  formatFightDuration: (fight: Pick<ReportDetails['fights'][number], 'startTime' | 'endTime'>): string =>
    formatDurationFromMilliseconds(fight.endTime - fight.startTime),
}
