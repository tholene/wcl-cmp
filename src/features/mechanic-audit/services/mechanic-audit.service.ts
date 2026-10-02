import { MechanicAuditRestService } from '../api/mechanic-audit-rest.service'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import type {
  MechanicAuditExportStartResponse,
  MechanicAuditJob,
  MechanicAuditPreviewResponse,
  MechanicAuditRequest,
} from '../types/mechanic-audit.types'

export const MechanicAuditService = {
  getPreview: async (
    request: MechanicAuditRequest,
    context: AppSettingsRequestContext
  ): Promise<MechanicAuditPreviewResponse> => MechanicAuditRestService.getPreview(request, context),

  startExport: async (
    request: MechanicAuditRequest,
    context: AppSettingsRequestContext
  ): Promise<MechanicAuditExportStartResponse> => MechanicAuditRestService.startExport(request, context),

  getExportStatus: async (auditId: string): Promise<MechanicAuditJob> =>
    MechanicAuditRestService.getExportStatus(auditId),
}
