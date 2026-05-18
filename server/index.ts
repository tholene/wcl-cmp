import path from 'node:path'
import cors from 'cors'
import dotenv from 'dotenv'
import express, { type NextFunction, type Request, type Response } from 'express'
import { getConfigStatus, getServerConfig, getWclConfig } from './warcraft-logs/wcl-config'
import { WclService } from './warcraft-logs/wcl-service'
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

const app = express()
app.use(cors())
app.use(express.json())

const resolveReportCodeParam = (value: string | string[] | undefined): string => {
  if (!value) {
    return ''
  }

  return Array.isArray(value) ? value[0] : value
}

const resolveEncounterId = (value: string | string[] | undefined): number | null => {
  if (!value) {
    return null
  }

  const idValue = Array.isArray(value) ? value[0] : value
  const encounterId = Number(idValue)

  if (!Number.isFinite(encounterId) || encounterId <= 0) {
    return null
  }

  return encounterId
}

const resolveFightId = (value: string | string[] | undefined): number | null => {
  if (!value) {
    return null
  }

  const idValue = Array.isArray(value) ? value[0] : value
  const fightId = Number(idValue)

  if (!Number.isFinite(fightId) || fightId <= 0) {
    return null
  }

  return fightId
}

const resolvePlayerId = (value: string | string[] | undefined): number | null => {
  if (!value) {
    return null
  }

  const idValue = Array.isArray(value) ? value[0] : value
  const playerId = Number(idValue)

  if (!Number.isFinite(playerId) || playerId <= 0) {
    return null
  }

  return playerId
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

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true })
})

app.get('/api/config/status', (_req: Request, res: Response) => {
  const status = getConfigStatus()

  res.status(200).json({
    ...status,
    hint:
      status.hasClientId && status.hasClientSecret
        ? 'WCL credentials appear present. If API calls fail, verify values and guild settings.'
        : 'Missing WCL credentials. Add WCL_CLIENT_ID and WCL_CLIENT_SECRET to .env and restart npm run dev.',
  })
})

