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
