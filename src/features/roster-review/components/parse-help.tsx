import type { FC } from 'react'
import { RosterHelp } from './roster-ui'

export const OVERALL_PARSE_TOOLTIP =
  'Overall parse: WCL percentile against all players of the same spec on this boss/difficulty. Primary performance context: "how strong was the result?"'

export const BRACKET_PARSE_TOOLTIP =
  'Ilvl / bracket parse: percentile against players of the same spec with similar item level. Secondary diagnostic context: "how efficiently is the player performing for the gear they have?"'

export const ParseHelp: FC = () => (
  <RosterHelp title="How to read overall vs ilvl-bracket parse">
    <p>
      <span className="font-semibold text-slate-100">Overall parse</span> (primary performance context) compares the player with
      everyone of the same spec on that boss and difficulty. It answers: how strong was the result?
    </p>
    <p>
      <span className="font-semibold text-slate-100">Ilvl / bracket parse</span> (secondary diagnostic context) compares only with
      similarly geared players. It answers: how efficiently is the player performing for the gear they have?
    </p>
    <p>
      For progression selection, current output matters more than being efficient while undergeared. A high bracket parse with a
      low overall parse usually points at gear, not skill. Neither number selects the roster on its own.
    </p>
    <p>
      <span className="font-semibold text-slate-100">Median</span> is the typical kill, <span className="font-semibold text-slate-100">latest</span> the
      most recent kill, <span className="font-semibold text-slate-100">best</span> the single best kill. Prefer repeatable results over one best log.
    </p>
    <p>
      <span className="font-semibold text-slate-100">Logs</span> counts presence in the selected reports. Missing from a log is not
      proof of an unexcused absence; use the availability notes for signups.
    </p>
  </RosterHelp>
)
