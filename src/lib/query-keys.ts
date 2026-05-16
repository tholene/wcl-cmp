export const reportsQueryKeys = {
  all: ['reports'] as const,
  recent: () => [...reportsQueryKeys.all, 'recent'] as const,
  detail: (code: string) => [...reportsQueryKeys.all, 'detail', code] as const,
}

export const bossesQueryKeys = {
  all: ['bosses'] as const,
  recent: () => [...bossesQueryKeys.all, 'recent'] as const,
  recentFights: (encounterId: number) => [...bossesQueryKeys.all, 'recentFights', encounterId] as const,
}

export const fightsQueryKeys = {
  all: ['fights'] as const,
  review: (code: string, fightId: number) => [...fightsQueryKeys.all, 'review', code, fightId] as const,
}

export const playersQueryKeys = {
  all: ['players'] as const,
  fightReview: (code: string, fightId: number, playerId: number) =>
    [...playersQueryKeys.all, 'fightReview', code, fightId, playerId] as const,
}


export const playerAnalysisQueryKeys = {
  all: ['playerAnalysis'] as const,
  recentPlayers: () => [...playerAnalysisQueryKeys.all, 'recentPlayers'] as const,
  exportStatus: (exportId: string) => [...playerAnalysisQueryKeys.all, 'status', exportId] as const,
}
