import { lazy, Suspense, type FC } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { MechanicAuditPage } from '@/features/mechanic-audit/containers/mechanic-audit-page'
import { PlayerAnalysisPage } from '@/features/player-analysis/containers/player-analysis-page'
import { PATHS } from '@/lib/routes'

// Officer workflow, code-split into its own chunk.
const RosterReviewPage = lazy(() =>
  import('@/features/roster-review/containers/roster-review-page').then((module) => ({ default: module.RosterReviewPage }))
)

export const App: FC = () => (
  <AppLayout>
    <Routes>
      <Route path={PATHS.HOME} element={<PlayerAnalysisPage />} />
      <Route path={PATHS.PLAYER_ANALYSIS} element={<PlayerAnalysisPage />} />
<<<<<<< Updated upstream
      <Route
        path={PATHS.ROSTER_REVIEW}
        element={
          <Suspense fallback={<div className="p-6 text-sm text-hint">Loading roster review…</div>}>
            <RosterReviewPage />
          </Suspense>
        }
      />
=======
      <Route path={PATHS.MECHANIC_AUDIT} element={<MechanicAuditPage />} />
>>>>>>> Stashed changes
      <Route path="*" element={<Navigate to={PATHS.HOME} replace />} />
    </Routes>
  </AppLayout>
)
