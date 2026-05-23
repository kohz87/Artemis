/**
 * Demo command handlers for web backend calls.
 * Each handler simulates a browser-accessible vault backend command.
 */

import type {
  VaultEntry,
  Settings,
  GitAddRemoteResult,
  GitPullResult,
  GitPushResult,
  GitRemoteStatus,
  LastCommitInfo,
  PulseCommit,
} from '../types'
import { MOCK_CONTENT } from './web-content'
import { MOCK_ENTRIES } from './web-entries'
import {
  loadWebVaultSnapshot,
  saveWebLastVaultPath,
  saveWebVaultContent,
  saveWebVaultEntries,
  saveWebVaultList,
  saveWebVaultSettings,
} from './web-persistence'

function syncWindowContent(): void {
  if (typeof window !== 'undefined') {
    window.__mockContent = MOCK_CONTENT
  }
}

function persistWebVault(): void {
  saveWebVaultEntries(MOCK_ENTRIES)
  saveWebVaultContent(MOCK_CONTENT)
}

function applyEntryPatch(path: string, patch: Partial<VaultEntry>): void {
  const index = MOCK_ENTRIES.findIndex((entry) => entry.path === path)
  if (index < 0) return
  MOCK_ENTRIES[index] = { ...MOCK_ENTRIES[index], ...patch, modifiedAt: Date.now() / 1000 }
}

function replaceEntryPath(oldPath: string, newPath: string, patch: Partial<VaultEntry> = {}): void {
  const index = MOCK_ENTRIES.findIndex((entry) => entry.path === oldPath)
  if (index < 0) return
  const filename = newPath.split('/').pop() ?? MOCK_ENTRIES[index].filename
  MOCK_ENTRIES[index] = {
    ...MOCK_ENTRIES[index],
    ...patch,
    path: newPath,
    filename,
    modifiedAt: Date.now() / 1000,
  }
}

function removeEntry(path: string): void {
  const index = MOCK_ENTRIES.findIndex((entry) => entry.path === path)
  if (index >= 0) MOCK_ENTRIES.splice(index, 1)
}

let mockSettings: Settings = {
  auto_pull_interval_minutes: 5,
  autogit_enabled: false,
  autogit_idle_threshold_seconds: 90,
  autogit_inactive_threshold_seconds: 30,
  auto_advance_inbox_after_organize: false,
  telemetry_consent: false,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
  release_channel: null,
  theme_mode: null,
  ui_language: null,
}

const DEFAULT_MOCK_VAULT_PATH = '/Users/mock/demo-vault-v2'
const DEFAULT_MOCK_VAULT = {
  label: 'demo-vault-v2',
  path: DEFAULT_MOCK_VAULT_PATH,
}

let mockLastVaultPath: string | null = DEFAULT_MOCK_VAULT_PATH
const mockRemoteStateByVault: Record<string, boolean> = {
  [DEFAULT_MOCK_VAULT_PATH]: false,
}

let mockVaultList: { vaults: Array<{ label: string; path: string }>; active_vault: string | null } = {
  vaults: [DEFAULT_MOCK_VAULT],
  active_vault: DEFAULT_MOCK_VAULT_PATH,
}

const webSnapshot = loadWebVaultSnapshot()
if (webSnapshot.content) Object.assign(MOCK_CONTENT, webSnapshot.content)
if (webSnapshot.entries?.length) MOCK_ENTRIES.splice(0, MOCK_ENTRIES.length, ...webSnapshot.entries)
if (webSnapshot.settings) mockSettings = { ...mockSettings, ...webSnapshot.settings }
if (webSnapshot.vaultList) mockVaultList = webSnapshot.vaultList
if (webSnapshot.lastVaultPath !== undefined) mockLastVaultPath = webSnapshot.lastVaultPath

function normalizeMockVaultPath(path: string | null | undefined): string | null {
  const trimmed = path?.trim()
  return trimmed ? trimmed : null
}

function setMockRemoteState(path: string | null | undefined, hasRemote: boolean): void {
  const normalizedPath = normalizeMockVaultPath(path)
  if (!normalizedPath) return
  mockRemoteStateByVault[normalizedPath] = hasRemote
}

