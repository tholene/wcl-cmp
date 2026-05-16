export const PATHS = {
  HOME: '/',
  BOSSES: '/bosses',
  BOSS_DETAILS: '/bosses/:encounterId',
  REPORT_DETAILS: '/reports/:code',
  FIGHT_REVIEW: '/reports/:code/fights/:fightId',
  PLAYER_FIGHT_REVIEW: '/reports/:code/fights/:fightId/players/:playerId',
  PLAYER_ANALYSIS: '/player-analysis',
} as const

export const getReportDetailsPath = (code: string): string =>
  PATHS.REPORT_DETAILS.replace(':code', code)

export const getBossDetailsPath = (encounterId: number): string =>
  PATHS.BOSS_DETAILS.replace(':encounterId', String(encounterId))

export const getFightReviewPath = (code: string, fightId: number): string =>
  PATHS.FIGHT_REVIEW.replace(':code', code).replace(':fightId', String(fightId))

export const getPlayerFightReviewPath = (code: string, fightId: number, playerId: number): string =>
  PATHS.PLAYER_FIGHT_REVIEW.replace(':code', code)
    .replace(':fightId', String(fightId))
    .replace(':playerId', String(playerId))
