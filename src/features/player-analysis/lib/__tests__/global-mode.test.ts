import { describe, expect, it } from 'vitest'
import {
  getGlobalBenchmarkBlockedReason,
  getGlobalLookupStatusMessage,
  GLOBAL_BENCHMARK_CLASS_SPEC_REQUIRED_MESSAGE,
  GLOBAL_LOOKUP_EMPTY_KILLS_MESSAGE,
  GLOBAL_LOOKUP_NOT_FOUND_MESSAGE,
  GLOBAL_LOOKUP_UNSUPPORTED_MESSAGE,
} from '../global-mode'
import type { GlobalCharacterBossKillsResponse } from '../../types/player-analysis.types'

const makeResponse = (overrides: Partial<GlobalCharacterBossKillsResponse>): GlobalCharacterBossKillsResponse => ({
  status: 'ok',
  character: null,
  bossKills: [],
  warnings: [],
  ...overrides,
})

describe('getGlobalLookupStatusMessage', () => {
  it('returns no-kill state for empty ok responses', () => {
    expect(getGlobalLookupStatusMessage(makeResponse({ status: 'ok', bossKills: [] }))).toBe(
      GLOBAL_LOOKUP_EMPTY_KILLS_MESSAGE
    )
  })

  it('returns not-found state when character lookup misses', () => {
    expect(getGlobalLookupStatusMessage(makeResponse({ status: 'not_found' }))).toBe(
      GLOBAL_LOOKUP_NOT_FOUND_MESSAGE
    )
  })

  it('returns unsupported state for unsupported schema/data', () => {
    expect(getGlobalLookupStatusMessage(makeResponse({ status: 'unsupported' }))).toBe(
      GLOBAL_LOOKUP_UNSUPPORTED_MESSAGE
    )
  })
})

describe('getGlobalBenchmarkBlockedReason', () => {
  it('does not block when selected global fight has class/spec', () => {
    expect(
      getGlobalBenchmarkBlockedReason({
        lookupMode: 'global',
        hasGlobalSelection: true,
        selectedGlobalBossKill: { className: 'Warrior', specName: 'Arms' },
      })
    ).toBeNull()
  })

  it('blocks with clear message when selected global fight lacks class/spec', () => {
    expect(
      getGlobalBenchmarkBlockedReason({
        lookupMode: 'global',
        hasGlobalSelection: true,
        selectedGlobalBossKill: { className: null, specName: null },
      })
    ).toBe(GLOBAL_BENCHMARK_CLASS_SPEC_REQUIRED_MESSAGE)
  })

  it('does not apply global block in guild mode', () => {
    expect(
      getGlobalBenchmarkBlockedReason({
        lookupMode: 'guild',
        hasGlobalSelection: true,
        selectedGlobalBossKill: { className: null, specName: null },
      })
    ).toBeNull()
  })
})