function getMockRemoteState(path: string | null | undefined): boolean {
  const normalizedPath = normalizeMockVaultPath(path)
  if (!normalizedPath) return false
  return mockRemoteStateByVault[normalizedPath] ?? false
}

function relativePathStem({ path, vaultPath }: { path: string; vaultPath: string }) {
  const prefix = vaultPath.endsWith('/') ? vaultPath : `${vaultPath}/`
  if (path.startsWith(prefix)) return path.slice(prefix.length).replace(/\.md$/, '')
  return (path.split('/').pop() ?? path).replace(/\.md$/, '')
}

function canonicalRenameTargets({ oldTitle, oldPathStem }: { oldTitle: string; oldPathStem: string }) {
  const oldFilenameStem = oldPathStem.split('/').pop() ?? oldPathStem
  return [...new Set([oldTitle, oldPathStem, oldFilenameStem].filter(Boolean))]
}

function slugifyMockTitle({ title }: { title: string }) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function buildRenamedMockPath({ oldPath, newTitle }: { oldPath: string; newTitle: string }) {
  const parentDir = oldPath.replace(/\/[^/]+$/, '')
  return `${parentDir}/${slugifyMockTitle({ title: newTitle })}.md`
}

function replaceMockNoteTitle({ content, newTitle }: { content: string; newTitle: string }) {
  const withFrontmatterTitle = /^title:\s*/m.test(content)
    ? content.replace(/^title:\s*.*$/m, `title: ${newTitle}`)
    : content
  return /^# .+$/m.test(withFrontmatterTitle)
    ? withFrontmatterTitle.replace(/^# .+$/m, `# ${newTitle}`)
    : withFrontmatterTitle
}

function replaceRenamedWikilinks({ content, oldTargets, newPathStem }: {
  content: string
  oldTargets: string[]
  newPathStem: string
}) {
  if (oldTargets.length === 0) return content
  const targets = new Set(oldTargets)
  return content.replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, (match: string, target: string, pipe: string | undefined) => {
    if (!targets.has(target)) return match
    return pipe ? `[[${newPathStem}${pipe}]]` : `[[${newPathStem}]]`
  })
}

function updateMockRenameReferences({ newPath, newPathStem, oldTargets }: {
  newPath: string
  newPathStem: string
  oldTargets: string[]
}) {
  let updatedFiles = 0
  for (const [path, content] of Object.entries(MOCK_CONTENT)) {
    if (path === newPath) continue
    const replaced = replaceRenamedWikilinks({ content, oldTargets, newPathStem })
    if (replaced === content) continue
    MOCK_CONTENT[path] = replaced
    updatedFiles += 1
  }
  return updatedFiles
}

