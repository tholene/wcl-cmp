import { apiUrl } from '@/lib/api-base-url'

export const buildMechanicAuditDownloadUrl = (auditId: string, filename: string): string =>
  apiUrl(`/api/mechanic-audits/${auditId}/${encodeURIComponent(filename)}`)
