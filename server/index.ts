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
