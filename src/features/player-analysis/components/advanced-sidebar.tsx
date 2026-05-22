import type { FC } from 'react'
import type { ReportSummary } from '@/features/reports/types/report-summary'
import {
  EXPERIMENTAL_EXPORT_VIEWS,
  STABLE_EXPORT_VIEWS,
  VIEW_LABELS,
  type PlayerAnalysisExportView,
  type PlayerAnalysisTimeframePreset,
} from '@/features/player-analysis/types/player-analysis.types'
import { CLASS_NAMES, getSpecsForClass, getRoleForSpec } from '@/features/player-analysis/types/wow-class-spec'
import type { ClassSpecOverride } from '@/features/player-analysis/types/class-spec-override'

const S = {
  bg0: '#1a1b1e',
  bg2: '#2b2d31',
  bg3: '#313338',
  text: '#f2f3f5',
  textMuted: '#b5bac1',
  textFaint: '#949ba4',
  textDim: '#6d6f78',
  border: 'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.10)',
  accent: '#5865f2',
  warning: '#f0b232',
  danger: '#da373c',
}

type ManualBenchmarkConfig = {
  reportCode: string
  fightId: string
  playerName: string
}

type AutoBenchmarkConfig = {
  targetPercentile: 50 | 75 | 90
  metric: string
  itemLevelWindow: number
  durationWindowPercent: number
}

type AdvancedSidebarProps = {
  open: boolean
  onClose: () => void

  // Scope
  reports: ReportSummary[]
  reportsLoading: boolean
  reportsError: string | null
  timeframePreset: PlayerAnalysisTimeframePreset
  selectedReports: string[]
  includeKills: boolean
  includeWipes: boolean
  includeTrash: boolean
  onlyPlayerPresent: boolean
  onTimeframePresetChange: (value: PlayerAnalysisTimeframePreset) => void
  onSelectedReportsChange: (value: string[]) => void
  onIncludeKillsChange: (value: boolean) => void
  onIncludeWipesChange: (value: boolean) => void
  onIncludeTrashChange: (value: boolean) => void
  onOnlyPlayerPresentChange: (value: boolean) => void

  // Benchmark
  benchmarkMode: 'none' | 'manual' | 'auto'
  manualBenchmarkConfig: ManualBenchmarkConfig
  autoBenchmarkConfig: AutoBenchmarkConfig
  onBenchmarkModeChange: (mode: 'none' | 'manual' | 'auto') => void
  onManualBenchmarkConfigChange: (config: ManualBenchmarkConfig) => void
  onAutoConfigChange: (config: AutoBenchmarkConfig) => void

  // Class/spec override
  benchmarkContextSource: 'wclDetected' | 'userProvided'
  playerUserContext: ClassSpecOverride | null
  onBenchmarkContextSourceChange: (source: 'wclDetected' | 'userProvided') => void
  onClassSpecOverrideChange: (ctx: ClassSpecOverride | null) => void

  // Export views
  selectedViews: PlayerAnalysisExportView[]
  onSelectedViewsChange: (views: PlayerAnalysisExportView[]) => void
}

