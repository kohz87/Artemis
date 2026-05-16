export function requireVaultPath(env = process.env) {
  const vaultPath = env.VAULT_PATH?.trim()
  if (!vaultPath) {
    throw new Error('VAULT_PATH is required. Open a vault in Artemis before starting MCP tools.')
  }
  return vaultPath
}
