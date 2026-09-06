import { RosterReviewRestService } from '../api/roster-review-rest.service'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import type {
  RosterEvidenceJob,
  RosterEvidenceRequest,
  RosterEvidenceStartResponse,
  RosterRaidReportsResponse,
} from '../types/roster-review.types'

export const RosterReviewService = {
  listRaidReports: (context: AppSettingsRequestContext): Promise<RosterRaidReportsResponse> =>
    RosterReviewRestService.listRaidReports(context),

  startEvidenceJob: (
    request: RosterEvidenceRequest,
    context: AppSettingsRequestContext
  ): Promise<RosterEvidenceStartResponse> => RosterReviewRestService.startEvidenceJob(request, context),

  getEvidenceJob: (jobId: string): Promise<RosterEvidenceJob> => RosterReviewRestService.getEvidenceJob(jobId),
}
