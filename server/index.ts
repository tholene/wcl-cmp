import cors from 'cors'
import dotenv from 'dotenv'
import express, { type Request, type Response } from 'express'
import { getConfigStatus, getServerConfig, getWclConfig } from './warcraft-logs/wcl-config'
import { WclService } from './warcraft-logs/wcl-service'

dotenv.config()

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

const startServer = () => {
  const serverConfig = getServerConfig()

  app.listen(serverConfig.API_PORT, () => {
    console.log(`API running on http://localhost:${serverConfig.API_PORT}`)
  })
}

startServer()
