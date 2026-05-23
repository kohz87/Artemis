import { useCallback, useEffect, useState } from 'react'
import { callWebBackend } from '../backend/client'
import { shouldHideGitignoredFiles } from '../lib/gitignoredVisibility'
import {
  notifyGitignoredVisibilityChanged,
  TOGGLE_GITIGNORED_VISIBILITY_EVENT,
} from '../lib/gitignoredVisibilityEvents'
import { normalizeReleaseChannel, serializeReleaseChannel } from '../lib/releaseChannel'
import { normalizeThemeMode } from '../lib/themeMode'
import type { Settings } from '../types'
import { normalizeNoteWidthMode } from '../utils/noteWidth'

const EMPTY_SETTINGS: Settings = {
  auto_pull_interval_minutes: null,
  autogit_enabled: null,
  autogit_idle_threshold_seconds: null,
  autogit_inactive_threshold_seconds: null,
  auto_advance_inbox_after_organize: null,
  telemetry_consent: null,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
  release_channel: null,
  theme_mode: null,
  ui_language: null,
  note_width_mode: null,
  note_width_overrides: null,
  hide_gitignored_files: null,
  all_notes_show_pdfs: null,
  all_notes_show_images: null,
  all_notes_show_unsupported: null,
  word_wrap_enabled: null,
}

function normalizeNoteWidthOverrides(value: unknown): Settings['note_width_overrides'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const normalized: NonNullable<Settings['note_width_overrides']> = {}

  for (const [path, mode] of Object.entries(value)) {
    const normalizedPath = path.trim()
    const normalizedMode = normalizeNoteWidthMode(mode)
    if (normalizedPath && normalizedMode) normalized[normalizedPath] = normalizedMode
  }

  return Object.keys(normalized).length > 0 ? normalized : null
}

function normalizeSettings(settings: Settings): Settings {
  const noteWidthOverrides = Object.prototype.hasOwnProperty.call(settings, 'note_width_overrides')
    ? { note_width_overrides: normalizeNoteWidthOverrides(settings.note_width_overrides) }
    : {}

  return {
    ...settings,
    release_channel: serializeReleaseChannel(
      normalizeReleaseChannel(settings.release_channel),
    ),
    theme_mode: normalizeThemeMode(settings.theme_mode),
    ui_language: null,
    note_width_mode: normalizeNoteWidthMode(settings.note_width_mode),
    ...noteWidthOverrides,
    hide_gitignored_files: settings.hide_gitignored_files ?? null,
    all_notes_show_pdfs: settings.all_notes_show_pdfs ?? null,
    all_notes_show_images: settings.all_notes_show_images ?? null,
    all_notes_show_unsupported: settings.all_notes_show_unsupported ?? null,
    word_wrap_enabled: settings.word_wrap_enabled ?? null,
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  const loadSettings = useCallback(async () => {
    try {
      const s = await callWebBackend<Settings>('get_settings', {})
      setSettings(normalizeSettings(s))
    } catch (err) {
      console.warn('Failed to load settings:', err)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const saveSettings = useCallback(async (newSettings: Settings) => {
    const previousHideGitignored = shouldHideGitignoredFiles(settings)
    const normalizedSettings = normalizeSettings(newSettings)
    try {
      await callWebBackend<null>('save_settings', { settings: normalizedSettings })
      setSettings(normalizedSettings)
      const nextHideGitignored = shouldHideGitignoredFiles(normalizedSettings)
      if (previousHideGitignored !== nextHideGitignored) {
        notifyGitignoredVisibilityChanged(nextHideGitignored)
      }
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }, [settings])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleToggleGitignoredVisibility = () => {
      void saveSettings({
        ...settings,
        hide_gitignored_files: !shouldHideGitignoredFiles(settings),
      })
    }

    window.addEventListener(TOGGLE_GITIGNORED_VISIBILITY_EVENT, handleToggleGitignoredVisibility)
    return () => {
      window.removeEventListener(TOGGLE_GITIGNORED_VISIBILITY_EVENT, handleToggleGitignoredVisibility)
    }
  }, [saveSettings, settings])

  return { settings, loaded, saveSettings }
}
