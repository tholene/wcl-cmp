import { useMemo, useState } from 'react'
import {
  clearAppSettings,
  getEffectiveWclSite,
  loadAppSettings,
  saveAppSettings,
} from '@/features/settings/lib/app-settings-storage'
import { DEFAULT_APP_SETTINGS, type AppSettings } from '@/features/settings/types/app-settings'

type AppSettingsUpdater = AppSettings | ((prev: AppSettings) => AppSettings)

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings())

  const updateSettings = (updater: AppSettingsUpdater): AppSettings => {
    let computed = settings
    setSettings((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      computed = saveAppSettings(next)
      return computed
    })
    return computed
  }

  const clearSettings = (): AppSettings => {
    clearAppSettings()
    const defaults = { ...DEFAULT_APP_SETTINGS }
    setSettings(defaults)
    return defaults
  }

  const hasExplicitSite = settings.wclSite !== null
  const effectiveSite = useMemo(() => getEffectiveWclSite(settings), [settings])

  return {
    settings,
    hasExplicitSite,
    effectiveSite,
    updateSettings,
    clearSettings,
  }
}

