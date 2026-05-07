import { useQuery } from '@tanstack/react-query'
import { reportsQueryKeys } from '@/lib/query-keys'
import { ReportsService } from '../services/reports.service'

export const useRecentReports = () =>
  useQuery({
    queryKey: reportsQueryKeys.recent(),
    queryFn: ReportsService.listRecentReports,
  })