export const AdvancedSidebar: FC<AdvancedSidebarProps> = ({
  open,
  onClose,
  reports,
  reportsLoading,
  reportsError,
  timeframePreset,
  selectedReports,
  includeKills,
  includeWipes,
  includeTrash,
  onlyPlayerPresent,
  onTimeframePresetChange,
  onSelectedReportsChange,
  onIncludeKillsChange,
  onIncludeWipesChange,
  onIncludeTrashChange,
  onOnlyPlayerPresentChange,
  benchmarkMode,
  manualBenchmarkConfig,
  autoBenchmarkConfig,
  onBenchmarkModeChange,
  onManualBenchmarkConfigChange,
  onAutoConfigChange,
  benchmarkContextSource,
  playerUserContext,
  onBenchmarkContextSourceChange,
  onClassSpecOverrideChange,
  selectedViews,
  onSelectedViewsChange,
}) => {
  if (!open) return null

  const specEntries = playerUserContext?.className
    ? getSpecsForClass(playerUserContext.className)
    : []

  const toggleView = (view: PlayerAnalysisExportView, checked: boolean) => {
    onSelectedViewsChange(
      checked ? [...selectedViews, view] : selectedViews.filter((v) => v !== view)
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          zIndex: 200,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 360,
          backgroundColor: S.bg2,
          borderLeft: `1px solid ${S.border}`,
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
          animation: 'sideSlide 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: `1px solid ${S.border}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: S.text }}>Advanced Options</span>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: `1px solid ${S.border}`,
              background: 'none',
              color: S.textFaint,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {/* ── Scope ── */}
          <SBSection title="Scope">
            <SBLabel>Timeframe</SBLabel>
            <select
              value={timeframePreset}
              onChange={(e) => onTimeframePresetChange(e.target.value as PlayerAnalysisTimeframePreset)}
              style={selectStyle}
            >
              <option value="last30Days">Last 30 days (default)</option>
              <option value="latestRaid">Latest raid session</option>
              <option value="last7Days">Last 7 days</option>
              <option value="last14Days">Last 14 days</option>
              <option value="previousCalendarWeek">Previous calendar week</option>
              <option value="manualReports">Manual report selection</option>
            </select>

            {timeframePreset === 'manualReports' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: S.textDim }}>Reports</span>
                  <div style={{ display: 'flex', gap: 8, fontSize: 10, color: S.textDim }}>
                    <button type="button" style={linkBtnStyle} onClick={() => onSelectedReportsChange(reports.map((r) => r.code))}>Select all</button>
                    <button type="button" style={linkBtnStyle} onClick={() => onSelectedReportsChange([])}>Clear</button>
                  </div>
                </div>
                <div style={{ maxHeight: 160, overflow: 'auto', borderRadius: 6, border: `1px solid ${S.border}`, background: S.bg0, padding: '6px 8px', fontSize: 11 }}>
                  {reportsLoading && <p style={{ color: S.textDim }}>Loading…</p>}
                  {!reportsLoading && reportsError && <p style={{ color: '#f0b232' }}>Could not load reports.</p>}
                  {!reportsLoading && reports.length === 0 && <p style={{ color: S.textDim }}>No reports available.</p>}
                  {!reportsLoading && reports.map((r) => (
                    <SBCheck
                      key={r.code}
                      label={`${r.title} (${r.code})`}
                      checked={selectedReports.includes(r.code)}
                      onChange={(checked) => {
                        const next = checked
                          ? [...selectedReports, r.code]
                          : selectedReports.filter((c) => c !== r.code)
                        onSelectedReportsChange(next)
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <SBCheck label="Only player-present fights" checked={onlyPlayerPresent} onChange={onOnlyPlayerPresentChange} />
            <SBCheck label="Include kills" checked={includeKills} onChange={onIncludeKillsChange} />
            <SBCheck label="Include wipes" checked={includeWipes} onChange={onIncludeWipesChange} />
            <SBCheck label="Include trash" checked={includeTrash} onChange={onIncludeTrashChange} disabled />
          </SBSection>

          {/* ── Benchmark ── */}
          <SBSection title="Benchmark">
            <SBLabel>Mode</SBLabel>
            <select
              value={benchmarkMode}
              onChange={(e) => onBenchmarkModeChange(e.target.value as 'none' | 'manual' | 'auto')}
              style={selectStyle}
            >
              <option value="auto">Auto-discover</option>
              <option value="manual">Manual log</option>
              <option value="none">Disabled</option>
            </select>

            {benchmarkMode === 'auto' && (
              <>
                <SBLabel>Target percentile</SBLabel>
                <select
                  value={autoBenchmarkConfig.targetPercentile}
                  onChange={(e) => onAutoConfigChange({ ...autoBenchmarkConfig, targetPercentile: Number(e.target.value) as 50 | 75 | 90 })}
                  style={selectStyle}
                >
                  <option value={50}>50th</option>
                  <option value={75}>75th</option>
                  <option value={90}>90th</option>
                </select>
                <SBLabel>Metric</SBLabel>
                <input
                  style={inputStyle}
                  value={autoBenchmarkConfig.metric}
                  onChange={(e) => onAutoConfigChange({ ...autoBenchmarkConfig, metric: e.target.value })}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <SBLabel>±ilvl window</SBLabel>
                    <input
                      type="number"
                      style={inputStyle}
                      value={autoBenchmarkConfig.itemLevelWindow}
                      onChange={(e) => onAutoConfigChange({ ...autoBenchmarkConfig, itemLevelWindow: Number(e.target.value) })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <SBLabel>±% kill time</SBLabel>
                    <input
                      type="number"
                      style={inputStyle}
                      value={autoBenchmarkConfig.durationWindowPercent}
                      onChange={(e) => onAutoConfigChange({ ...autoBenchmarkConfig, durationWindowPercent: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </>
            )}

            {benchmarkMode === 'manual' && (
              <>
                <SBLabel>Report code</SBLabel>
                <input style={inputStyle} value={manualBenchmarkConfig.reportCode} onChange={(e) => onManualBenchmarkConfigChange({ ...manualBenchmarkConfig, reportCode: e.target.value })} />
                <SBLabel>Fight ID</SBLabel>
                <input type="number" style={inputStyle} value={manualBenchmarkConfig.fightId} onChange={(e) => onManualBenchmarkConfigChange({ ...manualBenchmarkConfig, fightId: e.target.value })} />
                <SBLabel>Player name</SBLabel>
                <input style={inputStyle} value={manualBenchmarkConfig.playerName} onChange={(e) => onManualBenchmarkConfigChange({ ...manualBenchmarkConfig, playerName: e.target.value })} />
              </>
            )}
          </SBSection>

          {/* ── Class / Spec Override ── */}
          <SBSection title="Class / Spec Override">
            <SBLabel>Context source</SBLabel>
            <select
              value={benchmarkContextSource}
              onChange={(e) => onBenchmarkContextSourceChange(e.target.value as 'wclDetected' | 'userProvided')}
              style={selectStyle}
            >
              <option value="wclDetected">WCL-detected</option>
              <option value="userProvided">User-provided</option>
            </select>

            <SBLabel>Class</SBLabel>
            <select
              value={playerUserContext?.className ?? ''}
              onChange={(e) => {
                const cls = e.target.value
                if (!cls) {
                  onClassSpecOverrideChange(null)
                } else {
                  onClassSpecOverrideChange({ className: cls, specName: '', role: undefined })
                }
              }}
              style={selectStyle}
            >
              <option value="">(auto)</option>
              {CLASS_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <SBLabel>Spec</SBLabel>
            <select
              value={playerUserContext?.specName ?? ''}
              disabled={!playerUserContext?.className}
              onChange={(e) => {
                const spec = e.target.value
                const cls = playerUserContext?.className ?? ''
                const role = spec ? (getRoleForSpec(cls, spec) ?? undefined) : undefined
                onClassSpecOverrideChange({ className: cls, specName: spec, role })
              }}
              style={{ ...selectStyle, opacity: !playerUserContext?.className ? 0.45 : 1 }}
            >
              <option value="">(auto)</option>
              {specEntries.map((s) => <option key={s.specName} value={s.specName}>{s.specName}</option>)}
            </select>
          </SBSection>

          {/* ── Export Views ── */}
          <SBSection title="Export Views">
            {STABLE_EXPORT_VIEWS.map((v) => (
              <SBCheck key={v} label={VIEW_LABELS[v]} checked={selectedViews.includes(v)} onChange={(checked) => toggleView(v, checked)} />
            ))}
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: `${S.warning}06`, border: `1px solid ${S.warning}15` }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.warning, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Experimental
              </div>
              {EXPERIMENTAL_EXPORT_VIEWS.map((v) => (
                <SBCheck key={v} label={VIEW_LABELS[v]} checked={selectedViews.includes(v)} onChange={(checked) => toggleView(v, checked)} />
              ))}
            </div>
          </SBSection>
        </div>
      </div>
    </>
  )
}

// ── Internal sub-components ──────────────────────────────────────────────────

const SBSection: FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 700, color: S.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
      {title}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {children}
    </div>
  </div>
)

const SBLabel: FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontSize: 11, color: S.textDim }}>{children}</span>
)

const SBCheck: FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({
  label,
  checked,
  onChange,
  disabled,
}) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: disabled ? 0.35 : 1 }}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      style={{ accentColor: S.accent }}
    />
    <span style={{ fontSize: 12, color: S.textMuted }}>{label}</span>
  </label>
)

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  backgroundColor: '#1a1b1e',
  border: '1px solid rgba(255,255,255,0.06)',
  color: '#f2f3f5',
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  backgroundColor: '#1a1b1e',
  border: '1px solid rgba(255,255,255,0.06)',
  color: '#f2f3f5',
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
}

const linkBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#6d6f78',
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'inherit',
}
