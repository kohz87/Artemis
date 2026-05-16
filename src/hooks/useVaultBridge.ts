import { useCallback } from 'react'
import type { VaultEntry } from '../types'

interface VaultBridgeDeps {
  entriesByPath: Map<string, VaultEntry>
  resolvedPath: string
  reloadVault: () => Promise<VaultEntry[]>
  reloadFolders?: () => void | Promise<void>
  reloadViews?: () => void | Promise<void>
  closeAllTabs?: () => void
  replaceActiveTab?: (entry: VaultEntry) => void | Promise<void>
  hasUnsavedChanges?: (path: string) => boolean
  activeTabPath?: string | null
  onSelectNote: (entry: VaultEntry) => void
}

function normalizePath(resolvedPath: string, path: string): string {
  return path.startsWith('/') ? path : `${resolvedPath}/${path}`
}

function findEntry(entriesByPath: Map<string, VaultEntry>, resolvedPath: string, path: string): VaultEntry | undefined {
  return entriesByPath.get(path) ?? entriesByPath.get(normalizePath(resolvedPath, path))
}

function findInFresh(entries: VaultEntry[], resolvedPath: string, path: string): VaultEntry | undefined {
  const fullPath = normalizePath(resolvedPath, path)
  return entries.find(e => e.path === path || e.path === fullPath)
}

export function useVaultBridge({
  entriesByPath,
  resolvedPath,
  reloadVault,
  reloadFolders,
  reloadViews,
  closeAllTabs,
  replaceActiveTab,
  hasUnsavedChanges,
  activeTabPath,
  onSelectNote,
}: VaultBridgeDeps) {
  const reloadVaultDerivedState = useCallback(async () => {
    const entries = await reloadVault()
    await reloadFolders?.()
    await reloadViews?.()
    return entries
  }, [reloadVault, reloadFolders, reloadViews])

  const reloadAndOpen = useCallback(async (path: string) => {
    const fresh = await reloadVault()
    const entry = findInFresh(fresh, resolvedPath, path)
    if (entry) onSelectNote(entry)
  }, [reloadVault, onSelectNote, resolvedPath])

  const openNoteByPath = useCallback((path: string) => {
    const entry = findEntry(entriesByPath, resolvedPath, path)
    if (entry) onSelectNote(entry)
    else void reloadAndOpen(path)
  }, [entriesByPath, resolvedPath, onSelectNote, reloadAndOpen])

  const handlePulseOpenNote = useCallback((relativePath: string) => {
    const entry = findEntry(entriesByPath, resolvedPath, `${resolvedPath}/${relativePath}`)
      ?? entriesByPath.get(relativePath)
    if (entry) onSelectNote(entry)
  }, [entriesByPath, resolvedPath, onSelectNote])

  const handleAgentFileCreated = useCallback(async (path: string) => {
    await reloadAndOpen(path)
  }, [reloadAndOpen])

  const handleAgentFileModified = useCallback(async (path: string) => {
    const fresh = await reloadVaultDerivedState()
    const fullPath = normalizePath(resolvedPath, path)
    if (activeTabPath !== fullPath || hasUnsavedChanges?.(fullPath) || !replaceActiveTab) return

    const entry = findInFresh(fresh, resolvedPath, path)
    if (!entry) return

    closeAllTabs?.()
    await replaceActiveTab(entry)
  }, [reloadVaultDerivedState, resolvedPath, activeTabPath, hasUnsavedChanges, replaceActiveTab, closeAllTabs])

  const handleAgentVaultChanged = useCallback(async () => {
    await reloadVaultDerivedState()
  }, [reloadVaultDerivedState])

  return {
    openNoteByPath,
    handlePulseOpenNote,
    handleAgentFileCreated,
    handleAgentFileModified,
    handleAgentVaultChanged,
  }
}
