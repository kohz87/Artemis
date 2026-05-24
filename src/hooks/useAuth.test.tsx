import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth, ARTEMIS_AUTH_SESSION_KEY, type AuthSession } from './useAuth'

const now = new Date('2026-05-20T12:34:56.000Z')
const later = new Date('2026-05-20T13:34:56.000Z')
const expiredLastAccess = new Date('2026-04-01T12:34:56.000Z')

describe('useAuth', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.useFakeTimers()
    vi.setSystemTime(now)
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('disables password protection when ARTEMIS_PASSWORD is not set', () => {
    vi.stubEnv('ARTEMIS_PASSWORD', '')

    const { result } = renderHook(() => useAuth())

    expect(result.current.isPasswordProtectionEnabled).toBe(false)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('requires authentication when ARTEMIS_PASSWORD is set and no persistent session exists', () => {
    vi.stubEnv('ARTEMIS_PASSWORD', 'swordfish')

    const { result } = renderHook(() => useAuth())

    expect(result.current.isPasswordProtectionEnabled).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.session).toBeNull()
  })

  it('rejects an incorrect password without storing a persistent session', async () => {
    vi.stubEnv('ARTEMIS_PASSWORD', 'swordfish')

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await expect(result.current.login('wrong')).resolves.toBe(false)
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem(ARTEMIS_AUTH_SESSION_KEY)).toBeNull()
    expect(sessionStorage.getItem(ARTEMIS_AUTH_SESSION_KEY)).toBeNull()
  })

  it('accepts the configured password and persists a bearer session with user identity and expiry in localStorage', async () => {
    vi.stubEnv('ARTEMIS_PASSWORD', 'swordfish')

    const { result, rerender } = renderHook(() => useAuth())

    await act(async () => {
      await expect(result.current.login('swordfish')).resolves.toBe(true)
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.session).toEqual<AuthSession>({
      authenticated: true,
      token: expect.stringMatching(/^local\./),
      transport: 'bearer',
      user: { username: 'artemis', email: null },
      session_created_at: now.toISOString(),
      last_accessed_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    expect(JSON.parse(localStorage.getItem(ARTEMIS_AUTH_SESSION_KEY) ?? '{}')).toEqual({
      authenticated: true,
      token: expect.stringMatching(/^local\./),
      transport: 'bearer',
      user: { username: 'artemis', email: null },
      session_created_at: now.toISOString(),
      last_accessed_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    expect(sessionStorage.getItem(ARTEMIS_AUTH_SESSION_KEY)).toBeNull()

    rerender()

    expect(result.current.isAuthenticated).toBe(true)
  })

  it('restores an existing localStorage session and refreshes last_accessed_at', () => {
    vi.stubEnv('ARTEMIS_PASSWORD', 'swordfish')
    localStorage.setItem(ARTEMIS_AUTH_SESSION_KEY, JSON.stringify({
      authenticated: true,
      token: 'local.existing-token',
      transport: 'bearer',
      user: { username: 'luca', email: 'luca@example.test' },
      session_created_at: now.toISOString(),
      last_accessed_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }))
    vi.setSystemTime(later)

    const { result } = renderHook(() => useAuth())

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.session).toEqual<AuthSession>({
      authenticated: true,
      token: 'local.existing-token',
      transport: 'bearer',
      user: { username: 'luca', email: 'luca@example.test' },
      session_created_at: now.toISOString(),
      last_accessed_at: later.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    expect(JSON.parse(localStorage.getItem(ARTEMIS_AUTH_SESSION_KEY) ?? '{}')).toEqual({
      authenticated: true,
      token: 'local.existing-token',
      transport: 'bearer',
      user: { username: 'luca', email: 'luca@example.test' },
      session_created_at: now.toISOString(),
      last_accessed_at: later.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
  })

  it('expires persistent sessions after 30 days of inactivity or at token expiry', () => {
    vi.stubEnv('ARTEMIS_PASSWORD', 'swordfish')
    localStorage.setItem(ARTEMIS_AUTH_SESSION_KEY, JSON.stringify({
      authenticated: true,
      token: 'local.expired-token',
      transport: 'bearer',
      user: { username: 'artemis', email: null },
      session_created_at: expiredLastAccess.toISOString(),
      last_accessed_at: expiredLastAccess.toISOString(),
      expires_at: expiredLastAccess.toISOString(),
    }))

    const { result } = renderHook(() => useAuth())

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.session).toBeNull()
    expect(localStorage.getItem(ARTEMIS_AUTH_SESSION_KEY)).toBeNull()
  })

  it('clears the persistent session on logout or manual clear', async () => {
    vi.stubEnv('ARTEMIS_PASSWORD', 'swordfish')
    localStorage.setItem(ARTEMIS_AUTH_SESSION_KEY, JSON.stringify({
      authenticated: true,
      token: 'local.logout-token',
      transport: 'bearer',
      user: { username: 'artemis', email: null },
      session_created_at: now.toISOString(),
      last_accessed_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }))

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.session).toBeNull()
    expect(localStorage.getItem(ARTEMIS_AUTH_SESSION_KEY)).toBeNull()

    await act(async () => {
      await result.current.login('swordfish')
      result.current.clearSession()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.session).toBeNull()
    expect(localStorage.getItem(ARTEMIS_AUTH_SESSION_KEY)).toBeNull()
  })
})
