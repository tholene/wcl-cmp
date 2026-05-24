import { MISSING_GUILD_ID_ERROR_MESSAGE } from './wcl-request-context'
import { getWclSiteConfig } from './wcl-site'

export type WclErrorHint = {
  code: string
  message: string
  hint?: string
}

type ClassifyWclErrorOptions = {
  site?: string | null
}

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return String(error ?? '').trim()
}

const hasAny = (value: string, needles: string[]): boolean =>
  needles.some((needle) => value.includes(needle))

export const isLikelyWclError = (error: unknown): boolean => {
  const normalized = toErrorMessage(error).toLowerCase()
  if (!normalized) return false
  return hasAny(normalized, [
    'warcraft logs',
    'wcl ',
    'wcl_',
    'oauth',
    'graphql',
    'timed out',
    'timeouterror',
    'aborterror',
    'guild id is required for this flow',
    'no report found for code',
    'guild not found',
    'report not found',
  ])
}

const withSiteHint = (hint: string | undefined, site: string | null | undefined): string | undefined => {
  const selectedSite = getWclSiteConfig(site).label
  const siteSuffix = `Selected log site: ${selectedSite}.`
  if (!hint || hint.trim().length === 0) {
    return siteSuffix
  }
  return `${hint} ${siteSuffix}`
}

export const classifyWclError = (
  error: unknown,
  options?: ClassifyWclErrorOptions
): WclErrorHint => {
  const rawMessage = toErrorMessage(error)
  if (rawMessage === MISSING_GUILD_ID_ERROR_MESSAGE) {
    return {
      code: 'MISSING_GUILD_ID',
      message: MISSING_GUILD_ID_ERROR_MESSAGE,
    }
  }

  const normalized = rawMessage.toLowerCase()

  if (hasAny(normalized, ['timed out', 'timeouterror', 'aborterror'])) {
    return {
      code: 'WCL_TIMEOUT',
      message: 'Warcraft Logs did not respond in time.',
      hint: withSiteHint('Try again in a moment.', options?.site),
    }
  }

  if (
    hasAny(normalized, [
      'oauth token request failed',
      'authentication failed',
      'invalid_client',
      'invalid token',
      'unauthorized',
      '401',
      'forbidden',
      'access denied',
    ])
  ) {
    return {
      code: 'WCL_AUTH_FAILED',
      message: 'Warcraft Logs authentication failed for the selected log site.',
      hint: withSiteHint('Check server-side WCL credentials and Settings.', options?.site),
    }
  }

  if (
    hasAny(normalized, [
      'graphql returned errors',
      'graphql request failed',
      'cannot query field',
      'unknown argument',
      'syntax error',
      'validation error',
    ])
  ) {
    return {
      code: 'WCL_QUERY_UNSUPPORTED',
      message: 'The selected Warcraft Logs site did not accept the current query.',
      hint: withSiteHint(
        'Classic/Fresh compatibility is still being verified. Try Retail or adjust Settings.',
        options?.site
      ),
    }
  }

  if (
    hasAny(normalized, [
      'no report found for code',
      'could not find guild',
      'guild not found',
      'report not found',
    ])
  ) {
    return {
      code: 'WCL_DATA_NOT_FOUND',
      message: 'Guild or report data was not found on the selected Warcraft Logs site.',
      hint: withSiteHint('Check Guild ID, report code, and site selection.', options?.site),
    }
  }

  return {
    code: 'WCL_REQUEST_FAILED',
    message: 'Warcraft Logs request failed for the selected log site.',
    hint: withSiteHint('Check Settings and try again.', options?.site),
  }
}
