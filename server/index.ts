import path from 'node:path'
import cors from 'cors'
import dotenv from 'dotenv'
import express, { type NextFunction, type Request, type Response } from 'express'
import { getConfigStatus, getServerConfig, getWclConfig } from './warcraft-logs/wcl-config'
import {
  MISSING_GUILD_ID_ERROR_MESSAGE,
  requireGuildIdForGuildScopedFlow,
  resolveWclRequestContext,
  type WclRequestContext,
} from './warcraft-logs/wcl-request-context'
import { classifyWclError, isLikelyWclError } from './warcraft-logs/wcl-error-hints'
import { WclService } from './warcraft-logs/wcl-service'
import {
  resolveWclCharacter,
  validateWclCharacterResolveRequest,
} from './warcraft-logs/wcl-character-resolver'
import type { WclCharacterResolveRequest } from './warcraft-logs/wcl-character-resolver.types'
import { getExportPreview, startExportJob, validateExportStartRequest } from './player-analysis/player-analysis-export.service'
import { PlayerAnalysisBenchmarkService } from './player-analysis/player-analysis-benchmark.service'
import { JobStore } from './player-analysis/player-analysis-job-store'
import { validateAndResolveExportFilePath } from './player-analysis/player-analysis-export-files'

dotenv.config()

process.on('uncaughtException', (error) => {
  console.error('[server] Uncaught exception:', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason)
})

export const app = express()

const buildAllowedOrigins = (): string[] => {
  const origins = ['http://localhost:5780', 'http://localhost:5781']
  if (process.env.FRONTEND_URL) origins.push(process.env.FRONTEND_URL)
  return origins
}

app.use(cors({ origin: buildAllowedOrigins() }))
app.use(express.json())

const resolveReportCodeParam = (value: string | string[] | undefined): string => {
  if (!value) {
    return ''
  }

  return Array.isArray(value) ? value[0] : value
}

type PlayerAnalysisApiError = {
  error: string
  hint?: string
  code?: string
  details?: Record<string, unknown>
}

const isPlayerAnalysisPath = (pathValue: string): boolean =>
  pathValue.startsWith('/api/player-analysis/')

const sendPlayerAnalysisError = (
  res: Response,
  status: number,
  payload: PlayerAnalysisApiError
): void => {
  res.status(status).json(payload)
}

const asErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) return error.message
  return fallback
}

const firstQueryValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const toQueryContext = (req: Request): WclRequestContext => ({
  wclSite: firstQueryValue(req.query.wclSite as string | string[] | undefined),
  guildId: firstQueryValue(req.query.guildId as string | string[] | undefined),
  region: firstQueryValue(req.query.region as string | string[] | undefined),
})

const toBodyContext = (req: Request): WclRequestContext | undefined =>
  (req.body?.wclContext ?? undefined) as WclRequestContext | undefined

const requiresGuildScopedReportDiscovery = (reportCodes: unknown): boolean =>
  !Array.isArray(reportCodes) || reportCodes.length === 0

const toWclCharacterResolveBody = (body: unknown): WclCharacterResolveRequest =>
  (body ?? {}) as WclCharacterResolveRequest

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true })
})

app.get('/api/config/status', (_req: Request, res: Response) => {
  const status = getConfigStatus()

  res.status(200).json({
    ...status,
    hint:
      status.hasClientId && status.hasClientSecret
        ? status.hasGuildId
          ? 'WCL credentials appear present. If API calls fail, verify values and guild settings.'
          : 'WCL credentials appear present. Configure a Guild ID in Settings or set WCL_GUILD_ID for guild-scoped flows.'
        : 'Missing WCL credentials. Add WCL_CLIENT_ID and WCL_CLIENT_SECRET to .env and restart npm run dev.',
  })
})

