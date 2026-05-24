import { describe, expect, it } from 'vitest'
import { classifyWclError } from '../wcl-error-hints'
import { MISSING_GUILD_ID_ERROR_MESSAGE } from '../wcl-request-context'

describe('classifyWclError', () => {
  it('classifies timeout failures', () => {
    const result = classifyWclError(new Error('WCL request timed out after 30s'), {
      site: 'classic',
    })

    expect(result).toEqual({
      code: 'WCL_TIMEOUT',
      message: 'Warcraft Logs did not respond in time.',
      hint: 'Try again in a moment. Selected log site: Classic.',
    })
  })

  it('classifies token/auth-like failures', () => {
    const result = classifyWclError(
      new Error('WCL OAuth token request failed (401): {"error":"invalid_client"}'),
      {
        site: 'fresh',
      }
    )

    expect(result).toEqual({
      code: 'WCL_AUTH_FAILED',
      message: 'Warcraft Logs authentication failed for the selected log site.',
      hint: 'Check server-side WCL credentials and Settings. Selected log site: Fresh.',
    })
  })

  it('classifies GraphQL/schema-like failures', () => {
    const result = classifyWclError(new Error('WCL GraphQL returned errors: Cannot query field "foo"'))

    expect(result).toEqual({
      code: 'WCL_QUERY_UNSUPPORTED',
      message: 'The selected Warcraft Logs site did not accept the current query.',
      hint:
        'Classic/Fresh compatibility is still being verified. Try Retail or adjust Settings. Selected log site: Retail.',
    })
  })

  it('falls back to a generic WCL request failure', () => {
    const result = classifyWclError(new Error('Unexpected upstream disconnect'), {
      site: 'retail',
    })

    expect(result).toEqual({
      code: 'WCL_REQUEST_FAILED',
      message: 'Warcraft Logs request failed for the selected log site.',
      hint: 'Check Settings and try again. Selected log site: Retail.',
    })
  })

  it('preserves the exact missing guild ID message', () => {
    const result = classifyWclError(new Error(MISSING_GUILD_ID_ERROR_MESSAGE), {
      site: 'classic',
    })

    expect(result).toEqual({
      code: 'MISSING_GUILD_ID',
      message: MISSING_GUILD_ID_ERROR_MESSAGE,
    })
  })
})
