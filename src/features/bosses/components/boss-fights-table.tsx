import type { FC } from 'react'
import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusPill } from '@/components/ui/status-pill'
import { getFightReviewPath, getReportDetailsPath } from '@/lib/routes'
import { BossesMapper } from '../mappers/bosses.mapper'
import type { BossFightListItem } from '../types/boss-fight-list-item'

type BossFightsTableProps = {
  fights: BossFightListItem[]
}

export const BossFightsTable: FC<BossFightsTableProps> = ({ fights }) => (
  <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
    <table className="min-w-full divide-y divide-slate-800 text-sm">
      <thead className="bg-slate-900/90">
        <tr>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Date / time</th>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Report</th>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Fight ID</th>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Result</th>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Difficulty</th>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Duration</th>
          <th className="px-3 py-2 text-left font-medium text-slate-300">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800 bg-slate-950/20">
        {fights.map((fight) => (
          <tr key={`${fight.reportCode}-${fight.fightId}`}>
            <td className="px-3 py-2 text-slate-300">{BossesMapper.formatFightDate(fight)}</td>
            <td className="px-3 py-2 text-slate-100">{fight.reportTitle}</td>
            <td className="px-3 py-2 text-slate-300">{fight.fightId}</td>
            <td className="px-3 py-2">
              <StatusPill text={fight.kill ? 'Kill' : 'Wipe'} tone={fight.kill ? 'success' : 'danger'} />
            </td>
            <td className="px-3 py-2 text-slate-300">{fight.difficulty}</td>
            <td className="px-3 py-2 text-slate-300">{BossesMapper.formatFightDuration(fight)}</td>
            <td className="px-3 py-2">
              <div className="flex items-center gap-2">
                <Link
                  to={getReportDetailsPath(fight.reportCode)}
                  className="inline-flex rounded-md border border-violet-500/40 px-2.5 py-1 text-xs text-violet-200 hover:bg-violet-500/10"
                >
                  View report
                </Link>
                <Link
                  to={getFightReviewPath(fight.reportCode, fight.fightId)}
                  className="inline-flex rounded-md border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10"
                >
                  Review
                </Link>
                <a
                  href={fight.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  WCL
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
