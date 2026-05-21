import type { ReactNode } from 'react'
import { useAuth, type AuthSession } from '../hooks/useAuth'
import { LoginPage } from './LoginPage'

const sessionDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

type ProtectedRouteProps = {
  children: ReactNode
}

function formatSessionTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return sessionDateFormatter.format(date)
}

function SessionStatus({ session, onLogout, onClearSession }: {
  session: AuthSession
  onLogout: () => void
  onClearSession: () => void
}) {
  return (
    <aside className="auth-session-panel" aria-label="Artemis session status">
      <div className="auth-session-panel__status">Persistent session active</div>
      <div className="auth-session-panel__timestamp">
        Session created {formatSessionTimestamp(session.session_created_at)}
      </div>
      <div className="auth-session-panel__timestamp">
        Last accessed {formatSessionTimestamp(session.last_accessed_at)}
      </div>
      <div className="auth-session-panel__actions">
        <button className="auth-logout-button" type="button" onClick={onLogout} aria-label="Log out of Artemis">
          Log out
        </button>
        <button
          className="auth-clear-session-button"
          type="button"
          onClick={onClearSession}
          aria-label="Clear Artemis session"
        >
          Clear Session
        </button>
      </div>
    </aside>
  )
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const auth = useAuth()

  if (!auth.isAuthenticated) {
    return <LoginPage onLogin={auth.login} />
  }

  return (
    <>
      {children}
      {auth.isPasswordProtectionEnabled && auth.session && (
        <SessionStatus session={auth.session} onLogout={auth.logout} onClearSession={auth.clearSession} />
      )}
    </>
  )
}
