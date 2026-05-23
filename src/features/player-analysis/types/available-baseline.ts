export type AvailableBaseline = {
  key: string
  reportCode: string
  reportTitle: string
  fightId: number
  encounterId: number
  encounterName: string
  difficulty: number
  durationMs: number
  kill: boolean
  playerName: string
  className: string
  specName: string
  itemLevel: number | null
  playerParse?: number | null
}
