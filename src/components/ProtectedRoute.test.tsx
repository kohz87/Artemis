import { act, render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'
import { ARTEMIS_AUTH_SESSION_KEY } from '../hooks/useAuth'

const now = new Date('2026-05-20T12:34:56.000Z')

describe('ProtectedRoute', () => {
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

  it('renders app content immediately when ARTEMIS_PASSWORD is not set', () => {
    vi.stubEnv('ARTEMIS_PASSWORD', '')

    render(
      <ProtectedRoute>
        <div>Artemis workspace</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Artemis workspace')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Unlock Artemis' })).not.toBeInTheDocument()
  })

  it('shows the login page before app access when ARTEMIS_PASSWORD is set', () => {
    vi.stubEnv('ARTEMIS_PASSWORD', 'swordfish')

    render(
      <ProtectedRoute>
        <div>Artemis workspace</div>
      </ProtectedRoute>,
    )

    expect(screen.getByRole('heading', { name: 'Unlock Artemis' })).toBeInTheDocument()
    expect(screen.queryByText('Artemis workspace')).not.toBeInTheDocument()
  })

  it('shows an error after a wrong password and allows retry', async () => {
    vi.stubEnv('ARTEMIS_PASSWORD', 'swordfish')

    render(
      <ProtectedRoute>
        <div>Artemis workspace</div>
      </ProtectedRoute>,
    )

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    })

    expect(screen.getByText('That password did not match. Try again.')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveValue('')

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'swordfish' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    })

    expect(screen.getByText('Artemis workspace')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(ARTEMIS_AUTH_SESSION_KEY) ?? '{}')).toMatchObject({
      authenticated: true,
      token: expect.stringMatching(/^local\./),
      transport: 'bearer',
      user: { username: 'artemis', email: null },
      session_created_at: now.toISOString(),
      last_accessed_at: now.toISOString(),
    })
    expect(sessionStorage.getItem(ARTEMIS_AUTH_SESSION_KEY)).toBeNull()
  })

  it('keeps app access across browser restarts and supports logout', async () => {
    vi.stubEnv('ARTEMIS_PASSWORD', 'swordfish')
    localStorage.setItem(ARTEMIS_AUTH_SESSION_KEY, JSON.stringify({
      authenticated: true,
      token: 'local.protected-token',
      transport: 'bearer',
      user: { username: 'artemis', email: null },
      session_created_at: now.toISOString(),
      last_accessed_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }))

    render(
      <ProtectedRoute>
        <div>Artemis workspace</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Artemis workspace')).toBeInTheDocument()
    expect(screen.getByText('Session created May 20, 2026, 12:34 PM')).toBeInTheDocument()
    expect(screen.getByText('Last accessed May 20, 2026, 12:34 PM')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log out of Artemis' }))
    })

    expect(screen.getByRole('heading', { name: 'Unlock Artemis' })).toBeInTheDocument()
    expect(localStorage.getItem(ARTEMIS_AUTH_SESSION_KEY)).toBeNull()
  })

  it('allows users to manually clear the persistent session', async () => {
    vi.stubEnv('ARTEMIS_PASSWORD', 'swordfish')
    localStorage.setItem(ARTEMIS_AUTH_SESSION_KEY, JSON.stringify({
      authenticated: true,
      token: 'local.protected-token',
      transport: 'bearer',
      user: { username: 'artemis', email: null },
      session_created_at: now.toISOString(),
      last_accessed_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }))

    render(
      <ProtectedRoute>
        <div>Artemis workspace</div>
      </ProtectedRoute>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clear Artemis session' }))

    expect(screen.getByRole('heading', { name: 'Unlock Artemis' })).toBeInTheDocument()
    expect(localStorage.getItem(ARTEMIS_AUTH_SESSION_KEY)).toBeNull()
  })

  it('allows users to dismiss the persistent session status panel without ending the session', async () => {
    vi.stubEnv('ARTEMIS_PASSWORD', 'swordfish')
    localStorage.setItem(ARTEMIS_AUTH_SESSION_KEY, JSON.stringify({
      authenticated: true,
      token: 'local.protected-token',
      transport: 'bearer',
      user: { username: 'artemis', email: null },
      session_created_at: now.toISOString(),
      last_accessed_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }))

    render(
      <ProtectedRoute>
        <div>Artemis workspace</div>
      </ProtectedRoute>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Artemis session status' }))

    expect(screen.getByText('Artemis workspace')).toBeInTheDocument()
    expect(screen.queryByLabelText('Artemis session status')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(ARTEMIS_AUTH_SESSION_KEY) ?? '{}')).toMatchObject({
      authenticated: true,
      token: 'local.protected-token',
      transport: 'bearer',
      user: { username: 'artemis', email: null },
      session_created_at: now.toISOString(),
      last_accessed_at: now.toISOString(),
    })
  })
})
