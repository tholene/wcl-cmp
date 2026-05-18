import type { FC, PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'
import { PATHS } from '@/lib/routes'
import { cn } from '@/lib/utils'

type AppLayoutProps = PropsWithChildren

const NAV_ITEMS = [
  {
    label: 'Player Analysis Export',
    to: PATHS.PLAYER_ANALYSIS,
  },
] as const

export const AppLayout: FC<AppLayoutProps> = ({ children }) => (
  <main className="min-h-screen bg-slate-950 text-slate-100">
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 lg:p-10">
      <header className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3">
          <h1 className="text-lg font-semibold text-slate-100">Player Analysis Export</h1>
          <p className="text-xs text-slate-400">Export Warcraft Logs data for player analysis workflows.</p>
        </div>

        <nav className="flex items-center gap-2" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-md border px-3 py-1.5 text-sm transition',
                  isActive
                    ? 'border-violet-500/60 bg-violet-500/15 text-violet-200'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {children}
    </div>
  </main>
)