app.get('/api/reports/recent', async (req: Request, res: Response) => {
  let selectedSite: string | undefined
  try {
    const baseConfig = getWclConfig()
    const resolvedContext = resolveWclRequestContext(baseConfig, toQueryContext(req))
    selectedSite = resolvedContext.site
    requireGuildIdForGuildScopedFlow(resolvedContext.guildId)
    const reports = await WclService.listRecentReports(resolvedContext.config)

    res.status(200).json({
      guildId: resolvedContext.guildId,
      region: resolvedContext.region,
      reports,
    })
  } catch (error) {
    if (error instanceof Error && error.message === MISSING_GUILD_ID_ERROR_MESSAGE) {
      res.status(400).json({
        error: MISSING_GUILD_ID_ERROR_MESSAGE,
      })
      return
    }
    const classified = classifyWclError(error, { site: selectedSite })
    console.error('[wcl] /api/reports/recent failed:', error)
    res.status(500).json({
      error: classified.message,
      hint: classified.hint,
      code: classified.code,
    })
  }
})

app.get('/api/players/recent', async (req: Request, res: Response) => {
  let selectedSite: string | undefined
  try {
    const baseConfig = getWclConfig()
    const resolvedContext = resolveWclRequestContext(baseConfig, toQueryContext(req))
    selectedSite = resolvedContext.site
    requireGuildIdForGuildScopedFlow(resolvedContext.guildId)
    const players = await WclService.getRecentPlayers(resolvedContext.config)

    res.status(200).json({
      players,
      generatedAt: Date.now(),
    })
  } catch (error) {
    if (error instanceof Error && error.message === MISSING_GUILD_ID_ERROR_MESSAGE) {
      res.status(400).json({
        error: MISSING_GUILD_ID_ERROR_MESSAGE,
      })
      return
    }
    const classified = classifyWclError(error, { site: selectedSite })
    console.error('[wcl] /api/players/recent failed:', error)
    res.status(500).json({
      error: classified.message,
      hint: classified.hint,
      code: classified.code,
    })
  }
})

app.post('/api/wcl/character/resolve', async (req: Request, res: Response) => {
  const body = toWclCharacterResolveBody(req.body)
  const validated = validateWclCharacterResolveRequest(body)

  if (!validated.ok) {
    res.status(400).json({
      error: validated.error.message,
      code: validated.error.code,
      ...(validated.error.hint ? { hint: validated.error.hint } : {}),
    })
    return
  }

  try {
    const config = getWclConfig()
    const result = await resolveWclCharacter(config, body)

    if (result.status === 'error' && result.error?.code === 'VALIDATION_ERROR') {
      res.status(400).json({
        status: result.status,
        character: result.character,
        warnings: result.warnings,
        error: result.error,
      })
      return
    }

    if (result.status === 'unsupported') {
      res.status(422).json(result)
      return
    }

    if (result.status === 'error') {
      res.status(502).json(result)
      return
    }

    res.status(200).json(result)
  } catch (error) {
    const classified = classifyWclError(error, { site: body.wclSite })
    console.error('[wcl] /api/wcl/character/resolve failed:', error)
    res.status(500).json({
      error: classified.message,
      hint: classified.hint,
      code: classified.code,
    })
  }
})

// ---------------------------------------------------------------------------
// Player Analysis Export endpoints
// ---------------------------------------------------------------------------

