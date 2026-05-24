import dotenv from 'dotenv'
import { getWclConfig } from '../../server/warcraft-logs/wcl-config'
import { resolveWclCharacter } from '../../server/warcraft-logs/wcl-character-resolver'
import type { WclCharacterResolveRequest } from '../../server/warcraft-logs/wcl-character-resolver.types'
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

const classifyFailure = (result: Awaited<ReturnType<typeof resolveWclCharacter>>): string | undefined => {
  if (result.status === 'unsupported') return 'unsupported query/schema'
  if (result.status === 'not_found') return 'not found'

  if (result.error?.code === 'AUTH_OR_SITE_FAILURE') return 'auth/site failure'
  if (result.status === 'error') return 'unknown'
  return undefined
}

const printUsageAndExit = (): void => {
  console.log('No exact-lookup probe values provided. URL parser probe only.')
  console.log('Set these env vars to probe exact lookup:')
  console.log('  SPIKE_WCL_CHARACTER_SITE=retail|classic|fresh')
  console.log('  SPIKE_WCL_CHARACTER_REGION=eu')
  console.log('  SPIKE_WCL_CHARACTER_REALM=the-maelstrom')
  console.log('  SPIKE_WCL_CHARACTER_NAME=Bagge')
  console.log('Optional: SPIKE_WCL_CHARACTER_URL=https://www.warcraftlogs.com/character/eu/the-maelstrom/Bagge')
}

const run = async (): Promise<void> => {
  const config = getWclConfig()

  if (optionalCharacterUrl) {
    const urlOnlyRequest: WclCharacterResolveRequest = {
      characterUrl: optionalCharacterUrl,
    }
    const urlResult = await resolveWclCharacter(config, urlOnlyRequest)
    const urlFailure = classifyFailure(urlResult)

    console.log(
      JSON.stringify(
        {
          type: 'url_probe',
          request: {
            hasCharacterUrl: true,
          },
          status: urlResult.status,
          failureCategory: urlFailure ?? null,
          warnings: urlResult.warnings,
          character: urlResult.character,
          error: urlResult.error ?? null,
        },
        null,
        2
      )
    )
  }

  if (!optionalSite || !optionalRegion || !optionalRealm || !optionalName) {
    printUsageAndExit()
    return
  }

  const exactRequest: WclCharacterResolveRequest = {
    wclSite: optionalSite as WclSite,
    region: optionalRegion,
    realmSlug: optionalRealm,
    characterName: optionalName,
  }

  const result = await resolveWclCharacter(config, exactRequest)
  const failureCategory = classifyFailure(result)

  console.log(
    JSON.stringify(
      {
        type: 'exact_probe',
        request: {
          site: exactRequest.wclSite,
          region: exactRequest.region,
          realmSlug: exactRequest.realmSlug,
          characterName: exactRequest.characterName,
        },
        status: result.status,
        failureCategory: failureCategory ?? null,
        warnings: result.warnings,
        character: result.character,
        error: result.error ?? null,
      },
      null,
      2
    )
  )
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[spike:wcl-character] probe failed:', message)
  process.exitCode = 1
})
