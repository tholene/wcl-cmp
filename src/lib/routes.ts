export const PATHS = {
  HOME: '/',
  BOSSES: '/bosses',
  BOSS_DETAILS: '/bosses/:encounterId',
  REPORT_DETAILS: '/reports/:code',
} as const

export const getReportDetailsPath = (code: string): string =>
  PATHS.REPORT_DETAILS.replace(':code', code)

export const getBossDetailsPath = (encounterId: number): string =>
  PATHS.BOSS_DETAILS.replace(':encounterId', String(encounterId))
