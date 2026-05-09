import type { FC } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { BossDetailsContainer } from '@/features/bosses/containers/boss-details-container'
import { BossesOverviewContainer } from '@/features/bosses/containers/bosses-overview-container'
import { FightReviewContainer } from '@/features/fights/containers/fight-review-container'
import { ReportDetailsContainer } from '@/features/reports/containers/report-details-container'
import { ReportsDashboardContainer } from '@/features/reports/containers/reports-dashboard-container'
import { PATHS } from '@/lib/routes'

export const App: FC = () => (
  <AppLayout>
    <Routes>
      <Route path={PATHS.HOME} element={<ReportsDashboardContainer />} />
      <Route path={PATHS.BOSSES} element={<BossesOverviewContainer />} />
      <Route path={PATHS.BOSS_DETAILS} element={<BossDetailsContainer />} />
      <Route path={PATHS.REPORT_DETAILS} element={<ReportDetailsContainer />} />
      <Route path={PATHS.FIGHT_REVIEW} element={<FightReviewContainer />} />
      <Route path="*" element={<Navigate to={PATHS.HOME} replace />} />
    </Routes>
  </AppLayout>
)
