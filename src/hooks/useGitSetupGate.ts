import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'

export type GitRepoState = 'checking' | 'missing' | 'ready'

interface GitSetupGateHookProps {
  vaultPath: string | null
  noteWindowParams: unknown
  onToast: (message: string) => void
}

/**
 * Manages git repo detection and setup dialog for a vault.
 * Extracted from App.tsx lines 351-396.
 */
export function useGitSetupGate({
  vaultPath,
  noteWindowParams,
  onToast,
}: GitSetupGateHookProps) {
  const [gitRepoState, setGitRepoState] = useState<GitRepoState>('checking')
  const [showGitSetupDialog, setShowGitSetupDialog] = useState(false)
  const dismissedGitSetupPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (!vaultPath) return
    setGitRepoState('checking') // eslint-disable-line react-hooks/set-state-in-effect -- reset state on path change
    const check = isTauri()
      ? invoke<boolean>('is_git_repo', { vaultPath })
      : mockInvoke<boolean>('is_git_repo', { vaultPath })
    check
      .then((isGit) => setGitRepoState(isGit ? 'ready' : 'missing'))
      .catch(() => setGitRepoState('ready')) // fail open
  }, [vaultPath])

  useEffect(() => {
    if (noteWindowParams || gitRepoState !== 'missing' || !vaultPath) return
    if (dismissedGitSetupPathRef.current === vaultPath) return
    setShowGitSetupDialog(true) // eslint-disable-line react-hooks/set-state-in-effect -- show dialog when git missing
  }, [gitRepoState, noteWindowParams, vaultPath])

  useEffect(() => {
    if (gitRepoState === 'missing') return
    setShowGitSetupDialog(false) // eslint-disable-line react-hooks/set-state-in-effect -- hide dialog when git becomes ready
  }, [gitRepoState])

  const openGitSetupDialog = useCallback(() => {
    if (gitRepoState !== 'missing') return
    setShowGitSetupDialog(true)
  }, [gitRepoState])

  const dismissGitSetupDialog = useCallback(() => {
    dismissedGitSetupPathRef.current = vaultPath
    setShowGitSetupDialog(false)
  }, [vaultPath])

  const handleInitGitRepo = useCallback(async () => {
    if (isTauri()) {
      await invoke('init_git_repo', { vaultPath })
    } else {
      await mockInvoke('init_git_repo', { vaultPath })
    }
    setGitRepoState('ready')
    dismissedGitSetupPathRef.current = null
    setShowGitSetupDialog(false)
    onToast('Git initialized for this vault')
  }, [vaultPath, onToast])

  return {
    gitRepoState,
    showGitSetupDialog,
    openGitSetupDialog,
    dismissGitSetupDialog,
    handleInitGitRepo,
  }
}
