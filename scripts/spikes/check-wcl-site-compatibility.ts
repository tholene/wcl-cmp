import dotenv from 'dotenv'
import { getWclConfig } from '../../server/warcraft-logs/wcl-config'
import { WclService } from '../../server/warcraft-logs/wcl-service'
import { queryWclGraphQl } from '../../server/warcraft-logs/wcl-client'
import { resolveWclRequestContext } from '../../server/warcraft-logs/wcl-request-context'
import type { WclSite } from '../../server/warcraft-logs/wcl-site'

dotenv.config()

type ProbeFailureCategory =
  | 'auth/token failure'
  | 'GraphQL endpoint/schema failure'
  | 'guild/report data not found'
  | 'unknown/network failure'

type ProbeStepResult = {
  ok: boolean
  category?: ProbeFailureCategory
  message?: string
  details?: Record<string, unknown>
}

type SiteProbeResult = {
  site: WclSite
  minimalGraphQl: ProbeStepResult
  recentReports?: ProbeStepResult
}

const SITES: WclSite[] = ['retail', 'classic', 'fresh']

const MINIMAL_QUERY = `
  query SiteCompatibilityProbe {
    __typename
  }
`

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return String(error ?? 'Unknown error')
}

const classifyFailureCategory = (error: unknown): ProbeFailureCategory => {
  const normalized = toErrorMessage(error).toLowerCase()

  if (
    normalized.includes('oauth token request failed') ||
    normalized.includes('authentication') ||
    normalized.includes('invalid_client') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  ) {
    return 'auth/token failure'
  }

  if (
    normalized.includes('graphql returned errors') ||
    normalized.includes('graphql request failed') ||
    normalized.includes('cannot query field') ||
    normalized.includes('unknown argument') ||
    normalized.includes('validation error')
  ) {
    return 'GraphQL endpoint/schema failure'
  }

  if (
    normalized.includes('guild not found') ||
    normalized.includes('report not found') ||
    normalized.includes('no report found for code')
  ) {
    return 'guild/report data not found'
  }

  return 'unknown/network failure'
}

const failStep = (error: unknown): ProbeStepResult => ({
  ok: false,
  category: classifyFailureCategory(error),
  message: toErrorMessage(error),
})

const runProbe = async (): Promise<void> => {
  const baseConfig = getWclConfig()
  const results: SiteProbeResult[] = []

  for (const site of SITES) {
    const resolved = resolveWclRequestContext(baseConfig, { wclSite: site })

    let minimalGraphQl: ProbeStepResult
    try {
      const response = await queryWclGraphQl<{ __typename: string }>({
        config: resolved.config,
        site: resolved.site,
        query: MINIMAL_QUERY,
      })
      minimalGraphQl = {
        ok: true,
        details: {
          typename: response.__typename,
        },
      }
    } catch (error) {
      minimalGraphQl = failStep(error)
    }

    let recentReports: ProbeStepResult | undefined
    if (resolved.guildId) {
      try {
        const reports = await WclService.listRecentReports(resolved.config, 3)
        recentReports = {
          ok: true,
          details: {
            guildIdUsed: resolved.guildId,
            reportCount: reports.length,
            topReportCode: reports[0]?.code ?? null,
          },
        }
      } catch (error) {
        recentReports = failStep(error)
      }
    }

    results.push({
      site,
      minimalGraphQl,
      ...(recentReports ? { recentReports } : {}),
    })
  }

  const output = {
    generatedAt: new Date().toISOString(),
    notes: [
      'Probe uses server-side WCL credentials from environment variables.',
      'No secrets or access tokens are printed.',
      'Failures are categorized heuristically and should be confirmed manually if needed.',
    ],
    results,
  }

  console.log(JSON.stringify(output, null, 2))
}

runProbe().catch((error) => {
  console.error('[spike:wcl-sites] Probe failed to run:', toErrorMessage(error))
  process.exitCode = 1
})