app.get('/api/reports/recent', async (_req: Request, res: Response) => {
  try {
    const config = getWclConfig()
    const reports = await WclService.listRecentReports(config)

    res.status(200).json({
      guildId: config.WCL_GUILD_ID,
      region: config.WCL_REGION,
      reports,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching reports.'

    res.status(500).json({
      error: message,
      hint: 'Verify WCL_CLIENT_ID, WCL_CLIENT_SECRET, and WCL_GUILD_ID in your .env file.',
    })
  }
})

app.get('/api/reports/:code/fights/:fightId/review', async (req: Request, res: Response) => {
  const reportCode = resolveReportCodeParam(req.params.code)
  const fightId = resolveFightId(req.params.fightId)

  if (!reportCode) {
    res.status(400).json({
      error: 'Missing report code.',
    })
    return
  }

  if (!fightId) {
    res.status(400).json({
      error: 'Invalid fightId. Expected a positive number.',
    })
    return
  }

  try {
    const config = getWclConfig()
    const fightReview = await WclService.getFightReview(config, reportCode, fightId)

    res.status(200).json(fightReview)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching fight review.'

    if (message.includes('Invalid fight ID')) {
      res.status(400).json({
        error: 'Invalid fightId. Expected a positive number.',
      })
      return
    }

    if (message.includes('No report found') || message.includes('was not found')) {
      res.status(404).json({
        error: 'Report or fight was not found.',
      })
      return
    }

    if (message.includes('Warcraft Logs')) {
      res.status(502).json({
        error: 'Could not load fight review data from upstream source.',
        hint: 'Verify Warcraft Logs credentials and try again shortly.',
      })
      return
    }

    res.status(500).json({
      error: 'Failed to load fight review.',
      hint: 'Try again. If the problem persists, verify server configuration and report code.',
    })
  }
})

app.get('/api/reports/:code/fights/:fightId/players/:playerId/review', async (req: Request, res: Response) => {
  const reportCode = resolveReportCodeParam(req.params.code)
  const fightId = resolveFightId(req.params.fightId)
  const playerId = resolvePlayerId(req.params.playerId)

  if (!reportCode) {
    res.status(400).json({
      error: 'Missing report code.',
    })
    return
  }

  if (!fightId) {
    res.status(400).json({
      error: 'Invalid fightId. Expected a positive number.',
    })
    return
  }

  if (!playerId) {
    res.status(400).json({
      error: 'Invalid playerId. Expected a positive number.',
    })
    return
  }

  try {
    const config = getWclConfig()
    const playerReview = await WclService.getPlayerFightReview(config, reportCode, fightId, playerId)

    res.status(200).json(playerReview)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching player fight review.'

    if (message.includes('Invalid fight ID')) {
      res.status(400).json({
        error: 'Invalid fightId. Expected a positive number.',
      })
      return
    }

    if (message.includes('Invalid player ID')) {
      res.status(400).json({
        error: 'Invalid playerId. Expected a positive number.',
      })
      return
    }

    if (message.includes('No report found') || message.includes('was not found')) {
      res.status(404).json({
        error: 'Report, fight, or player was not found.',
      })
      return
    }

    if (message.includes('Warcraft Logs')) {
      res.status(502).json({
        error: 'Could not load player fight review data from upstream source.',
        hint: 'Verify Warcraft Logs credentials and try again shortly.',
      })
      return
    }

    res.status(500).json({
      error: 'Failed to load player fight review.',
      hint: 'Try again. If the problem persists, verify server configuration and report/fight/player identifiers.',
    })
  }
})

app.get('/api/reports/:code', async (req: Request, res: Response) => {
  try {
    const config = getWclConfig()
    const reportCode = resolveReportCodeParam(req.params.code)

    if (!reportCode) {
      res.status(400).json({
        error: 'Missing report code.',
      })
      return
    }

    const report = await WclService.getReportDetails(config, reportCode)

    res.status(200).json(report)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching report details.'

    res.status(500).json({
      error: message,
      hint: 'Verify report code and WCL credentials.',
    })
  }
})

app.get('/api/players/recent', async (_req: Request, res: Response) => {
  try {
    const config = getWclConfig()
    const players = await WclService.getRecentPlayers(config)

    res.status(200).json({
      players,
      generatedAt: Date.now(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching recent players.'

    res.status(500).json({
      error: message,
      hint: 'Verify WCL credentials and guild configuration.',
    })
  }
})

// Deprecated (WP0 sunset): kept for compatibility/deep links only.
// Replacement primary workflow: /api/player-analysis/export
app.post('/api/player-reviews/snapshot', async (req: Request, res: Response) => {
  try {
    const config = getWclConfig()
    const snapshot = await WclService.getPlayerReviewSnapshot(config, req.body)

    res.status(200).json(snapshot)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while generating snapshot.'
    res.status(400).json({
      error: message,
      hint: 'Check player name, selected reports, and filters.',
    })
  }
})

// Deprecated (WP0 sunset): kept for compatibility/deep links only.
// Replacement primary workflow: /api/player-analysis/export-preview
app.post('/api/player-reviews/scope-preview', async (req: Request, res: Response) => {
  try {
    const config = getWclConfig()
    const preview = await WclService.getPlayerReviewScopePreview(config, req.body)
    res.status(200).json(preview)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while previewing review scope.'
    res.status(400).json({
      error: message,
      hint: 'Check player name, scope preset, and report selection.',
    })
  }
})

// Deprecated (WP0 sunset): prompt-first workflow removed from primary product shape.
// Kept callable only for compatibility while legacy clients are retired.
app.post('/api/player-reviews/prompt', async (req: Request, res: Response) => {
  try {
    const config = getWclConfig()
    const payload = req.body as { snapshot?: unknown }

    const snapshot = payload.snapshot
      ? (payload.snapshot as Parameters<typeof WclService.generatePlayerReviewPrompt>[0])
      : await WclService.getPlayerReviewSnapshot(config, req.body)

    const prompt = WclService.generatePlayerReviewPrompt(snapshot)

    res.status(200).json({
      prompt,
      snapshot,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while generating prompt.'
    res.status(400).json({
      error: message,
      hint: 'Generate a snapshot first or provide a valid snapshot payload.',
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
  try {
    const config = getWclConfig()
    const preview = await getExportPreview(config, req.body)
    res.status(200).json(preview)
  } catch (error) {
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
  try {
    const config = getWclConfig()
    validateExportStartRequest(req.body)
    const jobStart = startExportJob(config, req.body)
    res.status(202).json(jobStart)
  } catch (error) {
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
  try {
    const config = getWclConfig()
    const body = req.body as import('./player-analysis/player-analysis.types').BenchmarkCandidatesRequest
    console.log('[benchmark-candidates] baselines:', JSON.stringify(
      (body.baselines ?? []).map((b) => ({
        encounterId: b.encounterId,
        difficulty: b.difficulty,
        className: b.className,
        specName: b.specName,
      }))
    ))
    const result = await PlayerAnalysisBenchmarkService.findBenchmarkCandidates(config, body)
    res.status(200).json(result)
  } catch (error) {
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

app.get('/api/bosses/recent', async (_req: Request, res: Response) => {
  try {
    const config = getWclConfig()
    const responsePayload = await WclService.listRecentBosses(config)

    res.status(200).json(responsePayload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching recent bosses.'

    res.status(500).json({
      error: message,
      hint: 'Verify WCL credentials and guild configuration.',
    })
  }
})

app.get('/api/bosses/:encounterId/recent-fights', async (req: Request, res: Response) => {
  try {
    const encounterId = resolveEncounterId(req.params.encounterId)

    if (!encounterId) {
      res.status(400).json({
        error: 'Invalid encounterId. Expected a positive number.',
      })
      return
    }

    const config = getWclConfig()
    const responsePayload = await WclService.listRecentBossFights(config, encounterId)

    res.status(200).json(responsePayload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching recent boss fights.'

    res.status(500).json({
      error: message,
      hint: 'Verify WCL credentials and encounter ID.',
    })
  }
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

startServer()
