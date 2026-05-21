import { useEffect, useState } from 'react'
import type { SidebarSelection } from '../types'
import { normalizeNotePathSeparators, normalizeVaultRelativePath } from '../utils/notePathIdentity'

export const NOTE_TARGET_FOLDER_STORAGE_PREFIX = 'artemis.noteTargetFolder:'

export interface ResolveNoteTargetFolderParams {
  selection: SidebarSelection
  vaultPath: string
  storedFolderPath?: string | null
}

export interface ResolvedNoteTargetFolder {
  folderPath: string | null
  shouldPersist: boolean
}

function storageKey(vaultPath: string): string {
  return `${NOTE_TARGET_FOLDER_STORAGE_PREFIX}${vaultPath}`
}

function stripTrailingSlashes(path: string): string {
  return path.replace(/[\\/]+$/u, '')
}

function normalizeVaultRoot(vaultPath: string): string {
  const normalized = stripTrailingSlashes(normalizeNotePathSeparators(vaultPath.trim()))
  return normalized || '/'
}

function normalizePathSegments(path: string): string | null {
  const segments: string[] = []
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') return null
    segments.push(segment)
  }
  return segments.join('/')
}

function absoluteFolderToRelative(candidate: string, vaultPath: string): string | null {
  const root = normalizeVaultRoot(vaultPath)
  const normalized = stripTrailingSlashes(normalizeNotePathSeparators(candidate.trim()))
  if (normalized === root) return ''
  if (!normalized.startsWith(`${root}/`)) return null
  return normalized.slice(root.length + 1)
}

export function sanitizeNoteTargetFolderPath(candidate: string | null | undefined, vaultPath: string): string | null {
  if (!candidate?.trim()) return null
  const rawPath = normalizeNotePathSeparators(candidate.trim())
  const vaultRelative = rawPath.startsWith('/')
    ? absoluteFolderToRelative(rawPath, vaultPath)
    : normalizeVaultRelativePath(rawPath)
  if (vaultRelative === null) return null
  const normalized = normalizePathSegments(vaultRelative)
  return normalized && normalized.length > 0 ? normalized : null
}

export function resolveNoteTargetFolder({
  selection,
  vaultPath,
  storedFolderPath,
}: ResolveNoteTargetFolderParams): ResolvedNoteTargetFolder {
  if (selection.kind === 'folder') {
    if (!selection.path.trim()) return { folderPath: null, shouldPersist: true }
    const selectedFolder = sanitizeNoteTargetFolderPath(selection.path, vaultPath)
    if (selectedFolder !== null) return { folderPath: selectedFolder, shouldPersist: true }
  }

  return {
    folderPath: sanitizeNoteTargetFolderPath(storedFolderPath, vaultPath),
    shouldPersist: false,
  }
}

function readStoredFolder(vaultPath: string): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(storageKey(vaultPath))
}

function writeStoredFolder(vaultPath: string, folderPath: string | null): void {
  if (typeof localStorage === 'undefined') return
  const key = storageKey(vaultPath)
  if (folderPath) localStorage.setItem(key, folderPath)
  else localStorage.removeItem(key)
}

export function useNoteTargetFolder({
  selection,
  vaultPath,
}: {
  selection: SidebarSelection
  vaultPath: string
}): string | null {
  const [storedFolderPath, setStoredFolderPath] = useState<string | null>(() => readStoredFolder(vaultPath))

  useEffect(() => {
    setStoredFolderPath(readStoredFolder(vaultPath))
  }, [vaultPath])

  const resolved = resolveNoteTargetFolder({ selection, vaultPath, storedFolderPath })

  useEffect(() => {
    if (!resolved.shouldPersist) return
    writeStoredFolder(vaultPath, resolved.folderPath)
    setStoredFolderPath(resolved.folderPath)
  }, [resolved.folderPath, resolved.shouldPersist, vaultPath])

  return resolved.folderPath
}
