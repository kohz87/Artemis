import { useCallback, useMemo, useState } from 'react'

export const ARTEMIS_AUTH_SESSION_KEY = 'artemis.authenticated'
const SESSION_MAX_IDLE_MS = 30 * 24 * 60 * 60 * 1000

export type AuthSession = {
  authenticated: true
  session_created_at: string
  last_accessed_at: string
}

type AuthState = {
  isPasswordProtectionEnabled: boolean
  isAuthenticated: boolean
  session: AuthSession | null
  login: (password: string) => boolean
  logout: () => void
  clearSession: () => void
}

function configuredPassword(): string {
  return (import.meta.env.ARTEMIS_PASSWORD ?? '').trim()
}

function nowIso(): string {
  return new Date().toISOString()
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
  return Number.isNaN(lastAccessed) || now - lastAccessed > SESSION_MAX_IDLE_MS
}

function parseSession(raw: string | null): AuthSession | null {
  if (!raw) return null
  if (raw === 'authenticated') {
    const timestamp = nowIso()
    return {
      authenticated: true,
      session_created_at: timestamp,
      last_accessed_at: timestamp,
    }
  }

  try {
    const candidate = JSON.parse(raw) as Partial<AuthSession>
    if (
      candidate.authenticated === true
      && typeof candidate.session_created_at === 'string'
      && typeof candidate.last_accessed_at === 'string'
    ) {
      return {
        authenticated: true,
        session_created_at: candidate.session_created_at,
        last_accessed_at: candidate.last_accessed_at,
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
    session_created_at: timestamp,
    last_accessed_at: timestamp,
  }
}

export function useAuth(): AuthState {
  const password = useMemo(() => configuredPassword(), [])
  const isPasswordProtectionEnabled = password.length > 0
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession())

  const login = useCallback((candidatePassword: string) => {
    if (!isPasswordProtectionEnabled) {
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

  const logout = useCallback(() => {
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
