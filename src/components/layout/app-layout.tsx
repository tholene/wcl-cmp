import type { FC, PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { PATHS } from '@/lib/routes'

type AppLayoutProps = PropsWithChildren

const NAV_LINKS = [
  { to: PATHS.PLAYER_ANALYSIS, label: 'Player Analysis' },
  { to: PATHS.MECHANIC_AUDIT, label: 'Mechanic Audit' },
]

export const AppLayout: FC<AppLayoutProps> = ({ children }) => (
  <main className="min-h-screen bg-[#1e1f23] text-[#f2f3f5]">
    <nav className="mx-auto flex max-w-[700px] items-center gap-1 px-6 pt-3">
      {NAV_LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            cn(
              'rounded-md px-2.5 py-1 text-xs font-medium text-[#949ba4] hover:text-[#f2f3f5]',
              isActive && 'bg-[rgba(88,101,242,0.14)] text-[#c9cdfb]'
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
    {children}
  </main>
)
