import type { WclConfig } from './wcl-config'
import { getWclGraphQlUrl, getWclSiteConfig, getWclTokenUrl, type WclSite } from './wcl-site'
import type { WclGraphQlResponse } from './wcl-types'
import type { WclConfigWithSite } from './wcl-request-context'

type AccessTokenCache = {
  token: string
  expiresAt: number
} | null

const WCL_TIMEOUT_MS = 30_000

const fetchWcl = (url: string, init: RequestInit): Promise<Response> =>
  fetch(url, { ...init, signal: AbortSignal.timeout(WCL_TIMEOUT_MS) }).catch((err: unknown) => {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error(`WCL request timed out after ${WCL_TIMEOUT_MS / 1000}s`)
    }
    throw err
  })

const accessTokenCacheBySite = new Map<WclSite, AccessTokenCache>()

const getBasicAuthHeader = (clientId: string, clientSecret: string): string => {
  const encodedCredentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  return `Basic ${encodedCredentials}`
}

const getConfigSite = (config: WclConfig): WclSite | undefined => {
  const site = (config as Partial<WclConfigWithSite>).WCL_SITE
  return typeof site === 'string' ? site : undefined
}

const getAccessToken = async (config: WclConfig, site?: WclSite): Promise<string> => {
  const resolvedSite = getWclSiteConfig(site ?? getConfigSite(config)).site
  const accessTokenCache = accessTokenCacheBySite.get(resolvedSite)

  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 15_000) {
    return accessTokenCache.token
  }

  const tokenResponse = await fetchWcl(getWclTokenUrl(resolvedSite), {
    method: 'POST',
    headers: {
      Authorization: getBasicAuthHeader(config.WCL_CLIENT_ID, config.WCL_CLIENT_SECRET),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text()
    throw new Error(`WCL OAuth token request failed (${tokenResponse.status}): ${errorText}`)
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string
    expires_in: number
  }

  accessTokenCacheBySite.set(resolvedSite, {
    token: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  })

  return tokenData.access_token
}

export const queryWclGraphQl = async <TData>(params: {
  config: WclConfig
  query: string
  variables?: Record<string, unknown>
  site?: WclSite
}): Promise<TData> => {
  const resolvedSite = params.site ?? getConfigSite(params.config)
  const accessToken = await getAccessToken(params.config, resolvedSite)
  const graphQlUrl = getWclGraphQlUrl(resolvedSite)

  const graphQlResponse = await fetchWcl(graphQlUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: params.query,
      variables: params.variables ?? {},
    }),
  })

  if (!graphQlResponse.ok) {
    const errorText = await graphQlResponse.text()
    throw new Error(`WCL GraphQL request failed (${graphQlResponse.status}): ${errorText}`)
  }

  const responseBody = (await graphQlResponse.json()) as WclGraphQlResponse<TData>

  if (responseBody.errors?.length) {
    const errorMessage = responseBody.errors.map((error) => error.message).join('; ')
    throw new Error(`WCL GraphQL returned errors: ${errorMessage}`)
  }

  if (!responseBody.data) {
    throw new Error('WCL GraphQL returned no data.')
  }

  return responseBody.data
}