app.post('/api/player-analysis/export-preview', async (req: Request, res: Response) => {
  if (!req.body?.playerName?.trim()) {
    sendPlayerAnalysisError(res, 400, {
      error: 'playerName is required.',
      code: 'VALIDATION_ERROR',
      hint: 'Provide a non-empty playerName in the request body.',
    })
    return
  }
  if (!Array.isArray(req.body?.views) || req.body.views.length === 0) {
    sendPlayerAnalysisError(res, 400, {
      error: 'At least one export view is required.',
      code: 'VALIDATION_ERROR',
      hint: 'Provide one or more values in views[].',
    })
    return
  }
  let selectedSite: string | undefined
  try {
    const baseConfig = getWclConfig()
    const resolvedContext = resolveWclRequestContext(baseConfig, toBodyContext(req))
    selectedSite = resolvedContext.site
    if (requiresGuildScopedReportDiscovery(req.body?.reportCodes)) {
      requireGuildIdForGuildScopedFlow(resolvedContext.guildId)
    }
    const preview = await getExportPreview(resolvedContext.config, req.body)
    res.status(200).json(preview)
  } catch (error) {
    if (error instanceof Error && error.message === MISSING_GUILD_ID_ERROR_MESSAGE) {
      sendPlayerAnalysisError(res, 400, {
        error: MISSING_GUILD_ID_ERROR_MESSAGE,
        code: 'MISSING_GUILD_ID',
      })
      return
    }
    if (isLikelyWclError(error)) {
      const classified = classifyWclError(error, { site: selectedSite })
      console.error('[wcl] /api/player-analysis/export-preview failed:', error)
      sendPlayerAnalysisError(res, 400, {
        error: classified.message,
        code: classified.code,
        hint: classified.hint,
      })
      return
    }
    const message = asErrorMessage(error, 'Unknown error during export preview.')
    sendPlayerAnalysisError(res, 400, {
      error: message,
      code: 'PREVIEW_FAILED',
      hint: 'Check player name, scope preset, and report selection.',
    })
  }
})

app.post('/api/player-analysis/export', async (req: Request, res: Response) => {
  if (!req.body?.playerName?.trim()) {
    sendPlayerAnalysisError(res, 400, {
      error: 'playerName is required.',
      code: 'VALIDATION_ERROR',
      hint: 'Provide a non-empty playerName in the request body.',
    })
    return
  }
  if (!Array.isArray(req.body?.views) || req.body.views.length === 0) {
    sendPlayerAnalysisError(res, 400, {
      error: 'At least one export view is required.',
      code: 'VALIDATION_ERROR',
      hint: 'Provide one or more values in views[].',
    })
    return
  }
  let selectedSite: string | undefined
  try {
    const baseConfig = getWclConfig()
    const resolvedContext = resolveWclRequestContext(baseConfig, toBodyContext(req))
    selectedSite = resolvedContext.site
    if (requiresGuildScopedReportDiscovery(req.body?.reportCodes)) {
      requireGuildIdForGuildScopedFlow(resolvedContext.guildId)
    }
    validateExportStartRequest(req.body)
    const jobStart = startExportJob(resolvedContext.config, req.body)
    res.status(202).json(jobStart)
  } catch (error) {
    if (error instanceof Error && error.message === MISSING_GUILD_ID_ERROR_MESSAGE) {
      sendPlayerAnalysisError(res, 400, {
        error: MISSING_GUILD_ID_ERROR_MESSAGE,
        code: 'MISSING_GUILD_ID',
      })
      return
    }
    if (isLikelyWclError(error)) {
      const classified = classifyWclError(error, { site: selectedSite })
      console.error('[wcl] /api/player-analysis/export failed:', error)
      sendPlayerAnalysisError(res, 400, {
        error: classified.message,
        code: classified.code,
        hint: classified.hint,
      })
      return
    }
    const message = asErrorMessage(error, 'Unknown error starting export job.')
    sendPlayerAnalysisError(res, 400, {
      error: message,
      code: 'EXPORT_START_FAILED',
      hint: 'Check player name and export request.',
    })
  }
})

app.get('/api/player-analysis/exports/:exportId/status', (req: Request, res: Response) => {
  const exportId = resolveReportCodeParam(req.params.exportId)
  const job = JobStore.get(exportId)
  if (!job) {
    sendPlayerAnalysisError(res, 404, {
      error: 'Export not found.',
      code: 'EXPORT_NOT_FOUND',
      hint: 'The export may have expired or the exportId is invalid.',
    })
    return
  }
  res.status(200).json(job)
})

