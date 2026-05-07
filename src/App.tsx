import type { FC } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { PATHS } from '@/lib/routes'
import { ReportDetailsContainer } from '@/features/reports/containers/report-details-container'
import { ReportsDashboardContainer } from '@/features/reports/containers/reports-dashboard-container'

export const App: FC = () => (
  <AppLayout>
    <Routes>
      <Route path={PATHS.HOME} element={<ReportsDashboardContainer />} />
      <Route path={PATHS.REPORT_DETAILS} element={<ReportDetailsContainer />} />
      <Route path="*" element={<Navigate to={PATHS.HOME} replace />} />
    </Routes>
  </AppLayout>
)
