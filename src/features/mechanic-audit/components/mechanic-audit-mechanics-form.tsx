import type { FC } from 'react'
import type { MechanicAuditMechanicFormEntry } from '../hooks/mechanic-audit-form-reducer'
import type { MechanicAuditNoTransitionFallback, MechanicAuditPhaseOneBoundary } from '../types/mechanic-audit.types'
import { inputStyle, labelStyle, S, selectStyle } from './mechanic-audit-styles'

type MechanicAuditMechanicsFormProps = {
  mechanics: MechanicAuditMechanicFormEntry[]
  onMechanicsChange: (value: MechanicAuditMechanicFormEntry[]) => void
  phaseOneBoundaryMode: MechanicAuditPhaseOneBoundary['mode']
  phaseTransitionPhase: string
  markerAbilityIdsText: string
  fightRelativeEndTimeMs: string
  noTransitionFallbackMode: MechanicAuditNoTransitionFallback['mode']
  noTransitionFallbackAbilityIdsText: string
  onPhaseOneBoundaryModeChange: (value: MechanicAuditPhaseOneBoundary['mode']) => void
  onPhaseTransitionPhaseChange: (value: string) => void
  onMarkerAbilityIdsTextChange: (value: string) => void
  onFightRelativeEndTimeMsChange: (value: string) => void
  onNoTransitionFallbackModeChange: (value: MechanicAuditNoTransitionFallback['mode']) => void
  onNoTransitionFallbackAbilityIdsTextChange: (value: string) => void
}

const emptyMechanic = (): MechanicAuditMechanicFormEntry => ({
  key: '',
  label: '',
  abilityIdsText: '',
  dedupeWindowMsText: '',
  occurrenceAbilityIdsText: '',
  occurrenceEventType: '',
})

