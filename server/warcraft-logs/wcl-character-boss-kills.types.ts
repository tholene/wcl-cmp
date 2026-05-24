import type {
  ResolvedWclCharacter,
  WclCharacterResolveError,
  WclCharacterResolveRequest,
} from './wcl-character-resolver.types'
import type { WclSite } from './wcl-site'

export type WclCharacterBossKillsRequest = WclCharacterResolveRequest & {
  limit?: number
  includeWipes?: boolean
}

export type WclCharacterBossKill = {
  site: WclSite
  reportCode: string
  reportTitle?: string | null
  fightId: number
  encounterId: number
  encounterName: string
  difficulty?: number | null
  kill: boolean
  durationMs?: number | null
  startTime?: number | null
  playerItemLevel?: number | null
  className?: string | null
  specName?: string | null
  percentile?: number | null
  metric?: string | null
  source: 'characterRankings' | 'characterReports' | 'reportVerification' | 'unknown'
  warnings: string[]
}

export type WclCharacterBossKillsErrorCode =
  | WclCharacterResolveError['code']
  | 'VALIDATION_ERROR'
  | 'WCL_CHARACTER_REPORTS_UNSUPPORTED'
  | 'WCL_CHARACTER_REPORTS_EMPTY'

export type WclCharacterBossKillsError = {
  code: WclCharacterBossKillsErrorCode
  message: string
  hint?: string
}

export type WclCharacterBossKillsResult = {
  status: 'ok' | 'unsupported' | 'not_found' | 'error'
  character: ResolvedWclCharacter | null
  bossKills: WclCharacterBossKill[]
  warnings: string[]
  error?: WclCharacterBossKillsError
}
