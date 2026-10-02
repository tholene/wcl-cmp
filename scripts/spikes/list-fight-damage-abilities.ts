import dotenv from 'dotenv'
import { getWclConfig } from '../../server/warcraft-logs/wcl-config'
import {
  fetchReportEventsForFights,
  resolveEventAbilityId,
  resolveEventAbilityName,
} from '../../server/mechanic-audit/mechanic-audit-event-fetcher'

dotenv.config()

type ParsedArgs = {
  report?: string
  fight?: number
  startMs: number
  endMs: number
}

const parseArgs = (argv: string[]): ParsedArgs => {
  const result: ParsedArgs = { startMs: 0, endMs: 999_999_999 }
  for (const arg of argv) {
    const [key, value] = arg.split('=')
    if (key === '--report') result.report = value
    else if (key === '--fight') result.fight = Number(value)
    else if (key === '--start-ms') result.startMs = Number(value)
    else if (key === '--end-ms') result.endMs = Number(value)
  }
  return result
}

const printUsageAndExit = (): void => {
  console.log(
    'Usage: npm run spike:list-fight-damage-abilities -- --report=<code> --fight=<id> [--start-ms=<n>] [--end-ms=<n>]'
  )
  console.log(
    'Lists ability IDs seen in DamageTaken events for a single fight (report-relative ms), to help identify mechanic ability IDs.'
  )
  process.exitCode = 1
}

type AbilitySummary = {
  abilityId: number
  abilityName: string
  eventCount: number
  uniqueTargets: Set<number>
  firstTimestamp: number
  lastTimestamp: number
}

const run = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2))
  if (!args.report || !Number.isFinite(args.fight)) {
    printUsageAndExit()
    return
  }

  const config = getWclConfig()
  const result = await fetchReportEventsForFights({
    config,
    reportCode: args.report,
    fightIds: [args.fight as number],
    abilityIds: [],
    dataType: 'DamageTaken',
    reportStartTime: args.startMs,
    reportEndTime: args.endMs,
  })

  const abilities = new Map<number, AbilitySummary>()
  for (const event of result.events) {
    const abilityId = resolveEventAbilityId(event)
    if (abilityId === undefined) continue
    const abilityName = resolveEventAbilityName(event) ?? `Unknown (${abilityId})`
    const timestamp = event.timestamp ?? 0
    const existing = abilities.get(abilityId)
    if (existing) {
      existing.eventCount += 1
      if (typeof event.targetID === 'number') existing.uniqueTargets.add(event.targetID)
      existing.firstTimestamp = Math.min(existing.firstTimestamp, timestamp)
      existing.lastTimestamp = Math.max(existing.lastTimestamp, timestamp)
    } else {
      abilities.set(abilityId, {
        abilityId,
        abilityName,
        eventCount: 1,
        uniqueTargets: new Set(typeof event.targetID === 'number' ? [event.targetID] : []),
        firstTimestamp: timestamp,
        lastTimestamp: timestamp,
      })
    }
  }

  const rows = [...abilities.values()]
    .sort((a, b) => b.eventCount - a.eventCount)
    .map((entry) => ({
      abilityId: entry.abilityId,
      abilityName: entry.abilityName,
      eventCount: entry.eventCount,
      uniqueTargets: entry.uniqueTargets.size,
      firstTimestamp: entry.firstTimestamp,
      lastTimestamp: entry.lastTimestamp,
    }))

  console.log(
    JSON.stringify(
      {
        reportCode: args.report,
        fightId: args.fight,
        startMs: args.startMs,
        endMs: args.endMs,
        totalEvents: result.events.length,
        truncated: result.truncated,
        warnings: result.warnings,
        abilities: rows,
      },
      null,
      2
    )
  )
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[spike:list-fight-damage-abilities] probe failed:', message)
  process.exitCode = 1
})
