import type { BossSummary } from './boss-summary'

export type RecentBossesResponse = {
  generatedAt: number
  source: {
    reportCount: number
    note: string
  }
  bosses: BossSummary[]
}
