/**
 * Vault API detection and proxy for browser dev mode.
 * When a local vault API server is running, routes read and write commands
 * through it instead of returning hardcoded mock data.
 */

let vaultApiAvailable: boolean | null = null

async function detectVaultApiAvailability(): Promise<boolean> {
  try {
    const res = await fetch('/api/vault/ping', { signal: AbortSignal.timeout(500) })
    return res.ok
  } catch {
    return false
  }
}

async function checkVaultApi(): Promise<boolean> {
  if (vaultApiAvailable === true) return true

  const available = await detectVaultApiAvailability()
  vaultApiAvailable = available
  console.info(`[mock-tauri] Vault API available: ${vaultApiAvailable}`)
  return available
}

interface VaultApiRequest {
  url: string
  method?: string
  body?: unknown
}

/** Tracks last vault path for commands that don't receive it as an argument. */
let lastVaultPath: string | null = null

function buildVaultApiRequest(cmd: string, args?: Record<string, unknown>) {
  if (cmd === 'get_default_vault_path') {
    return { url: '/api/vault/default-path' }
  }
  if (!args) return null
  switch (cmd) {
    case 'list_vault':
      if (args.path) lastVaultPath = args.path as string
      return args.path ? { url: `/api/vault/list?path=${encodeURIComponent(args.path as string)}` } : null
    case 'list_vault_folders':
      return args.path ? { url: `/api/vault/folders?path=${encodeURIComponent(args.path as string)}` } : null
    case 'reload_vault':
      if (args.path) lastVaultPath = args.path as string
      return args.path ? { url: `/api/vault/list?path=${encodeURIComponent(args.path as string)}&reload=1` } : null
    case 'reload_vault_entry':
      return args.path ? { url: `/api/vault/entry?path=${encodeURIComponent(args.path as string)}` } : null
    case 'get_note_content':
    case 'validate_note_content':
      return args.path ? { url: `/api/vault/content?path=${encodeURIComponent(args.path as string)}` } : null
    case 'get_file_history':
      return args.path ? { url: `/api/vault/history?path=${encodeURIComponent(args.path as string)}` } : null
    case 'get_modified_files':
      return args.vaultPath ? { url: `/api/vault/changes?vaultPath=${encodeURIComponent(args.vaultPath as string)}` } : null
    case 'get_file_diff':
      return args.path ? { url: `/api/vault/diff?path=${encodeURIComponent(args.path as string)}` } : null
    case 'get_file_diff_at_commit':
      return args.path && args.commitHash
        ? { url: `/api/vault/diff-at-commit?path=${encodeURIComponent(args.path as string)}&commitHash=${encodeURIComponent(args.commitHash as string)}` }
        : null
    case 'get_all_content':
      return args.path ? { url: `/api/vault/all-content?path=${encodeURIComponent(args.path as string)}` } : null
    case 'check_vault_exists':
      return args.path ? { url: `/api/vault/exists?path=${encodeURIComponent(args.path as string)}` } : null
    case 'create_empty_vault': {
      const targetPath = args.targetPath ?? args.target_path
      return targetPath ? { url: '/api/vault/create-empty', method: 'POST', body: { targetPath } } : null
    }
    case 'create_getting_started_vault': {
      const targetPath = args.targetPath ?? args.target_path
      return targetPath ? { url: '/api/vault/create-getting-started', method: 'POST', body: { targetPath } } : null
    }
    case 'create_vault_folder':
      return args.vaultPath && args.folderName
        ? { url: '/api/vault/create-folder', method: 'POST', body: { vaultPath: args.vaultPath, folderName: args.folderName } }
        : null
    case 'rename_vault_folder':
      return args.vaultPath && args.folderPath && args.newName
        ? { url: '/api/vault/rename-folder', method: 'POST', body: { vaultPath: args.vaultPath, folderPath: args.folderPath, newName: args.newName } }
        : null
    case 'delete_vault_folder':
      return args.vaultPath && args.folderPath
        ? { url: '/api/vault/delete-folder', method: 'POST', body: { vaultPath: args.vaultPath, folderPath: args.folderPath } }
        : null
    case 'save_note_content':
      return args.path ? { url: '/api/vault/save', method: 'POST', body: { path: args.path, content: args.content } } : null
    case 'rename_note':
      return args.old_path ? { url: '/api/vault/rename', method: 'POST', body: { vault_path: args.vault_path, old_path: args.old_path, new_title: args.new_title } } : null
    case 'rename_note_filename':
      return args.old_path ? {
        url: '/api/vault/rename-filename',
        method: 'POST',
        body: {
          vault_path: args.vault_path,
          old_path: args.old_path,
          new_filename_stem: args.new_filename_stem,
        },
      } : null
    case 'move_note_to_folder':
      return args.old_path && args.folder_path ? {
        url: '/api/vault/move-to-folder',
        method: 'POST',
        body: {
          vault_path: args.vault_path,
          old_path: args.old_path,
          folder_path: args.folder_path,
        },
      } : null
    case 'delete_note':
      return args.path ? { url: '/api/vault/delete', method: 'POST', body: { path: args.path } } : null
    case 'batch_delete_notes':
      return Array.isArray(args.paths) ? { url: '/api/vault/delete', method: 'POST', body: { paths: args.paths } } : null
    case 'is_git_repo':
      return args.vaultPath ? { url: `/api/vault/git/is-repo?vaultPath=${encodeURIComponent(args.vaultPath as string)}` } : null
    case 'init_git_repo':
      return args.vaultPath ? { url: '/api/vault/git/init', method: 'POST', body: { vaultPath: args.vaultPath } } : null
    case 'clone_git_repo':
    case 'clone_repo': {
      const localPath = args.localPath ?? args.local_path
      return args.url && localPath
        ? { url: '/api/vault/git/clone', method: 'POST', body: { url: args.url, localPath } }
        : null
    }
    case 'git_remote_status':
      return args.vaultPath ? { url: `/api/vault/git/remote-status?vaultPath=${encodeURIComponent(args.vaultPath as string)}` } : null
    case 'git_add_remote': {
      const request = args.request as Record<string, unknown> | undefined
      const vaultPath = request?.vaultPath ?? request?.vault_path ?? args.vaultPath
      const remoteUrl = request?.remoteUrl ?? args.remoteUrl
      return vaultPath && remoteUrl
        ? { url: '/api/vault/git/add-remote', method: 'POST', body: { vaultPath, remoteUrl } }
        : null
    }
    case 'git_commit':
      return args.vaultPath ? { url: '/api/vault/git/commit', method: 'POST', body: { vaultPath: args.vaultPath, message: args.message } } : null
    case 'git_push':
      return args.vaultPath ? { url: '/api/vault/git/push', method: 'POST', body: { vaultPath: args.vaultPath } } : null
    case 'git_pull':
      return args.vaultPath ? { url: '/api/vault/git/pull', method: 'POST', body: { vaultPath: args.vaultPath } } : null
    case 'git_discard_file':
      return args.vaultPath && args.relativePath
        ? { url: '/api/vault/git/discard', method: 'POST', body: { vaultPath: args.vaultPath, relativePath: args.relativePath } }
        : null
    case 'get_last_commit_info':
      return args.vaultPath ? { url: `/api/vault/git/last-commit?vaultPath=${encodeURIComponent(args.vaultPath as string)}` } : null
    case 'get_vault_pulse': {
      const vaultPath = args.vaultPath as string | undefined
      if (!vaultPath) return null
      const params = new URLSearchParams({ vaultPath })
      if (args.limit != null) params.set('limit', String(args.limit))
      if (args.skip != null) params.set('skip', String(args.skip))
      return { url: `/api/vault/pulse?${params.toString()}` }
    }
    case 'get_conflict_files':
      return args.vaultPath ? { url: `/api/vault/git/conflicts?vaultPath=${encodeURIComponent(args.vaultPath as string)}` } : null
    case 'search_vault': {
      const q = args.query as string
      if (!q || !lastVaultPath) return null
      return { url: `/api/vault/search?vault_path=${encodeURIComponent(lastVaultPath)}&query=${encodeURIComponent(q)}&mode=${encodeURIComponent((args.mode as string) || 'all')}` }
    }
    default:
      return null
  }
}

