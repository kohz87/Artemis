import { useState, useCallback, useEffect } from 'react'
import { getVaultConfig, updateVaultConfigField } from '../utils/vaultConfigStore'
import { trackEvent } from '../lib/telemetry'

interface UseRawModeParams {
  activeTabPath: string | null
  /** Flush pending WYSIWYG edits to disk before entering raw mode. */
  onFlushPending?: () => Promise<boolean>
  /** Called synchronously before raw mode is deactivated, so the caller can
   *  flush any debounced raw-editor content into tab state. */
  onBeforeRawEnd?: () => void
}

function clearPersistedRawEditorFallback(): void {
  if (getVaultConfig().editor_mode === 'raw') {
    updateVaultConfigField('editor_mode', 'preview')
  }
}

/**
 * Manages raw editor mode state.
 * Raw mode is a temporary escape hatch; rich BlockNote editing must remain the default
 * whenever a vault opens so stale fallback config cannot strand users in CodeMirror.
 */
export function useRawMode({ activeTabPath, onFlushPending, onBeforeRawEnd }: UseRawModeParams) {
  const [rawEnabled, setRawEnabled] = useState(false)

  useEffect(() => {
    clearPersistedRawEditorFallback()
  }, [])

  const rawMode = rawEnabled && activeTabPath !== null

  const handleToggleRaw = useCallback(async () => {
    trackEvent('raw_mode_toggled')
    if (rawEnabled) {
      onBeforeRawEnd?.()
      setRawEnabled(false)
      updateVaultConfigField('editor_mode', 'preview')
    } else {
      await onFlushPending?.()
      setRawEnabled(true)
      clearPersistedRawEditorFallback()
    }
  }, [rawEnabled, onFlushPending, onBeforeRawEnd])

  return { rawMode, handleToggleRaw }
}
