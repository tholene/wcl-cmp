import type { BossFightListItem } from './boss-fight-list-item'

export type RecentBossFightsResponse = {
  generatedAt: number
  source: {
    reportCount: number
    note: string
  }
  boss: {
    encounterId: number
    encounterName: string
  }
  fights: BossFightListItem[]
}
