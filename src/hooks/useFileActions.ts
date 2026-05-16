import { useCallback, useMemo } from 'react'
import type { SidebarSelection } from '../types'
import { folderAbsolutePath } from './folder-actions/folderActionUtils'
import { copyLocalPath } from '../utils/url'

export interface FolderFileActions {
  copyFolderPath: (folderPath: string) => void
}

interface UseFileActionsInput {
  selection: SidebarSelection
  setToastMessage: (message: string) => void
  vaultPath: string
}

function directoryPath(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/\/+$/u, '')
  const index = normalized.lastIndexOf('/')
  if (index === 0) return '/'
  if (index < 0) return normalized || path
  return normalized.slice(0, index)
}

function showPathForManualCopy(label: string, path: string): void {
  if (typeof window === 'undefined') return
  window.prompt(`${label}\n\nClipboard is unavailable. Copy this path manually:`, path)
}

export function useFileActions({
  selection,
  setToastMessage,
  vaultPath,
}: UseFileActionsInput) {
  const copyFilePath = useCallback((path: string) => {
    const directory = directoryPath(path)
    void copyLocalPath(path)
      .then(() => setToastMessage(`File path copied. Directory: ${directory}`))
      .catch(() => {
        showPathForManualCopy(`Directory: ${directory}`, path)
        setToastMessage(`Clipboard unavailable. Directory: ${directory}`)
      })
  }, [setToastMessage])

  const resolveFolderPath = useCallback((folderPath: string) => (
    folderAbsolutePath({ vaultPath, folderPath })
  ), [vaultPath])

  const folderActions = useMemo<FolderFileActions>(() => ({
    copyFolderPath: (folderPath) => {
      const absolutePath = resolveFolderPath(folderPath)
      void copyLocalPath(absolutePath)
        .then(() => setToastMessage(`Folder path copied. Directory: ${absolutePath}`))
        .catch(() => {
          showPathForManualCopy('Folder path', absolutePath)
          setToastMessage(`Clipboard unavailable. Directory: ${absolutePath}`)
        })
    },
  }), [resolveFolderPath, setToastMessage])

  const copySelectedFolderPath = useCallback(() => {
    if (selection.kind !== 'folder') return
    folderActions.copyFolderPath(selection.path)
  }, [folderActions, selection])

  return useMemo(() => ({
    copyFilePath,
    copySelectedFolderPath,
    folderActions,
  }), [
    copyFilePath,
    copySelectedFolderPath,
    folderActions,
  ])
}
