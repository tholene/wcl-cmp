import type { FC, PropsWithChildren } from 'react'

type AppLayoutProps = PropsWithChildren

export const AppLayout: FC<AppLayoutProps> = ({ children }) => (
  <main className="min-h-screen bg-[#1e1f23] text-[#f2f3f5]">
    {children}
  </main>
)
