import { useCallback } from 'react'
import { callWebBackend } from '../backend/client'
import { formatFolderPickerActionError, pickFolder } from '../utils/vault-dialog'
import {
  buildGettingStartedVaultPath,
  formatGettingStartedCloneError,
  labelFromPath,
} from '../utils/gettingStartedVault'

interface UseGettingStartedCloneOptions {
  onError: (message: string) => void
  onSuccess: (path: string, label: string) => void
}

function webCommand<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return callWebBackend<T>(command, args)
}

export function useGettingStartedClone({
  onError,
  onSuccess,
}: UseGettingStartedCloneOptions) {
  return useCallback(async () => {
    let parentPath: string | null
    try {
      parentPath = await pickFolder('Choose a parent folder for the Getting Started vault')
    } catch (err) {
      onError(formatFolderPickerActionError('Could not choose a parent folder', err))
      return
    }

    if (!parentPath) return

    const targetPath = buildGettingStartedVaultPath(parentPath)

    try {
      const vaultPath = await webCommand<string>('create_getting_started_vault', { targetPath })
      onSuccess(vaultPath, labelFromPath(vaultPath))
    } catch (err) {
      onError(formatGettingStartedCloneError(err))
    }
  }, [onError, onSuccess])
}
