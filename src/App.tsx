import type { FC } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { PlayerAnalysisPage } from '@/features/player-analysis/containers/player-analysis-page'
import { PATHS } from '@/lib/routes'

export const App: FC = () => (
  <AppLayout>
    <Routes>
      <Route path={PATHS.HOME} element={<PlayerAnalysisPage />} />
      <Route path={PATHS.PLAYER_ANALYSIS} element={<PlayerAnalysisPage />} />
      <Route path="*" element={<Navigate to={PATHS.HOME} replace />} />
    </Routes>
  </AppLayout>
)
