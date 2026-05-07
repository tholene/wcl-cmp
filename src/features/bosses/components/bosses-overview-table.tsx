import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { getBossDetailsPath } from '@/lib/routes'
import { BossesMapper } from '../mappers/bosses.mapper'
import type { BossSummary } from '../types/boss-summary'

type BossesOverviewTableProps = {
  bosses: BossSummary[]
}

export const BossesOverviewTable: FC<BossesOverviewTableProps> = ({ bosses }) => (
  <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
    <table className="min-w-full divide-y divide-slate-800 text-sm">
      <thead className="bg-slate-900/90">
        <tr>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Boss</th>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Pulls</th>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Kills</th>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Wipes</th>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Kill rate</th>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Difficulties</th>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Last seen</th>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800 bg-slate-950/20">
        {bosses.map((boss) => (
          <tr key={boss.encounterId}>
            <td className="px-3 py-2 text-slate-100">{boss.encounterName}</td>
            <td className="px-3 py-2 text-slate-300">{boss.pullCount}</td>
            <td className="px-3 py-2 text-emerald-300">{boss.killCount}</td>
            <td className="px-3 py-2 text-rose-300">{boss.wipeCount}</td>
            <td className="px-3 py-2 text-slate-300">{BossesMapper.formatKillRate(boss)}</td>
            <td className="px-3 py-2 text-slate-300">{BossesMapper.formatDifficulties(boss.difficulties)}</td>
            <td className="px-3 py-2 text-slate-300">{BossesMapper.formatLastSeen(boss)}</td>
            <td className="px-3 py-2">
              <Link
                to={getBossDetailsPath(boss.encounterId)}
                className="inline-flex rounded-md border border-violet-500/40 px-2.5 py-1 text-xs text-violet-200 hover:bg-violet-500/10"
              >
                View boss
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
