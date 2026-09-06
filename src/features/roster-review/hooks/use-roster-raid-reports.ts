import { useQuery } from '@tanstack/react-query'
import { rosterReviewQueryKeys } from '@/lib/query-keys'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import { RosterReviewService } from '../services/roster-review.service'

export const useRosterRaidReports = (context: AppSettingsRequestContext, enabled = true) =>
  useQuery({
    queryKey: rosterReviewQueryKeys.raidReports(context),
    queryFn: () => RosterReviewService.listRaidReports(context),
    enabled,
    staleTime: 5 * 60_000,
  })
