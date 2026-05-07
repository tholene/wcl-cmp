import type { FC, PropsWithChildren } from 'react'

type AppLayoutProps = PropsWithChildren

export const AppLayout: FC<AppLayoutProps> = ({ children }) => (
  <main className="min-h-screen bg-slate-950 text-slate-100">
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 lg:p-10">{children}</div>
  </main>
)
