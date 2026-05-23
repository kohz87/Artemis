/**
 * Web backend client for Artemis.
 *
 * Production web builds prefer the local /api/vault HTTP backend when present and
 * fall back to the in-browser demo vault store for offline demos and tests.
 */
import { MOCK_CONTENT } from './web-content'
import { mockHandlers, addMockEntry, updateMockContent, trackMockChange } from './web-command-handlers'
import { tryVaultApi } from './vault-api'
import type {
  FolderNode,
  GitAddRemoteResult,
  GitPullResult,
  GitPushResult,
  GitRemoteStatus,
  LastCommitInfo,
  ModifiedFile,
  Settings,
  VaultEntry,
  PulseCommit,
} from '../types'

interface GitAddRemoteRequest {
  vaultPath: string
  remoteUrl: string
}

declare global {
  interface Window {
    __mockContent?: Record<string, string>
    __mockHandlers?: Record<string, (args?: Record<string, unknown>) => unknown>
  }
}

export { addMockEntry, updateMockContent, trackMockChange }

// Initialize window globals for browser testing and Playwright overrides.
if (typeof window !== 'undefined') {
  window.__mockContent = MOCK_CONTENT
  window.__mockHandlers = mockHandlers
}

function resolveWebHandler(command: string) {
  if (typeof window !== 'undefined' && window.__mockHandlers?.[command]) {
    return window.__mockHandlers[command]
  }
  return mockHandlers[command]
}

export async function callWebBackend<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const vaultResult = await tryVaultApi<T>(command, args)
  if (vaultResult !== undefined) return vaultResult

  const handler = resolveWebHandler(command)
  if (handler) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return handler(args) as T
  }
  throw new Error(`No web backend handler for command: ${command}`)
}

export function webCommand<T>({
  command,
  webArgs,
  mockArgs,
}: {
  command: string
  webArgs: Record<string, unknown>
  mockArgs?: Record<string, unknown>
}): Promise<T> {
  return callWebBackend<T>(command, mockArgs ?? webArgs)
}

export const checkVaultExists = (path: string) => callWebBackend<boolean>('check_vault_exists', { path })
export const loadVaultList = () => callWebBackend<{ vaults: Array<{ label: string; path: string }>; active_vault: string | null }>('load_vault_list')
export const saveVaultList = (vaults: Array<{ label: string; path: string }>, activeVault: string | null) => callWebBackend<null>('save_vault_list', { vaults, activeVault })
export const getDefaultVaultPath = () => callWebBackend<string | null>('get_default_vault_path')
export const listVault = (path: string) => callWebBackend<unknown>('list_vault', { path })
export const reloadVault = (path: string) => callWebBackend<unknown>('reload_vault', { path })
export const reloadVaultEntry = (path: string) => callWebBackend<VaultEntry>('reload_vault_entry', { path })
export const listVaultFolders = (path: string) => callWebBackend<FolderNode[]>('list_vault_folders', { path })
export const listViews = (vaultPath: string) => callWebBackend<unknown>('list_views', { vaultPath })
export const getNoteContent = (path: string) => callWebBackend<string>('get_note_content', { path })
export const validateNoteContent = (path: string, content: string) => callWebBackend<boolean>('validate_note_content', { path, content })
export const saveNoteContent = (path: string, content: string, vaultPath?: string) => callWebBackend<void>('save_note_content', vaultPath ? { path, content, vaultPath } : { path, content })
export const createNoteContent = (path: string, content: string, vaultPath?: string) => callWebBackend<void>('create_note_content', vaultPath ? { path, content, vaultPath } : { path, content })
export const getModifiedFiles = (vaultPath: string) => callWebBackend<ModifiedFile[]>('get_modified_files', { vaultPath })
export const getFileDiff = (vaultPath: string, path: string) => callWebBackend<string>('get_file_diff', { vaultPath, path })
export const gitCommit = (vaultPath: string, message: string) => callWebBackend<string>('git_commit', { vaultPath, message })
export const gitPush = (vaultPath: string) => callWebBackend<GitPushResult>('git_push', { vaultPath })
export const gitPull = (vaultPath: string) => callWebBackend<GitPullResult>('git_pull', { vaultPath })
export const getLastCommitInfo = (vaultPath: string) => callWebBackend<LastCommitInfo | null>('get_last_commit_info', { vaultPath })
export const gitRemoteStatus = (vaultPath: string) => callWebBackend<GitRemoteStatus>('git_remote_status', { vaultPath })
export const getConflictFiles = (vaultPath: string) => callWebBackend<string[]>('get_conflict_files', { vaultPath })
export const gitResolveConflict = (vaultPath: string, filePath: string, resolution: string) => callWebBackend<void>('git_resolve_conflict', { vaultPath, filePath, resolution })
export const gitCommitConflictResolution = (vaultPath: string) => callWebBackend<string>('git_commit_conflict_resolution', { vaultPath })
export const initGitRepo = (vaultPath: string) => callWebBackend<void>('init_git_repo', { vaultPath })
export const isGitRepo = (vaultPath: string) => callWebBackend<boolean>('is_git_repo', { vaultPath })
export const gitAddRemote = (request: GitAddRemoteRequest) => callWebBackend<GitAddRemoteResult>('git_add_remote', { request })
export const getVaultPulse = (vaultPath: string, limit?: number, skip?: number) => callWebBackend<PulseCommit[]>('get_vault_pulse', { vaultPath, limit, skip })
export const getSettings = () => callWebBackend<Settings>('get_settings', {})
export const saveSettings = (settings: Settings) => callWebBackend<null>('save_settings', { settings })
export const createEmptyVault = (targetPath: string) => callWebBackend<string>('create_empty_vault', { targetPath })
export const createGettingStartedVault = (targetPath: string) => callWebBackend<string>('create_getting_started_vault', { targetPath })
export const searchVault = (query: string, mode?: string) => callWebBackend<unknown>('search_vault', { query, mode })