export const MechanicAuditMechanicsForm: FC<MechanicAuditMechanicsFormProps> = ({
  mechanics,
  onMechanicsChange,
  phaseOneBoundaryMode,
  phaseTransitionPhase,
  markerAbilityIdsText,
  fightRelativeEndTimeMs,
  noTransitionFallbackMode,
  noTransitionFallbackAbilityIdsText,
  onPhaseOneBoundaryModeChange,
  onPhaseTransitionPhaseChange,
  onMarkerAbilityIdsTextChange,
  onFightRelativeEndTimeMsChange,
  onNoTransitionFallbackModeChange,
  onNoTransitionFallbackAbilityIdsTextChange,
}) => {
  const updateMechanic = (index: number, patch: Partial<MechanicAuditMechanicFormEntry>) => {
    onMechanicsChange(mechanics.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  const removeMechanic = (index: number) => {
    onMechanicsChange(mechanics.filter((_, i) => i !== index))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={labelStyle}>Mechanics</label>
          <button
            type="button"
            onClick={() => onMechanicsChange([...mechanics, emptyMechanic()])}
            style={{
              background: 'none',
              border: 'none',
              color: S.accent,
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Add mechanic
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mechanics.map((mechanic, index) => (
            <div
              key={index}
              style={{
                border: `1px solid ${S.border}`,
                borderRadius: 8,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={inputStyle}
                  value={mechanic.label}
                  onChange={(e) => updateMechanic(index, { label: e.target.value, key: mechanic.key || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') })}
                  placeholder="Label, e.g. Glaives"
                />
                <button
                  type="button"
                  onClick={() => removeMechanic(index)}
                  style={{
                    background: 'none',
                    border: `1px solid ${S.border}`,
                    borderRadius: 6,
                    color: S.danger,
                    width: 32,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  aria-label={`Remove ${mechanic.label || 'mechanic'}`}
                >
                  ×
                </button>
              </div>
              <input
                style={inputStyle}
                value={mechanic.abilityIdsText}
                onChange={(e) => updateMechanic(index, { abilityIdsText: e.target.value })}
                placeholder="Verified ability IDs, e.g. 123456 123457"
              />
              <input
                type="number"
                style={inputStyle}
                value={mechanic.dedupeWindowMsText}
                onChange={(e) => updateMechanic(index, { dedupeWindowMsText: e.target.value })}
                placeholder="Dedupe window ms (default 750)"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={inputStyle}
                  value={mechanic.occurrenceAbilityIdsText}
                  onChange={(e) => updateMechanic(index, { occurrenceAbilityIdsText: e.target.value })}
                  placeholder="Optional: occurrence ability IDs (cast/debuff proving the mechanic happened)"
                />
                <select
                  style={selectStyle}
                  value={mechanic.occurrenceEventType}
                  onChange={(e) =>
                    updateMechanic(index, {
                      occurrenceEventType: e.target.value as MechanicAuditMechanicFormEntry['occurrenceEventType'],
                    })
                  }
                >
                  <option value="">No occurrence event</option>
                  <option value="Casts">Casts</option>
                  <option value="Debuffs">Debuffs</option>
                  <option value="Buffs">Buffs</option>
                </select>
              </div>
              <p style={{ fontSize: 11, color: S.textDim }}>
                Without an occurrence event, "did not occur" is only an approximation from zero damage hits.
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Phase 1 boundary strategy</label>
        <select
          style={selectStyle}
          value={phaseOneBoundaryMode}
          onChange={(e) => onPhaseOneBoundaryModeChange(e.target.value as MechanicAuditPhaseOneBoundary['mode'])}
        >
          <option value="phaseTransition">Phase transition event</option>
          <option value="markerAbility">Marker ability cast</option>
          <option value="fightRelativeTimestamp">Fixed fight-relative timestamp</option>
        </select>

        {phaseOneBoundaryMode === 'phaseTransition' && (
          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>Phase number ending Phase 1</label>
            <input
              type="number"
              style={inputStyle}
              value={phaseTransitionPhase}
              onChange={(e) => onPhaseTransitionPhaseChange(e.target.value)}
            />

            <label style={{ ...labelStyle, marginTop: 8 }}>When no transition event is recorded</label>
            <select
              style={selectStyle}
              value={noTransitionFallbackMode}
              onChange={(e) => onNoTransitionFallbackModeChange(e.target.value as MechanicAuditNoTransitionFallback['mode'])}
            >
              <option value="exclude">Exclude the pull (no fallback)</option>
              <option value="fightEndForWipes">Use fight-end time, wipes only</option>
              <option value="markerAbilityThenFightEndForWipes">Marker ability first, then fight-end for wipes</option>
            </select>

            {noTransitionFallbackMode === 'markerAbilityThenFightEndForWipes' && (
              <input
                style={{ ...inputStyle, marginTop: 8 }}
                value={noTransitionFallbackAbilityIdsText}
                onChange={(e) => onNoTransitionFallbackAbilityIdsTextChange(e.target.value)}
                placeholder="Marker ability IDs (verified)"
              />
            )}

            <p style={{ fontSize: 11, color: S.textDim, marginTop: 6 }}>
              Kills with no resolved transition are never covered by fight-end fallback — a kill is treated as proof
              Phase 2 was reached, so only the marker-ability fallback or exclusion applies.
            </p>
          </div>
        )}

        {phaseOneBoundaryMode === 'markerAbility' && (
          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>Marker ability IDs (verified)</label>
            <input
              style={inputStyle}
              value={markerAbilityIdsText}
              onChange={(e) => onMarkerAbilityIdsTextChange(e.target.value)}
              placeholder="e.g. 987654"
            />
          </div>
        )}

        {phaseOneBoundaryMode === 'fightRelativeTimestamp' && (
          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>Phase 1 end time (ms from pull start)</label>
            <input
              type="number"
              style={inputStyle}
              value={fightRelativeEndTimeMs}
              onChange={(e) => onFightRelativeEndTimeMsChange(e.target.value)}
              placeholder="e.g. 90000"
            />
          </div>
        )}

        <p style={{ fontSize: 11, color: S.textDim, marginTop: 6 }}>
          Run <code>npm run spike:list-fight-damage-abilities -- --report=&lt;code&gt; --fight=&lt;id&gt;</code> against a
          known pull to discover ability IDs before entering them here.
        </p>
      </div>
    </div>
  )
}
