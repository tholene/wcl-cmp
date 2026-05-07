export const PATHS = {
  HOME: '/',
  REPORT_DETAILS: '/reports/:code',
} as const

export const getReportDetailsPath = (code: string): string =>
  PATHS.REPORT_DETAILS.replace(':code', code)
