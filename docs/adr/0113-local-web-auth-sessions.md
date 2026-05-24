---
type: ADR
id: "0113"
title: "Local web auth sessions for protected Artemis instances"
status: active
date: 2026-05-24
---

## Context

Artemis web deployments could previously protect the app shell with only a client-side `ARTEMIS_PASSWORD` comparison. That gate did not establish a server-verifiable identity, could not protect local `/api/vault/*` routes directly, and gave the backend no session lifetime or logout semantics.

The local web vault API is capable of reading and mutating vault files, so password-protected instances need an auth boundary that covers both the React shell and the Node vault server routes.

## Decision

**Use signed, expiring local web auth sessions issued by the standalone Node vault server whenever `ARTEMIS_PASSWORD` is set.**

The server exposes `/api/auth/login`, `/api/auth/session`, `/api/auth/refresh`, and `/api/auth/logout`. Successful login issues an HMAC-SHA256 signed JWT-style token containing the configured username/email identity plus issue and expiry timestamps. The token is returned to the client and also written to an `HttpOnly`, `SameSite=Strict` cookie. `/api/vault/*` requests require either the auth cookie or a matching `Authorization: Bearer <token>` header while auth is enabled.

The React `useAuth` hook persists the session metadata in browser storage for reload continuity and sends the bearer token with vault API requests. It retains a local bearer-token fallback for browser-only/demo mode when the standalone auth endpoints are unavailable.

## Options considered

- **Option A (chosen): Signed local token plus HttpOnly cookie and bearer fallback.** Protects backend routes, gives the browser explicit session metadata, works with same-origin fetches, and avoids introducing a database or hosted identity service for local deployments.
- **Option B: Keep the existing password-only client gate.** Simple, but backend routes remain unable to validate identity or expire sessions.
- **Option C: Add a full multi-user database-backed auth stack.** More complete for hosted SaaS scenarios, but premature for the current local web architecture and would add storage and migration surface before roles or user management are defined.

## Consequences

- `ARTEMIS_PASSWORD` enables auth for both `/api/auth/*` and `/api/vault/*`; unset passwords preserve the no-auth local development flow.
- `ARTEMIS_AUTH_USERNAME`, `ARTEMIS_AUTH_EMAIL`, `ARTEMIS_SESSION_SECRET`, and `ARTEMIS_SESSION_TTL_SECONDS` configure session identity, signing, and timeout. If no explicit session secret is set, the password signs tokens.
- Logout clears the server cookie and removes the browser-stored session.
- Passwords are still configured through environment variables; a future hosted/multi-user mode should revisit bcrypt-hashed credentials and role storage rather than extending this local-only password secret.
- Session expiry is enforced by the server token `exp` claim and by the client-side idle/lifetime checks for stored browser session metadata.
