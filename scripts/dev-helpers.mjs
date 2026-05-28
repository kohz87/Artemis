export function commandsForDevStack() {
  return [
    ['vault-server', 'pnpm', ['dev:server']],
    ['vite', 'pnpm', ['dev:frontend']],
  ]
}

export function devStackEnv({ env = process.env, apiHost, apiPort }) {
  return {
    ...env,
    ARTEMIS_API_HOST: apiHost,
    ARTEMIS_API_PORT: String(apiPort),
  }
}

export function vaultServerHost(env = process.env) {
  return env.ARTEMIS_API_HOST || env.TOLARIA_API_HOST || '127.0.0.1'
}

export function vaultServerPort(env = process.env) {
  const raw = env.ARTEMIS_API_PORT || env.TOLARIA_API_PORT || '5302'
  const port = Number(raw)
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 5302
}
