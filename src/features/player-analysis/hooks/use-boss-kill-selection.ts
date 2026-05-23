import { useState } from 'react'
import {
  buildAllEligibleFightSelection,
  buildBaselineKeysFromFightSelection,
  countSelectedFights,
} from '../lib/player-analysis-utils'
import type { PlayerAnalysisExportPreview } from '../types/player-analysis.types'

type UseBossKillSelectionParams = {
  preview: PlayerAnalysisExportPreview | null
  onForcedStepClear: () => void
}

export const useBossKillSelection = ({ preview, onForcedStepClear }: UseBossKillSelectionParams) => {
  const [selectedFightIdsByReport, setSelectedFightIdsByReport] = useState<Record<string, number[]>>({})
  const [selectedBaselineKeys, setSelectedBaselineKeys] = useState<Set<string>>(new Set())
  const [selectedCandidateKeysByBaseline, setSelectedCandidateKeysByBaseline] = useState<Record<string, string>>({})

  const syncSelectedBaselineKeys = (nextKeys: Set<string>) => {
    setSelectedBaselineKeys(new Set(nextKeys))
    setSelectedCandidateKeysByBaseline((current) => {
      const filtered: Record<string, string> = {}
      for (const baselineKey of Object.keys(current)) {
        if (nextKeys.has(baselineKey)) filtered[baselineKey] = current[baselineKey]
      }
      return filtered
    })
  }

  const selectedFightCount = countSelectedFights(selectedFightIdsByReport)

  const handleFightSelectionChange = (reportCode: string, fightId: number, selected: boolean) => {
    setSelectedFightIdsByReport((current) => {
      const existing = current[reportCode] ?? []
      const next = selected
        ? (existing.includes(fightId) ? existing : [...existing, fightId])
        : existing.filter((id) => id !== fightId)
      const nextSelection = { ...current, [reportCode]: next }
      if (preview) syncSelectedBaselineKeys(buildBaselineKeysFromFightSelection(preview, nextSelection))
      return nextSelection
    })
  }

  const handleSelectAllEligibleFights = () => {
    if (!preview) return
    const nextSelection = buildAllEligibleFightSelection(preview)
    setSelectedFightIdsByReport(nextSelection)
    syncSelectedBaselineKeys(buildBaselineKeysFromFightSelection(preview, nextSelection))
  }

  const handleClearFightSelection = () => {
    if (!preview) return
    const empty: Record<string, number[]> = {}
    for (const report of preview.includedReports ?? []) empty[report.code] = []
    setSelectedFightIdsByReport(empty)
    syncSelectedBaselineKeys(new Set())
  }

  const handleBaselineSelectionChange = (next: Set<string>) => {
    syncSelectedBaselineKeys(next)
  }

  const handleBenchmarkCandidateSelection = (baselineKey: string, candidateKey: string) => {
    setSelectedCandidateKeysByBaseline((current) => ({ ...current, [baselineKey]: candidateKey }))
    onForcedStepClear()
  }

  const isSelected = (reportCode: string, fightId: number): boolean =>
    (selectedFightIdsByReport[reportCode] ?? []).includes(fightId)

  return {
    selectedFightIdsByReport,
    setSelectedFightIdsByReport,
    selectedBaselineKeys,
    selectedCandidateKeysByBaseline,
    syncSelectedBaselineKeys,
    selectedFightCount,
    handleFightSelectionChange,
    handleSelectAllEligibleFights,
    handleClearFightSelection,
    handleBaselineSelectionChange,
    handleBenchmarkCandidateSelection,
    isSelected,
  }
}
