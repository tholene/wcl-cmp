import { useMutation } from '@tanstack/react-query'
import { MechanicAuditService } from '../services/mechanic-audit.service'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import type { MechanicAuditRequest } from '../types/mechanic-audit.types'

export const useMechanicAuditPreview = (context: AppSettingsRequestContext) =>
  useMutation({
    mutationFn: (request: MechanicAuditRequest) => MechanicAuditService.getPreview(request, context),
  })
