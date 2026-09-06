import type {
  RosterAvailabilityEntry,
  RosterEvidenceResult,
  RosterPlayerEvidence,
  RosterRaidReport,
} from '@/features/roster-review/types/roster-review.types'

export const makeAvailabilityEntry = (overrides: Partial<RosterAvailabilityEntry> = {}): RosterAvailabilityEntry => ({
  id: `id-${overrides.playerName ?? 'player'}`,
  playerName: 'Bagge',
  className: 'Mage',
  role: 'ranged',
  availability: 'available',
  note: '',
  source: 'manual',
  ...overrides,
})

export const makePlayerEvidence = (overrides: Partial<RosterPlayerEvidence> = {}): RosterPlayerEvidence => ({
  playerName: 'Bagge',
  resolvedName: 'Bagge',
  className: 'Mage',
  primarySpecName: 'Fire',
  specsSeen: ['Fire'],
  wclRole: 'dps',
  status: 'ok',
  logPresence: { reportsPresent: 2, reportsTotal: 2, presentReportCodes: ['R1', 'R2'], absentReportCodes: [] },
  fightPresence: { fightsPresent: 8, fightsTotal: 8, fightsUnknown: 0, satOutKillFights: 0 },
  performance: {
    sampleSize: 4,
    overall: { latest: 80, median: 78, mean: 77, best: 90, worst: 60 },
    bracket: { latest: 70, median: 72, mean: 71, best: 80, worst: 60 },
    itemLevel: { latest: 620, min: 618, max: 620 },
    output: { latestAmount: 1_500_000, meanAmount: 1_400_000, metric: 'dps' },
    overallSources: { rankPercent: 4, derivedFromRank: 0 },
  },
  consistency: { spread: 30, bestMinusMedian: 12, belowFiftyCount: 0, atLeastSeventyFiveCount: 3 },
  execution: { killFightsChecked: 4, killFightsDeathUnknown: 0, deaths: 1, fightsWithDeath: 1, earliestDeathPercentOfFight: 60 },
  signals: [],
  fights: [],
  warnings: [],
  ...overrides,
})

export const makeEvidenceResult = (players: RosterPlayerEvidence[], overrides: Partial<RosterEvidenceResult> = {}): RosterEvidenceResult => ({
  reportCodes: ['R1', 'R2'],
  difficulty: 4,
  encounterIds: [],
  reports: [
    { code: 'R1', title: 'Raid 1', url: 'https://www.warcraftlogs.com/reports/R1', startTime: 1_000, fightsConsidered: 4, killFightsConsidered: 4, loaded: true },
    { code: 'R2', title: 'Raid 2', url: 'https://www.warcraftlogs.com/reports/R2', startTime: 2_000, fightsConsidered: 4, killFightsConsidered: 4, loaded: true },
  ],
  players,
  warnings: [],
  generatedAt: 3_000,
  ...overrides,
})

export const makeRaidReport = (overrides: Partial<RosterRaidReport> = {}): RosterRaidReport => ({
  code: 'R1',
  title: 'Raid 1',
  url: 'https://www.warcraftlogs.com/reports/R1',
  startTime: 1_000,
  endTime: 5_000,
  zoneId: 46,
  zoneName: 'Liberation of Undermine',
  fights: [
    { id: 1, encounterId: 3001, encounterName: 'Boss A', difficulty: 4, kill: true, startTime: 1_100, durationMs: 200_000 },
    { id: 2, encounterId: 3002, encounterName: 'Boss B', difficulty: 4, kill: false, startTime: 1_400, durationMs: 100_000 },
  ],
  killCountsByDifficulty: { '4': 1 },
  participants: [
    { name: 'Bagge', className: 'Mage' },
    { name: 'Kormath', className: 'Warrior' },
  ],
  warnings: [],
  ...overrides,
})