function handleRenameNote(args: { vault_path: string; old_path: string; new_title: string; old_title?: string | null }) {
  const oldEntry = MOCK_ENTRIES.find(e => e.path === args.old_path)
  const oldTitle = args.old_title ?? oldEntry?.title ?? ''
  const oldContent = MOCK_CONTENT[args.old_path] ?? ''
  const newPath = buildRenamedMockPath({ oldPath: args.old_path, newTitle: args.new_title })
  const oldPathStem = relativePathStem({ path: args.old_path, vaultPath: args.vault_path })
  const newPathStem = relativePathStem({ path: newPath, vaultPath: args.vault_path })

  if (oldTitle === args.new_title && newPath === args.old_path) {
    return { new_path: args.old_path, updated_files: 0, failed_updates: 0 }
  }
  if (newPath !== args.old_path && Object.prototype.hasOwnProperty.call(MOCK_CONTENT, newPath)) {
    throw new Error('A note with that name already exists')
  }

  const newContent = replaceMockNoteTitle({ content: oldContent, newTitle: args.new_title })
  delete MOCK_CONTENT[args.old_path]
  MOCK_CONTENT[newPath] = newContent
  replaceEntryPath(args.old_path, newPath, {
    title: args.new_title,
    snippet: newContent.replace(/^---[\s\S]*?---/m, '').replace(/^#+\s+.+$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 200),
  })
  const oldTargets = canonicalRenameTargets({ oldTitle, oldPathStem })
  const updatedFiles = updateMockRenameReferences({ newPath, newPathStem, oldTargets })

  syncWindowContent()
  persistWebVault()
  return { new_path: newPath, updated_files: updatedFiles, failed_updates: 0 }
}

function handleRenameNoteFilename(args: {
  vault_path: string
  old_path: string
  new_filename_stem: string
}) {
  const oldEntry = MOCK_ENTRIES.find(e => e.path === args.old_path)
  const oldContent = MOCK_CONTENT[args.old_path] ?? ''
  const oldTitle = oldEntry?.title ?? ''
  const normalizedStem = args.new_filename_stem.trim().replace(/\.md$/, '')
  const oldFilename = args.old_path.split('/').pop() ?? ''
  const newFilename = `${normalizedStem}.md`

  if (!normalizedStem) {
    throw new Error('Invalid filename')
  }
  if (oldFilename === newFilename) {
    return { new_path: args.old_path, updated_files: 0, failed_updates: 0 }
  }

  const parentDir = args.old_path.replace(/\/[^/]+$/, '')
  const newPath = `${parentDir}/${newFilename}`
  if (newPath !== args.old_path && Object.prototype.hasOwnProperty.call(MOCK_CONTENT, newPath)) {
    throw new Error('A note with that name already exists')
  }

  delete MOCK_CONTENT[args.old_path]
  MOCK_CONTENT[newPath] = oldContent
  replaceEntryPath(args.old_path, newPath)

  const oldPathStem = relativePathStem({ path: args.old_path, vaultPath: args.vault_path })
  const newPathStem = relativePathStem({ path: newPath, vaultPath: args.vault_path })
  const oldTargets = canonicalRenameTargets({ oldTitle, oldPathStem })
  const updatedFiles = updateMockRenameReferences({ newPath, newPathStem, oldTargets })

  syncWindowContent()
  persistWebVault()
  return { new_path: newPath, updated_files: updatedFiles, failed_updates: 0 }
}

function handleMoveNoteToFolder(args: {
  vault_path: string
  old_path: string
  folder_path: string
}) {
  const oldEntry = MOCK_ENTRIES.find(e => e.path === args.old_path)
  const oldContent = MOCK_CONTENT[args.old_path] ?? ''
  const oldTitle = oldEntry?.title ?? ''
  const oldFilename = args.old_path.split('/').pop() ?? ''
  const normalizedFolderPath = args.folder_path.trim().replace(/^\/+|\/+$/g, '')

  if (!normalizedFolderPath) {
    throw new Error('Folder path cannot be empty')
  }

  const vaultRoot = args.vault_path.replace(/\/+$/, '')
  const newPath = `${vaultRoot}/${normalizedFolderPath}/${oldFilename}`
  if (newPath === args.old_path) {
    return { new_path: args.old_path, updated_files: 0, failed_updates: 0 }
  }
  if (Object.prototype.hasOwnProperty.call(MOCK_CONTENT, newPath)) {
    throw new Error('A note with that name already exists')
  }

  delete MOCK_CONTENT[args.old_path]
  MOCK_CONTENT[newPath] = oldContent
  replaceEntryPath(args.old_path, newPath)

  const oldPathStem = relativePathStem({ path: args.old_path, vaultPath: args.vault_path })
  const newPathStem = relativePathStem({ path: newPath, vaultPath: args.vault_path })
  const oldTargets = canonicalRenameTargets({ oldTitle, oldPathStem })
  const updatedFiles = updateMockRenameReferences({ newPath, newPathStem, oldTargets })

  syncWindowContent()
  persistWebVault()
  return { new_path: newPath, updated_files: updatedFiles, failed_updates: 0 }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock handler map accepts heterogeneous arg types
export const mockHandlers: Record<string, (args: any) => any> = {
  list_vault: () => MOCK_ENTRIES,
  list_vault_folders: () => [],
  list_views: () => [],
  save_view_cmd: () => {},
  delete_view_cmd: () => {},
  reload_vault: () => MOCK_ENTRIES,
  reload_vault_entry: (args: { path: string }) => MOCK_ENTRIES.find(e => e.path === args.path) ?? { path: args.path, title: 'Unknown', filename: 'unknown.md', aliases: [], belongsTo: [], relatedTo: [], archived: false, snippet: '', wordCount: 0, fileSize: 0, relationships: {}, outgoingLinks: [], properties: {} },
  sync_note_title: () => false,
  get_note_content: (args: { path: string }) => MOCK_CONTENT[args.path] ?? '',
  validate_note_content: (args: { path: string; content: string }) => (MOCK_CONTENT[args.path] ?? '') === args.content,
  get_all_content: () => MOCK_CONTENT,
  get_file_history: () => [],
  get_modified_files: () => [],
  get_file_diff: () => '',
  get_file_diff_at_commit: () => '',
  git_discard_file: () => {},
  git_commit: () => { throw new Error('Git commit is unavailable without the vault API') },
  get_build_number: () => 'bDEV',
  get_last_commit_info: (): LastCommitInfo | null => null,
  is_git_repo: () => false,
  init_git_repo: () => null,
  git_pull: (): GitPullResult => ({ status: 'error', message: 'Git pull is unavailable without the vault API', updatedFiles: [], conflictFiles: [] }),
  git_push: (): GitPushResult => ({ status: 'error', message: 'Git push is unavailable without the vault API' }),
  git_remote_status: (args?: { vaultPath?: string; vault_path?: string }): GitRemoteStatus => {
    const vaultPath = args?.vaultPath ?? args?.vault_path ?? mockLastVaultPath ?? DEFAULT_MOCK_VAULT_PATH
    return { branch: '', ahead: 0, behind: 0, hasRemote: getMockRemoteState(vaultPath) }
  },
  git_add_remote: (): GitAddRemoteResult => ({
    status: 'error',
    message: 'Git remote setup is unavailable without the vault API',
  }),
  get_vault_pulse: (): PulseCommit[] => [],
  get_conflict_files: (): string[] => [],
  get_conflict_mode: () => 'none',
  save_note_content: (args: { path: string; content: string }) => {
    MOCK_CONTENT[args.path] = args.content
    applyEntryPatch(args.path, {
      fileSize: args.content.length,
      wordCount: args.content.split(/\s+/).filter(Boolean).length,
      snippet: args.content.replace(/^---[\s\S]*?---/m, '').replace(/^#+\s+.+$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 200),
    })
    syncWindowContent()
    persistWebVault()
    return null
  },
  save_image: (args: { vault_path?: string; filename: string; data: string }) => {
    const vault = args.vault_path ?? '/Users/luca/Laputa'
    return `${vault}/attachments/${Date.now()}-${args.filename}`
  },
  copy_image_to_vault: (args: { vault_path?: string; source_path: string }) => {
    const vault = args.vault_path ?? '/Users/luca/Laputa'
    const filename = args.source_path.split('/').pop() ?? 'image.png'
    return `${vault}/attachments/${Date.now()}-${filename}`
  },
  get_settings: () => ({ ...mockSettings }),
  save_settings: (args: { settings: Settings }) => {
    const s = args.settings
    mockSettings = {
      auto_pull_interval_minutes: s.auto_pull_interval_minutes ?? 5,
      autogit_enabled: s.autogit_enabled ?? false,
      autogit_idle_threshold_seconds: s.autogit_idle_threshold_seconds ?? 90,
      autogit_inactive_threshold_seconds: s.autogit_inactive_threshold_seconds ?? 30,
      auto_advance_inbox_after_organize: s.auto_advance_inbox_after_organize ?? false,
      telemetry_consent: s.telemetry_consent,
      crash_reporting_enabled: s.crash_reporting_enabled,
      analytics_enabled: s.analytics_enabled,
      anonymous_id: s.anonymous_id,
      release_channel: s.release_channel,
      theme_mode: s.theme_mode ?? null,
      ui_language: s.ui_language ?? null,
    }
    saveWebVaultSettings(mockSettings)
    return null
  },
  load_vault_list: () => ({ ...mockVaultList, vaults: [...mockVaultList.vaults] }),
  save_vault_list: (args: { list: typeof mockVaultList }) => {
    mockVaultList = { ...args.list }
    saveWebVaultList(mockVaultList)
    return null
  },
  rename_note: handleRenameNote,
  rename_note_filename: handleRenameNoteFilename,
  move_note_to_folder: handleMoveNoteToFolder,
  clone_repo: (args: { url: string; localPath?: string; local_path?: string }) => {
    const localPath = args.localPath ?? args.local_path ?? ''
    setMockRemoteState(localPath, true)
    return `Cloned to ${localPath}`
  },
  clone_git_repo: (args: { url: string; localPath?: string; local_path?: string }) => {
    const localPath = args.localPath ?? args.local_path ?? ''
    setMockRemoteState(localPath, true)
    return `Cloned to ${localPath}`
  },
  purge_trash: () => [],
  delete_note: (args: { path: string }) => {
    delete MOCK_CONTENT[args.path]
    removeEntry(args.path)
    syncWindowContent()
    persistWebVault()
    return args.path
  },
  batch_delete_notes: (args: { paths: string[] }) => {
    for (const path of args.paths) {
      delete MOCK_CONTENT[path]
      removeEntry(path)
    }
    syncWindowContent()
    persistWebVault()
    return args.paths
  },
  empty_trash: () => [],
  migrate_is_a_to_type: () => 0,
  copy_text_to_clipboard: () => null,
  read_text_from_clipboard: () => '',
  batch_archive_notes: (args: { paths: string[] }) => args.paths.length,
  batch_trash_notes: (args: { paths: string[] }) => args.paths.length,
  search_vault: (args: { query: string; mode: string }) => {
    const q = (args.query ?? '').toLowerCase()
    if (!q) return { results: [], elapsed_ms: 0, query: q, mode: args.mode }
    const matches = MOCK_ENTRIES
      .filter(e => {
        const content = MOCK_CONTENT[e.path] ?? ''
        return e.title.toLowerCase().includes(q) || content.toLowerCase().includes(q)
      })
      .slice(0, 20)
      .map((e, i) => ({
        title: e.title,
        path: e.path,
        snippet: e.snippet || '',
        score: 1.0 - i * 0.05,
        note_type: e.isA,
      }))
    return { results: matches, elapsed_ms: 42, query: q, mode: args.mode }
  },
  get_last_vault_path: () => mockLastVaultPath,
  set_last_vault_path: (args: { path: string }) => {
    mockLastVaultPath = args.path
    saveWebLastVaultPath(args.path)
    return null
  },
  get_default_vault_path: () => '/Users/mock/Documents/Getting Started',
  check_vault_exists: (args: { path: string }) => {
    // In mock mode, the demo-vault-v2 path always "exists"
    return args.path.includes('demo-vault-v2')
  },
  create_empty_vault: (args: { targetPath?: string; target_path?: string }) => {
    const targetPath = args.targetPath || args.target_path || '/Users/mock/Documents/My Vault'
    setMockRemoteState(targetPath, false)
    return targetPath
  },
  create_getting_started_vault: (args: { targetPath?: string | null }) => {
    const targetPath = args.targetPath || '/Users/mock/Documents/Getting Started'
    setMockRemoteState(targetPath, false)
    return targetPath
  },
  repair_vault: (): string => 'Vault repaired',
  reinit_telemetry: (): null => null,
}

export function addMockEntry(_entry: VaultEntry, content: string): void {
  if (!MOCK_ENTRIES.some((entry) => entry.path === _entry.path)) {
    MOCK_ENTRIES.push(_entry)
  }
  MOCK_CONTENT[_entry.path] = content
  syncWindowContent()
  persistWebVault()
}

export function updateMockContent(path: string, content: string): void {
  MOCK_CONTENT[path] = content
  syncWindowContent()
  saveWebVaultContent(MOCK_CONTENT)
}

export function trackMockChange(path: string): void {
  void path
  // Browser fallback does not invent git state. The Vite vault API reports real changes.
}
