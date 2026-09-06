import { useState, type FC } from 'react'
import { cn } from '@/lib/utils'
import { COMPARISON_THRESHOLDS, verdictLabel, type CandidateComparison } from '../lib/candidate-comparison'
import { RosterButton, RosterSectionTitle, RosterTextarea } from './roster-ui'

type ComparePanelProps = {
  comparison: CandidateComparison
  onSaveNote: (text: string) => void
  onClose: () => void
}

export const ComparePanel: FC<ComparePanelProps> = ({ comparison, onSaveNote, onClose }) => {
  // The parent keys this panel by player pair, so a new pair remounts with a fresh draft.
  const [text, setText] = useState(comparison.draftExplanation)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-indigo-400/20 bg-[rgba(43,45,49,0.7)] p-3">
      <RosterSectionTitle right={<RosterButton onClick={onClose}>Close</RosterButton>}>
        {comparison.a.name} vs {comparison.b.name}
      </RosterSectionTitle>
      <p className="text-[11px] text-hint">
        Verdicts use visible thresholds ({COMPARISON_THRESHOLDS.performancePoints} parse points, {COMPARISON_THRESHOLDS.spreadPoints} spread points, {COMPARISON_THRESHOLDS.itemLevelPoints} ilvl).
        They describe material differences; the conclusion is yours.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[11px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-hint">
              <th className="px-2 py-1">Dimension</th>
              <th className="px-2 py-1">{comparison.a.name}</th>
              <th className="px-2 py-1">{comparison.b.name}</th>
              <th className="px-2 py-1">Reading</th>
            </tr>
          </thead>
          <tbody>
            {comparison.dimensions.map((dim) => (
              <tr key={dim.key} className="border-t border-white/[0.05] align-top text-slate-300">
                <td className="px-2 py-1.5">
                  <div className="font-semibold text-slate-100">{dim.label}</div>
                  <div className="text-[10px] text-hint">{dim.detail}</div>
                </td>
                <td className="px-2 py-1.5">{dim.aValue}</td>
                <td className="px-2 py-1.5">{dim.bValue}</td>
                <td className={cn('px-2 py-1.5 font-semibold', dim.verdict === 'aAdvantage' && 'text-emerald-300', dim.verdict === 'bAdvantage' && 'text-sky-300', dim.verdict === 'roughlyEqual' && 'text-slate-200', dim.verdict === 'insufficient' && 'text-amber-300')}>
                  {verdictLabel(dim.verdict, comparison.a.name, comparison.b.name)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RosterTextarea value={text} onChange={setText} rows={8} />
      <div className="flex justify-end gap-2">
        <RosterButton onClick={() => setText(comparison.draftExplanation)}>Reset draft</RosterButton>
        <RosterButton tone="primary" onClick={() => onSaveNote(text)} disabled={text.trim().length === 0}>Save as comparison note</RosterButton>
      </div>
    </div>
  )
}
