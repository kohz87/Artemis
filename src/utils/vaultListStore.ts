import { callWebBackend } from '../backend/client'
import type { VaultOption } from '../components/StatusBar'

export interface PersistedVaultList {
  vaults: Array<{ label: string; path: string }>
  active_vault: string | null
  hidden_defaults: string[]
}

function webCommand<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return callWebBackend<T>(command, args)
}

async function checkAvailability(v: { label: string; path: string }): Promise<VaultOption> {
  try {
    const exists = await webCommand<boolean>('check_vault_exists', { path: v.path })
    return { label: v.label, path: v.path, available: exists }
  } catch {
    return { label: v.label, path: v.path, available: false }
  }
}

export async function loadVaultList(): Promise<{ vaults: VaultOption[]; activeVault: string | null; hiddenDefaults: string[] }> {
  const data = await webCommand<PersistedVaultList>('load_vault_list', {})
  const persisted = data?.vaults ?? []
  const checked = await Promise.all(persisted.map(checkAvailability))
  return { vaults: checked, activeVault: data?.active_vault ?? null, hiddenDefaults: data?.hidden_defaults ?? [] }
}

export function saveVaultList(vaults: VaultOption[], activeVault: string | null, hiddenDefaults: string[] = []): Promise<void> {
  const list: PersistedVaultList = {
    vaults: vaults.map(v => ({ label: v.label, path: v.path })),
    active_vault: activeVault,
    hidden_defaults: hiddenDefaults,
  }
  return webCommand('save_vault_list', { list })
}
