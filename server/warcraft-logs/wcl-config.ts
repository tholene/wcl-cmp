import { z } from 'zod'

const serverConfigSchema = z.object({
  API_PORT: z.coerce.number().default(5781),
})

const optionalEnvText = z.preprocess((value) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}, z.string().optional())

const wclConfigSchema = z.object({
  WCL_CLIENT_ID: z.string().min(1, 'WCL_CLIENT_ID is required'),
  WCL_CLIENT_SECRET: z.string().min(1, 'WCL_CLIENT_SECRET is required'),
  WCL_GUILD_ID: optionalEnvText,
  WCL_REGION: optionalEnvText,
  WCL_REDIRECT_URI: z.string().url().default('http://localhost:5781/auth/callback'),
  API_PORT: z.coerce.number().default(5781),
})

export type ServerConfig = z.infer<typeof serverConfigSchema>
export type WclConfig = z.infer<typeof wclConfigSchema>

type ConfigStatus = {
  apiPort: number
  guildId: string | null
  region: string | null
  hasGuildId: boolean
  hasRegion: boolean
  hasClientId: boolean
  hasClientSecret: boolean
  hasRedirectUri: boolean
}

const formatConfigErrors = (issues: z.ZodIssue[]): string => {
  const issueMessages = issues.map((issue) => {
    const key = issue.path[0]

    if (key === 'WCL_CLIENT_ID') {
      return 'WCL_CLIENT_ID is missing or empty'
    }

    if (key === 'WCL_CLIENT_SECRET') {
      return 'WCL_CLIENT_SECRET is missing or empty'
    }

    if (key === 'WCL_REDIRECT_URI') {
      return 'WCL_REDIRECT_URI is invalid (must be a URL)'
    }

    if (key === 'API_PORT') {
      return 'API_PORT is invalid (must be a number)'
    }

    return issue.message
  })

  return Array.from(new Set(issueMessages)).join('; ')
}

export const getServerConfig = (): ServerConfig => {
  const parsedConfig = serverConfigSchema.safeParse(process.env)

  if (!parsedConfig.success) {
    const configErrors = formatConfigErrors(parsedConfig.error.issues)
    throw new Error(`Invalid server configuration: ${configErrors}`)
  }

  return parsedConfig.data
}

export const getWclConfig = (): WclConfig => {
  const parsedConfig = wclConfigSchema.safeParse(process.env)

  if (!parsedConfig.success) {
    const configErrors = formatConfigErrors(parsedConfig.error.issues)
    throw new Error(`Invalid environment configuration: ${configErrors}`)
  }

  return parsedConfig.data
}

export const getConfigStatus = (): ConfigStatus => {
  const apiPort = Number(process.env.API_PORT || 5781)
  const guildId = process.env.WCL_GUILD_ID?.trim() || null
  const region = process.env.WCL_REGION?.trim() || null

  return {
    apiPort,
    guildId,
    region,
    hasGuildId: guildId !== null,
    hasRegion: region !== null,
    hasClientId: Boolean(process.env.WCL_CLIENT_ID?.trim()),
    hasClientSecret: Boolean(process.env.WCL_CLIENT_SECRET?.trim()),
    hasRedirectUri: Boolean(process.env.WCL_REDIRECT_URI?.trim()),
  }
}
