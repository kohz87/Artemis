import { useCallback, useMemo, useState } from 'react'

export const ARTEMIS_AUTH_SESSION_KEY = 'artemis.authenticated'
const SESSION_MAX_IDLE_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_MAX_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

type AuthTransport = 'cookie' | 'bearer'

export type AuthUser = {
  username: string
  email: string | null
}

export type AuthSession = {
  authenticated: true
  token: string
  transport: AuthTransport
  user: AuthUser
  session_created_at: string
  last_accessed_at: string
  expires_at: string
}

type AuthState = {
  isPasswordProtectionEnabled: boolean
  isAuthenticated: boolean
  session: AuthSession | null
  login: (password: string) => Promise<boolean>
  logout: () => Promise<void>
  clearSession: () => void
}

function configuredPassword(): string {
  return (import.meta.env.ARTEMIS_PASSWORD ?? '').trim()
}

function configuredUser(): AuthUser {
  return {
    username: (import.meta.env.ARTEMIS_AUTH_USERNAME ?? import.meta.env.ARTEMIS_USERNAME ?? 'artemis').trim() || 'artemis',
    email: (import.meta.env.ARTEMIS_AUTH_EMAIL ?? '').trim() || null,
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function expiresAtIso(now = Date.now()): string {
  return new Date(now + SESSION_MAX_LIFETIME_MS).toISOString()
}

function createLocalToken(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `local.${random}`
}

function writeSession(session: AuthSession): void {
  try {
    localStorage.setItem(ARTEMIS_AUTH_SESSION_KEY, JSON.stringify(session))
    sessionStorage.removeItem(ARTEMIS_AUTH_SESSION_KEY)
  } catch {
    // Ignore unavailable or restricted storage implementations.
  }
}

function clearStoredSession(): void {
  try {
    localStorage.removeItem(ARTEMIS_AUTH_SESSION_KEY)
    sessionStorage.removeItem(ARTEMIS_AUTH_SESSION_KEY)
  } catch {
    // Ignore unavailable or restricted storage implementations.
  }
}

function isExpired(session: AuthSession, now: number): boolean {
  const lastAccessed = Date.parse(session.last_accessed_at)
  const expiresAt = Date.parse(session.expires_at)
  return Number.isNaN(lastAccessed)
    || Number.isNaN(expiresAt)
    || now - lastAccessed > SESSION_MAX_IDLE_MS
    || now >= expiresAt
}

function parseSession(raw: string | null): AuthSession | null {
  if (!raw) return null

  try {
    const candidate = JSON.parse(raw) as Partial<AuthSession>
    if (
      candidate.authenticated === true
      && typeof candidate.token === 'string'
      && (candidate.transport === 'cookie' || candidate.transport === 'bearer')
      && typeof candidate.user?.username === 'string'
      && (typeof candidate.user.email === 'string' || candidate.user.email === null)
      && typeof candidate.session_created_at === 'string'
      && typeof candidate.last_accessed_at === 'string'
      && typeof candidate.expires_at === 'string'
    ) {
      return {
        authenticated: true,
        token: candidate.token,
        transport: candidate.transport,
        user: {
          username: candidate.user.username,
          email: candidate.user.email,
        },
        session_created_at: candidate.session_created_at,
        last_accessed_at: candidate.last_accessed_at,
        expires_at: candidate.expires_at,
      }
    }
  } catch {
    return null
  }

  return null
}

function readStoredSession(): AuthSession | null {
  try {
    const session = parseSession(localStorage.getItem(ARTEMIS_AUTH_SESSION_KEY)
      ?? sessionStorage.getItem(ARTEMIS_AUTH_SESSION_KEY))
    if (!session) return null
    if (isExpired(session, Date.now())) {
      clearStoredSession()
      return null
    }

    const refreshedSession = {
      ...session,
      last_accessed_at: nowIso(),
    }
    writeSession(refreshedSession)
    return refreshedSession
  } catch {
    return null
  }
}

function createSession(): AuthSession {
  const timestamp = nowIso()
  return {
    authenticated: true,
    token: createLocalToken(),
    transport: 'bearer',
    user: configuredUser(),
    session_created_at: timestamp,
    last_accessed_at: timestamp,
    expires_at: expiresAtIso(),
  }
}

async function tryServerLogin(password: string): Promise<AuthSession | null> {
  if (typeof fetch !== 'function') return null
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (response.status === 404) return null
    if (!response.ok) return null
    return parseSession(JSON.stringify(await response.json()))
  } catch {
    return null
  }
}

async function tryServerLogout(): Promise<void> {
  if (typeof fetch !== 'function') return
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
  } catch {
    // Local session clearing below is authoritative for this client.
  }
}

export function useAuth(): AuthState {
  const password = useMemo(() => configuredPassword(), [])
  const isPasswordProtectionEnabled = password.length > 0
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession())

  const login = useCallback(async (candidatePassword: string) => {
    if (!isPasswordProtectionEnabled) {
      return true
    }

    const serverSession = await tryServerLogin(candidatePassword)
    if (serverSession) {
      writeSession(serverSession)
      setSession(serverSession)
      return true
    }

    if (candidatePassword === password) {
      const nextSession = createSession()
      writeSession(nextSession)
      setSession(nextSession)
      return true
    }

    return false
  }, [isPasswordProtectionEnabled, password])

  const clearSession = useCallback(() => {
    clearStoredSession()
    setSession(null)
  }, [])

  const logout = useCallback(async () => {
    await tryServerLogout()
    clearSession()
  }, [clearSession])

  return {
    isPasswordProtectionEnabled,
    isAuthenticated: !isPasswordProtectionEnabled || session !== null,
    session,
    login,
    logout,
    clearSession,
  }
}
