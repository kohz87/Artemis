import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import type { DetectedRename } from '../components/RenameDetectedBanner'

/**
 * Detects external file renames on window focus.
 * Extracted from App.tsx (formerly inline lines 526-550).
 */
export function useRenameDetection({
  vaultPath,
  isNoteWindow,
  onToast,
  onVaultReload,
}: {
  vaultPath: string | null
  isNoteWindow: boolean
  onToast: (message: string) => void
  onVaultReload: () => void
}) {
  const [detectedRenames, setDetectedRenames] = useState<DetectedRename[]>([])

  useEffect(() => {
    if (!isTauri() || !vaultPath) return
    const handleFocus = () => {
      invoke<DetectedRename[]>('detect_renames', { vaultPath })
        .then((renames) => {
          if (renames.length > 0) setDetectedRenames(renames)
        })
        .catch((err) => console.warn('[vault] Git rename detection failed:', err))
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [isNoteWindow, vaultPath])

  const handleUpdateWikilinks = useCallback(async () => {
    if (!isTauri()) return
    try {
      const count = await invoke<number>('update_wikilinks_for_renames', {
        vaultPath,
        renames: detectedRenames,
      })
      setDetectedRenames([])
      onVaultReload()
      onToast(`Updated wikilinks in ${count} file${count !== 1 ? 's' : ''}`)
    } catch (err) {
      onToast(`Failed to update wikilinks: ${err}`)
    }
  }, [detectedRenames, vaultPath, onToast, onVaultReload])

  const handleDismissRenames = useCallback(() => setDetectedRenames([]), [])

  return { detectedRenames, handleUpdateWikilinks, handleDismissRenames }
}
