import dotenv from 'dotenv'
import { getWclConfig } from '../../server/warcraft-logs/wcl-config'
import { discoverWclCharacterBossKills } from '../../server/warcraft-logs/wcl-character-boss-kills'
import type { WclCharacterBossKillsRequest } from '../../server/warcraft-logs/wcl-character-boss-kills.types'
import type { WclSite } from '../../server/warcraft-logs/wcl-site'

dotenv.config()

const toTrimmedValue = (value: string | undefined): string | undefined => {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const optionalSite = toTrimmedValue(process.env.SPIKE_WCL_CHARACTER_SITE)
const optionalRegion = toTrimmedValue(process.env.SPIKE_WCL_CHARACTER_REGION)
const optionalRealm = toTrimmedValue(process.env.SPIKE_WCL_CHARACTER_REALM)
const optionalName = toTrimmedValue(process.env.SPIKE_WCL_CHARACTER_NAME)
const optionalCharacterUrl = toTrimmedValue(process.env.SPIKE_WCL_CHARACTER_URL)

const printUsageAndExit = (): void => {
  console.log('Missing required probe values.')
  console.log('Set these env vars to run the character boss-kills probe:')
  console.log('  SPIKE_WCL_CHARACTER_SITE=retail|classic|fresh')
  console.log('  SPIKE_WCL_CHARACTER_REGION=eu')
  console.log('  SPIKE_WCL_CHARACTER_REALM=the-maelstrom')
  console.log('  SPIKE_WCL_CHARACTER_NAME=Bagge')
  console.log('Optional: SPIKE_WCL_CHARACTER_URL=https://www.warcraftlogs.com/character/eu/the-maelstrom/Bagge')
}

const summarizeRows = (rows: Awaited<ReturnType<typeof discoverWclCharacterBossKills>>['bossKills']) =>
  rows.slice(0, 5).map((entry) => ({
    reportCode: entry.reportCode,
    fightId: entry.fightId,
    encounterId: entry.encounterId,
    encounterName: entry.encounterName,
    difficulty: entry.difficulty,
    kill: entry.kill,
    playerItemLevel: entry.playerItemLevel,
    className: entry.className,
    specName: entry.specName,
    percentile: entry.percentile,
    source: entry.source,
  }))

const run = async (): Promise<void> => {
  const config = getWclConfig()

  if (!optionalSite || !optionalRegion || !optionalRealm || !optionalName) {
    printUsageAndExit()
    return
  }

  const request: WclCharacterBossKillsRequest = {
    wclSite: optionalSite as WclSite,
    region: optionalRegion,
    realmSlug: optionalRealm,
    characterName: optionalName,
    ...(optionalCharacterUrl ? { characterUrl: optionalCharacterUrl } : {}),
    limit: 10,
    includeWipes: false,
  }

  const result = await discoverWclCharacterBossKills(config, request)

  console.log(
    JSON.stringify(
      {
        status: result.status,
        character: result.character
          ? {
              site: result.character.site,
              id: result.character.id,
              name: result.character.name,
              region: result.character.region,
              realmSlug: result.character.realmSlug,
            }
          : null,
        bossKillCandidates: result.bossKills.length,
        rows: summarizeRows(result.bossKills),
        warnings: result.warnings,
        error: result.error ?? null,
      },
      null,
      2
    )
  )
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[spike:wcl-character-boss-kills] probe failed:', message)
  process.exitCode = 1
})
