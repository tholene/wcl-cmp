export const reportsQueryKeys = {
  all: ['reports'] as const,
  recent: () => [...reportsQueryKeys.all, 'recent'] as const,
  detail: (code: string) => [...reportsQueryKeys.all, 'detail', code] as const,
}
