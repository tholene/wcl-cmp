import { apiFetch } from '@/lib/http-client'
import { apiUrl } from '@/lib/api-base-url'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import type {
  MechanicAuditExportStartResponse,
  MechanicAuditJob,
  MechanicAuditPreviewResponse,
  MechanicAuditRequest,
} from '../types/mechanic-audit.types'

const withWclContext = <TRequest extends object>(
  request: TRequest,
  context: AppSettingsRequestContext
): TRequest & { wclContext: AppSettingsRequestContext } => ({
  ...request,
  wclContext: context,
})

export const MechanicAuditRestService = {
  getPreview: (
    request: MechanicAuditRequest,
    context: AppSettingsRequestContext
  ): Promise<MechanicAuditPreviewResponse> =>
    apiFetch(apiUrl('/api/mechanic-audits/preview'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withWclContext(request, context)),
    }),

  startExport: (
    request: MechanicAuditRequest,
    context: AppSettingsRequestContext
  ): Promise<MechanicAuditExportStartResponse> =>
    apiFetch(apiUrl('/api/mechanic-audits/export'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withWclContext(request, context)),
    }),

  getExportStatus: (auditId: string): Promise<MechanicAuditJob> =>
    apiFetch(apiUrl(`/api/mechanic-audits/${auditId}/status`)),
}