app.post('/api/player-analysis/benchmark-candidates', async (req: Request, res: Response) => {
  let selectedSite: string | undefined
  try {
    const baseConfig = getWclConfig()
    const resolvedContext = resolveWclRequestContext(baseConfig, toBodyContext(req))
    selectedSite = resolvedContext.site
    const body = req.body as import('./player-analysis/player-analysis.types').BenchmarkCandidatesRequest
    console.log('[benchmark-candidates] baselines:', JSON.stringify(
      (body.baselines ?? []).map((b) => ({
        encounterId: b.encounterId,
        difficulty: b.difficulty,
        className: b.className,
        specName: b.specName,
      }))
    ))
    const result = await PlayerAnalysisBenchmarkService.findBenchmarkCandidates(resolvedContext.config, body)
    res.status(200).json(result)
  } catch (error) {
    if (isLikelyWclError(error)) {
      const classified = classifyWclError(error, { site: selectedSite })
      console.error('[wcl] /api/player-analysis/benchmark-candidates failed:', error)
      sendPlayerAnalysisError(res, 400, {
        error: classified.message,
        code: classified.code,
        hint: classified.hint,
      })
      return
    }
    const message = asErrorMessage(error, 'Unknown error finding benchmark candidates.')
    sendPlayerAnalysisError(res, 400, {
      error: message,
      code: 'BENCHMARK_CANDIDATES_FAILED',
      hint: 'Check baseline class/spec context and candidate request payload.',
    })
  }
})

app.get('/api/player-analysis/exports/:exportId/:filename', (req: Request, res: Response) => {
  const exportId = resolveReportCodeParam(req.params.exportId)
  const filename = resolveReportCodeParam(req.params.filename)

  const resolvedPath = validateAndResolveExportFilePath(exportId, filename)
  if (!resolvedPath) {
    sendPlayerAnalysisError(res, 400, {
      error: 'Invalid export ID or filename.',
      code: 'INVALID_EXPORT_FILE_PATH',
      details: { exportId, filename },
    })
    return
  }

  const ext = path.extname(filename).toLowerCase()
  const contentTypes: Record<string, string> = {
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.zip': 'application/zip',
  }
  const contentType = contentTypes[ext] ?? 'application/octet-stream'
  res.setHeader('Content-Type', contentType)
  res.sendFile(resolvedPath, (err) => {
    if (err && !res.headersSent) {
      const sendFileError = err as NodeJS.ErrnoException & { statusCode?: number }
      const statusCode = typeof sendFileError.statusCode === 'number' ? sendFileError.statusCode : 404
      sendPlayerAnalysisError(res, statusCode, {
        error: 'File not found.',
        code: 'EXPORT_FILE_NOT_FOUND',
        details: { exportId, filename },
      })
    }
  })
})

app.get('/auth/callback', (_req: Request, res: Response) => {
  res.status(200).send('WCL callback endpoint is configured for local development.')
})

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (!isPlayerAnalysisPath(req.path)) {
    next(err)
    return
  }

  if (res.headersSent) {
    next(err)
    return
  }

  const bodyParserSyntaxError =
    err instanceof SyntaxError &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number' &&
    (err as { status: number }).status === 400 &&
    'body' in (err as Record<string, unknown>)

  if (bodyParserSyntaxError) {
    sendPlayerAnalysisError(res, 400, {
      error: 'Malformed JSON body.',
      code: 'INVALID_JSON',
      hint: 'Check request JSON syntax and retry.',
    })
    return
  }

  const message = asErrorMessage(err, 'Unexpected player-analysis server error.')
  console.error('[player-analysis] Unhandled route error:', message)
  sendPlayerAnalysisError(res, 500, {
    error: message,
    code: 'INTERNAL_SERVER_ERROR',
    hint: 'Check backend logs and retry.',
    details: { method: req.method, path: req.path },
  })
})

const startServer = () => {
  const serverConfig = getServerConfig()

  app.listen(serverConfig.API_PORT, () => {
    console.log(`API running on http://localhost:${serverConfig.API_PORT}`)
  })
}

if (process.env.WCL_SKIP_SERVER_START !== '1') {
  startServer()
}
