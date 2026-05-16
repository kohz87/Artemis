import { useCallback, useEffect, useReducer, useRef, type ChangeEvent, type FormEvent } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { GitAddRemoteResult, GitRemoteStatus } from '../types'
import { isTauri, mockInvoke } from '../mock-tauri'

type ConnectState = 'idle' | 'connecting'

interface AddRemoteModalState {
  remoteUrl: string
  connectState: ConnectState
  connectError: string | null
}

type AddRemoteModalAction =
  | { type: 'reset'; remoteUrl: string }
  | { type: 'editRemoteUrl'; remoteUrl: string }
  | { type: 'submit' }
  | { type: 'error'; message: string }
  | { type: 'idle' }

function createInitialState(remoteUrl = ''): AddRemoteModalState {
  return { remoteUrl, connectState: 'idle', connectError: null }
}

function addRemoteModalReducer(
  state: AddRemoteModalState,
  action: AddRemoteModalAction,
): AddRemoteModalState {
  switch (action.type) {
    case 'reset':
      return createInitialState(action.remoteUrl)
    case 'editRemoteUrl':
      return { ...state, remoteUrl: action.remoteUrl, connectError: null }
    case 'submit':
      return { ...state, connectState: 'connecting', connectError: null }
    case 'error':
      return { ...state, connectError: action.message }
    case 'idle':
      return { ...state, connectState: 'idle' }
  }
}

interface AddRemoteModalProps {
  open: boolean
  vaultPath: string
  remoteStatus?: GitRemoteStatus | null
  onOpenLocalFolder?: () => void
  onCloneVault?: () => void
  onClose: () => void
  onRemoteConnected: (message: string) => void | Promise<void>
}

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

function shouldCloseAfterResult(result: GitAddRemoteResult): boolean {
  return result.status === 'connected' || result.status === 'already_configured'
}

async function submitRemoteConnection(
  vaultPath: string,
  remoteUrl: string,
): Promise<GitAddRemoteResult> {
  return tauriCall<GitAddRemoteResult>('git_add_remote', {
    request: {
      vaultPath,
      remoteUrl,
    },
  })
}

async function getConnectErrorMessage({
  vaultPath,
  remoteUrl,
  onRemoteConnected,
  onClose,
}: {
  vaultPath: string
  remoteUrl: string
  onRemoteConnected: (message: string) => void | Promise<void>
  onClose: () => void
}): Promise<string | null> {
  try {
    const result = await submitRemoteConnection(vaultPath, remoteUrl)

    if (shouldCloseAfterResult(result)) {
      await onRemoteConnected(result.message)
      onClose()
      return null
    }

    return result.message
  } catch (error) {
    return `Could not connect that remote: ${String(error)}`
  }
}

export function AddRemoteModal({
  open,
  vaultPath,
  remoteStatus,
  onOpenLocalFolder,
  onCloneVault,
  onClose,
  onRemoteConnected,
}: AddRemoteModalProps) {
  const [{ remoteUrl, connectState, connectError }, dispatch] = useReducer(
    addRemoteModalReducer,
    remoteStatus?.remoteUrl ?? '',
    createInitialState,
  )
  const inputRef = useRef<HTMLInputElement | null>(null)

  const resetState = useCallback(() => {
    dispatch({ type: 'reset', remoteUrl: remoteStatus?.remoteUrl ?? '' })
  }, [remoteStatus?.remoteUrl])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [onClose, resetState])

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      handleClose()
    }
  }, [handleClose])
  const handleRemoteUrlChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'editRemoteUrl', remoteUrl: event.target.value })
  }, [])
  const handleOpenDifferentVault = useCallback(() => {
    handleClose()
    onOpenLocalFolder?.()
  }, [handleClose, onOpenLocalFolder])
  const handleCloneDifferentRepo = useCallback(() => {
    handleClose()
    onCloneVault?.()
  }, [handleClose, onCloneVault])

  useEffect(() => {
    if (!open) return
    dispatch({ type: 'reset', remoteUrl: remoteStatus?.remoteUrl ?? '' })
  }, [open, remoteStatus?.remoteUrl])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUrl = remoteUrl.trim()
    if (!trimmedUrl) return

    dispatch({ type: 'submit' })

    const errorMessage = await getConnectErrorMessage({
      vaultPath,
      remoteUrl: trimmedUrl,
      onRemoteConnected,
      onClose: handleClose,
    })

    if (errorMessage) {
      dispatch({ type: 'error', message: errorMessage })
    }

    dispatch({ type: 'idle' })
  }, [handleClose, onRemoteConnected, remoteUrl, vaultPath])

  const connectDisabled = connectState === 'connecting' || !remoteUrl.trim()

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]" data-testid="add-remote-modal">
        <DialogHeader>
          <DialogTitle>Git Repository</DialogTitle>
          <DialogDescription>
            Change the local vault path by opening or cloning another folder, or update the origin URL
            used for pull, push, and commit links.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4 py-2" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="git-vault-path">Vault path</label>
            <Input
              id="git-vault-path"
              readOnly
              value={vaultPath}
              data-testid="git-vault-path"
            />
          </div>

          {remoteStatus?.gitRoot && remoteStatus.gitRoot !== vaultPath && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground" htmlFor="git-repository-root">Repository root</label>
              <Input
                id="git-repository-root"
                readOnly
                value={remoteStatus.gitRoot}
                data-testid="git-repository-root"
              />
            </div>
          )}

          {(onOpenLocalFolder || onCloneVault) && (
            <div className="flex flex-wrap gap-2">
              {onOpenLocalFolder && (
                <Button type="button" variant="outline" size="sm" onClick={handleOpenDifferentVault} data-testid="git-open-vault-path">
                  Open Different Path
                </Button>
              )}
              {onCloneVault && (
                <Button type="button" variant="outline" size="sm" onClick={handleCloneDifferentRepo} data-testid="git-clone-repository">
                  Clone Repository
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="add-remote-url">Origin URL</label>
            <Input
              id="add-remote-url"
              ref={inputRef}
              autoFocus
              placeholder="git@host:owner/repo.git or https://host/owner/repo.git"
              value={remoteUrl}
              onChange={handleRemoteUrlChange}
              data-testid="add-remote-url"
            />
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Saving this field adds or replaces the local git `origin` remote. SSH keys, Git Credential
            Manager, and other system git auth methods all work.
          </p>

          {connectError && (
            <p className="text-xs text-destructive" data-testid="add-remote-error">{connectError}</p>
          )}

          <DialogFooter className="flex-row items-center justify-end sm:justify-end">
            <Button type="submit" disabled={connectDisabled} data-testid="add-remote-submit">
              {connectState === 'connecting' ? 'Saving...' : 'Save Repository'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
