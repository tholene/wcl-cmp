import { useState } from 'react'
import type { ClassSpecOverride } from '../types/class-spec-override'

export type ManualBenchmarkFormConfig = {
  reportCode: string
  fightId: string
  playerName: string
}

export type AutoBenchmarkFormConfig = {
  targetPercentile: 50 | 75 | 90 | 95 | 99 | 100
  metric: string
  itemLevelWindow: number
  durationWindowPercent: number
}

export const suggestTargetPercentile = (parse: number | null): 75 | 90 | 95 | 99 | 100 => {
  if (parse === null || parse < 75) return 90
  if (parse < 90) return 95
  if (parse < 95) return 99
  return 100
}

export const useBenchmarkFormState = () => {
  const [benchmarkMode, setBenchmarkMode] = useState<'none' | 'manual' | 'auto'>('auto')
  const [manualBenchmarkConfig, setManualBenchmarkConfig] = useState<ManualBenchmarkFormConfig>({
    reportCode: '', fightId: '', playerName: '',
  })
  const [autoBenchmarkConfig, setAutoBenchmarkConfig] = useState<AutoBenchmarkFormConfig>({
    targetPercentile: 75, metric: 'dps', itemLevelWindow: 10, durationWindowPercent: 35,
  })
  const [allowSubjectOnlyWithoutBenchmark, setAllowSubjectOnlyWithoutBenchmark] = useState(false)
  const [playerUserContext, setPlayerUserContext] = useState<ClassSpecOverride | null>(null)
  const [benchmarkContextSource, setBenchmarkContextSource] = useState<'wclDetected' | 'userProvided'>('wclDetected')

  const manualMissingFields: string[] = []
  if (benchmarkMode === 'manual') {
    if (!manualBenchmarkConfig.reportCode.trim()) manualMissingFields.push('report code')
    if (!manualBenchmarkConfig.fightId.trim()) manualMissingFields.push('fight ID')
    if (!manualBenchmarkConfig.playerName.trim()) manualMissingFields.push('player name')
  }

  return {
    benchmarkMode, setBenchmarkMode,
    manualBenchmarkConfig, setManualBenchmarkConfig,
    autoBenchmarkConfig, setAutoBenchmarkConfig,
    allowSubjectOnlyWithoutBenchmark, setAllowSubjectOnlyWithoutBenchmark,
    playerUserContext, setPlayerUserContext,
    benchmarkContextSource, setBenchmarkContextSource,
    manualMissingFields,
  }
}
