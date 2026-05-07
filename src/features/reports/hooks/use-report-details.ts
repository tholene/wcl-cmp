import { useQuery } from '@tanstack/react-query'
import { reportsQueryKeys } from '@/lib/query-keys'
import { ReportsService } from '../services/reports.service'

export const useReportDetails = (code?: string) =>
  useQuery({
    queryKey: reportsQueryKeys.detail(code ?? 'missing'),
    queryFn: () => ReportsService.getReportDetails(code ?? ''),
    enabled: Boolean(code),
  })
