import { useQuery } from '@tanstack/react-query'
import { reportsQueryKeys } from '@/lib/query-keys'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import { ReportsService } from '../services/reports.service'

export const useRecentReports = (context: AppSettingsRequestContext) =>
  useQuery({
    queryKey: reportsQueryKeys.recent(context),
    queryFn: () => ReportsService.listRecentReports(context),
  })
