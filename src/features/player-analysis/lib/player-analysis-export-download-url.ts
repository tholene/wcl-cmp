import { apiUrl } from '@/lib/api-base-url'

export const buildExportDownloadUrl = (exportId: string, filename: string): string =>
  apiUrl(`/api/player-analysis/exports/${exportId}/${encodeURIComponent(filename)}`)