function buildFetchOptions(request: VaultApiRequest): RequestInit {
  if (!request.body) {
    return { method: request.method || 'GET' }
  }

  return {
    method: request.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request.body),
  }
}

async function fetchVaultApiResponse(request: VaultApiRequest) {
  const url = new URL(request.url, window.location.origin)
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/vault/')) return undefined
  const res = await fetch(new Request(url, buildFetchOptions(request)))
  if (!res.ok) {
    let message = `Vault API request failed (${res.status})`
    try {
      const body = await res.json()
      if (body && typeof body.error === 'string' && body.error.trim()) {
        message = body.error
      }
    } catch {
      // Keep the status-based fallback message.
    }
    throw new Error(message)
  }
  return res.json()
}

export async function tryVaultApi<T>(cmd: string, args?: Record<string, unknown>): Promise<T | undefined> {
  const request = buildVaultApiRequest(cmd, args)
  if (!request) return undefined
  if (!await checkVaultApi()) return undefined

  try {
    const data = await fetchVaultApiResponse(request)
    if (data === undefined) return undefined
    if (cmd === 'get_note_content') return data.content as T
    if (cmd === 'validate_note_content') return (data.content === args?.content) as T
    return data as T
  } catch (err) {
    console.warn(`[mock-tauri] Vault API call failed for ${cmd}:`, err)
    throw err
  }
}
