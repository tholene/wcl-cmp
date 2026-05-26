import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import type {
  GlobalCharacterBossKillsRequest,
  GlobalCharacterLookupInput,
  PlayerLookupMode,
} from '../types/player-analysis.types'

export const hasConfiguredGuildId = (
  context: Pick<AppSettingsRequestContext, 'guildId'>
): boolean => typeof context.guildId === 'string' && context.guildId.trim().length > 0

export const getDefaultPlayerLookupMode = (
  context: Pick<AppSettingsRequestContext, 'guildId'>
): PlayerLookupMode => (hasConfiguredGuildId(context) ? 'guild' : 'global')

type BuildGlobalBossKillsRequestResult =
  | { ok: true; request: GlobalCharacterBossKillsRequest }
  | { ok: false; error: string }

const trim = (value: string): string => value.trim()

export const buildGlobalBossKillsRequest = (
  context: Pick<AppSettingsRequestContext, 'wclSite'>,
  input: GlobalCharacterLookupInput
): BuildGlobalBossKillsRequestResult => {
  const characterUrl = trim(input.characterUrl)
  const region = trim(input.region)
  const realmSlug = trim(input.realmSlug)
  const characterName = trim(input.characterName)

  if (characterUrl.length > 0) {
    return {
      ok: true,
      request: {
        wclSite: context.wclSite,
        characterUrl,
        includeWipes: input.includeWipes,
        limit: input.limit,
      },
    }
  }

  if (!characterName || !region || !realmSlug) {
    return {
      ok: false,
      error: 'Paste a Warcraft Logs character URL or provide character name, region, and realm slug.',
    }
  }

  return {
    ok: true,
    request: {
      wclSite: context.wclSite,
      characterName,
      region,
      realmSlug,
      includeWipes: input.includeWipes,
      limit: input.limit,
    },
  }
}
