import type { FC } from 'react'
import { EXPERIMENTAL_EXPORT_VIEWS, STABLE_EXPORT_VIEWS, VIEW_LABELS, type PlayerAnalysisExportView } from '../types/player-analysis.types'

type Props = {
  selectedViews: PlayerAnalysisExportView[]
  onSelectedViewsChange: (views: PlayerAnalysisExportView[]) => void
}

export const PlayerAnalysisViewsForm: FC<Props> = ({ selectedViews, onSelectedViewsChange }) => {
  const toggle = (view: PlayerAnalysisExportView, checked: boolean) => {
    if (checked) {
      onSelectedViewsChange([...selectedViews, view])
    } else {
      onSelectedViewsChange(selectedViews.filter((v) => v !== view))
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="text-sm font-semibold text-slate-200">Export Views</h2>

      <p className="mt-2 text-xs font-medium text-slate-400">Default views</p>
      <div className="mt-1 space-y-1.5">
        {STABLE_EXPORT_VIEWS.map((view) => (
          <label key={view} className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={selectedViews.includes(view)}
              onChange={(e) => toggle(view, e.target.checked)}
            />
            {VIEW_LABELS[view]}
          </label>
        ))}
      </div>

      <div className="mt-3 rounded border border-amber-700/30 bg-amber-950/20 p-2">
        <p className="text-xs font-medium text-amber-400">Experimental views</p>
        <p className="mt-0.5 text-xs text-amber-300/70">These may fail or return no data for some bosses.</p>
        <div className="mt-2 space-y-1.5">
          {EXPERIMENTAL_EXPORT_VIEWS.map((view) => (
            <label key={view} className="flex items-center gap-2 text-xs text-amber-200">
              <input
                type="checkbox"
                checked={selectedViews.includes(view)}
                onChange={(e) => toggle(view, e.target.checked)}
              />
              {VIEW_LABELS[view]}
            </label>
          ))}
        </div>
      </div>
    </section>
  )
}
