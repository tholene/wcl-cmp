import type { GlobalCharacterBossKill, GlobalCharacterBossKillsResponse } from '../types/player-analysis.types'

export const GLOBAL_LOOKUP_BEFORE_SEARCH_MESSAGE =
  'Paste a Warcraft Logs character URL or enter exact character details.'

export const GLOBAL_LOOKUP_LOADING_MESSAGE = 'Loading global boss kills…'

export const GLOBAL_LOOKUP_NOT_FOUND_MESSAGE =
  'Character not found on the selected Warcraft Logs site.'

export const GLOBAL_LOOKUP_EMPTY_KILLS_MESSAGE =
  'No recent boss kills found for this character.'

export const GLOBAL_LOOKUP_UNSUPPORTED_MESSAGE =
  'This Warcraft Logs site returned data in a shape the app cannot use yet.'

export const GLOBAL_BENCHMARK_CLASS_SPEC_REQUIRED_MESSAGE =
  'Benchmark discovery needs class/spec data for the selected fight. Try another logged kill or use Guild mode.'

const hasValue = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.trim().length > 0

const hasClassSpec = (fight: Pick<GlobalCharacterBossKill, 'className' | 'specName'> | null): boolean =>
  !!fight && hasValue(fight.className) && hasValue(fight.specName)

export const getGlobalLookupStatusMessage = (
  result: GlobalCharacterBossKillsResponse | null
): string | null => {
  if (!result) return null
  if (result.status === 'ok' && result.bossKills.length === 0) {
    return GLOBAL_LOOKUP_EMPTY_KILLS_MESSAGE
  }
  if (result.status === 'not_found') {
    return GLOBAL_LOOKUP_NOT_FOUND_MESSAGE
  }
  if (result.status === 'unsupported') {
    return GLOBAL_LOOKUP_UNSUPPORTED_MESSAGE
  }
  if (result.status === 'error') {
    return result.error?.message?.trim() || 'Global lookup failed. Try another character or adjust inputs.'
  }
  return null
}

export const getGlobalBenchmarkBlockedReason = (params: {
  lookupMode: 'guild' | 'global'
  hasGlobalSelection: boolean
  selectedGlobalBossKill: Pick<GlobalCharacterBossKill, 'className' | 'specName'> | null
}): string | null => {
  if (params.lookupMode !== 'global' || !params.hasGlobalSelection) return null
  if (hasClassSpec(params.selectedGlobalBossKill)) return null
  return GLOBAL_BENCHMARK_CLASS_SPEC_REQUIRED_MESSAGE
}
