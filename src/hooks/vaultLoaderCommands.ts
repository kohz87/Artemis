import type { FolderNode, GitPushResult, VaultEntry, ViewFile } from '../types'
import { normalizeVaultEntries, normalizeViewFiles } from '../utils/vaultMetadataNormalization'
import { callWebBackend, checkVaultExists, gitCommit, gitPush, listVault, listVaultFolders, listViews, reloadVault } from '../backend/client'

interface VaultPathOptions {
  vaultPath: string
}

interface CommitWithPushOptions extends VaultPathOptions {
  message: string
}

interface LoadedVaultData {
  entries: VaultEntry[]
}

interface LoadedVaultChrome {
  folders: FolderNode[]
  views: ViewFile[]
}

export function hasVaultPath({ vaultPath }: VaultPathOptions): boolean {
  return vaultPath.trim().length > 0
}

export function webCommand<T>({ command, webArgs, mockArgs }: { command: string; webArgs: Record<string, unknown>; mockArgs?: Record<string, unknown> }): Promise<T> {
  return callWebBackend<T>(command, mockArgs ?? webArgs)
}

export function backendCall<T>({ command, args }: { command: string; args?: Record<string, unknown> }): Promise<T> {
  return callWebBackend<T>(command, args)
}

export async function checkVaultPathAvailability({ vaultPath }: VaultPathOptions): Promise<boolean | null> {
  if (!hasVaultPath({ vaultPath })) return false

  try {
    return await checkVaultExists(vaultPath)
  } catch {
    return null
  }
}

function loadVaultEntriesWithCommand({ vaultPath, reload }: VaultPathOptions & { reload: boolean }): Promise<VaultEntry[]> {
  const request = reload ? reloadVault(vaultPath) : listVault(vaultPath)
  return request.then((entries) => normalizeVaultEntries(entries, vaultPath))
}

function loadVaultEntries({ vaultPath }: VaultPathOptions): Promise<VaultEntry[]> {
  return loadVaultEntriesWithCommand({ vaultPath, reload: false })
}

export function reloadVaultEntries({ vaultPath }: VaultPathOptions): Promise<VaultEntry[]> {
  return loadVaultEntriesWithCommand({ vaultPath, reload: true })
}

export function loadVaultFolders({ vaultPath }: VaultPathOptions): Promise<FolderNode[]> {
  return listVaultFolders(vaultPath)
}

export function loadVaultViews({ vaultPath }: VaultPathOptions): Promise<ViewFile[]> {
  return listViews(vaultPath).then(normalizeViewFiles)
}

export async function loadVaultData({ vaultPath }: VaultPathOptions): Promise<LoadedVaultData> {
  const entries = await loadVaultEntries({ vaultPath })
  console.log(`Vault scan complete: ${entries.length} entries found`)
  return { entries }
}

export async function loadVaultChrome({ vaultPath }: VaultPathOptions): Promise<LoadedVaultChrome> {
  const [folders, views] = await Promise.all([
    loadVaultFolders({ vaultPath }).catch(() => [] as FolderNode[]),
    loadVaultViews({ vaultPath }).catch(() => [] as ViewFile[]),
  ])

  return {
    folders: folders ?? [],
    views: views ?? [],
  }
}

export async function commitWithPush({ vaultPath, message }: CommitWithPushOptions): Promise<GitPushResult> {
  await gitCommit(vaultPath, message)
  return gitPush(vaultPath)
}
