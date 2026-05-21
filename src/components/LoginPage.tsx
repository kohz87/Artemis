import { useState, type FormEvent } from 'react'
import './LoginPage.css'

type LoginPageProps = {
  onLogin: (password: string) => boolean
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const candidatePassword = password.trim()
    if (candidatePassword.length === 0) {
      setError('Enter the Artemis password to continue.')
      return
    }

    if (onLogin(candidatePassword)) {
      setError(null)
      return
    }

    setPassword('')
    setError('That password did not match. Try again.')
  }

  return (
    <main className="login-page" aria-labelledby="login-page-title">
      <section className="login-card">
        <div className="login-card__eyebrow">Artemis private workspace</div>
        <h1 id="login-page-title">Unlock Artemis</h1>
        <p className="login-card__copy">
          This Artemis instance is password protected. Enter the password from your deployment environment to continue.
        </p>
        <form className="login-card__form" onSubmit={handleSubmit} noValidate>
          <label className="login-card__label" htmlFor="artemis-password">Password</label>
          <input
            id="artemis-password"
            className="login-card__input"
            type="password"
            value={password}
            autoFocus
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'artemis-login-error' : undefined}
          />
          {error && <p id="artemis-login-error" className="login-card__error">{error}</p>}
          <button className="login-card__submit" type="submit">Unlock</button>
        </form>
      </section>
    </main>
  )
}
