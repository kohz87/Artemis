import type { Settings, VaultEntry } from '../types'

const STORAGE_PREFIX = 'tolaria:web-vault:'

type WebVaultSnapshot = {
  entries?: VaultEntry[]
  content?: Record<string, string>
  settings?: Settings
  vaultList?: { vaults: Array<{ label: string; path: string }>; active_vault: string | null }
  lastVaultPath?: string | null
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    const key = `${STORAGE_PREFIX}probe`
    window.localStorage.setItem(key, '1')
    window.localStorage.removeItem(key)
    return window.localStorage
  } catch {
    return null
  }
}

function readJson<T>(key: string): T | undefined {
  const store = storage()
  if (!store) return undefined

  const raw = store.getItem(`${STORAGE_PREFIX}${key}`)
  if (!raw) return undefined

  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

function writeJson(key: string, value: unknown): void {
  const store = storage()
  if (!store) return

  try {
    store.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value))
  } catch {
    // Browser storage may be unavailable or full; keep the in-memory mock usable.
  }
}

export function loadWebVaultSnapshot(): WebVaultSnapshot {
  return {
    entries: readJson<VaultEntry[]>('entries'),
    content: readJson<Record<string, string>>('content'),
    settings: readJson<Settings>('settings'),
    vaultList: readJson<WebVaultSnapshot['vaultList']>('vault-list'),
    lastVaultPath: readJson<string | null>('last-vault-path'),
  }
}

export function saveWebVaultEntries(entries: VaultEntry[]): void {
  writeJson('entries', entries)
}

export function saveWebVaultContent(content: Record<string, string>): void {
  writeJson('content', content)
}

export function saveWebVaultSettings(settings: Settings): void {
  writeJson('settings', settings)
}

export function saveWebVaultList(list: WebVaultSnapshot['vaultList']): void {
  writeJson('vault-list', list)
}

export function saveWebLastVaultPath(path: string | null): void {
  writeJson('last-vault-path', path)
}
