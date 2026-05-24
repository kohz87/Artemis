# Artemis Web

Artemis is a browser-first web app. The React UI talks to explicit web backend functions in `src/backend/client.ts`, which prefer the local `/api/vault/*` middleware and fall back to browser-local demo persistence when the API is unavailable.

## Local Web Development

```bash
pnpm install
pnpm dev:web
```

Open the URL printed by Vite. Web mode uses the same React UI in development and production. Filesystem-backed vaults go through the local web vault API; when that API is not available, Artemis uses an in-browser demo vault backed by localStorage.

The development server binds to `localhost:5202` by default. Set `ARTEMIS_HOST=0.0.0.0` to allow network access from other
devices, and set `ARTEMIS_PORT=5300` before `pnpm dev:web` to use a different
browser port. `ARTEMIS_WEB_PORT` and `PORT` remain compatibility aliases for the
port.

```bash
ARTEMIS_HOST=0.0.0.0 ARTEMIS_PORT=5200 pnpm dev:web
```

external tool config snippets are refreshed.

## Authentication

Set `ARTEMIS_PASSWORD` to require login before the React shell can open a vault
and before the local server will serve `/api/vault/*` routes. Successful login
calls `/api/auth/login`, receives signed session metadata with the configured
user identity, and stores a session token for reload continuity. The server also
sets an `HttpOnly`, `SameSite=Strict` `artemis_session` cookie so same-origin
vault API calls can authenticate without exposing the cookie to JavaScript.

Optional auth environment variables:

- `ARTEMIS_AUTH_USERNAME` / `ARTEMIS_USERNAME`: username stored in the session
  identity (`artemis` by default).
- `ARTEMIS_AUTH_EMAIL`: optional email stored in the session identity.
- `ARTEMIS_SESSION_SECRET`: HMAC signing secret for session tokens. If omitted,
  the password is used as the signing secret.
- `ARTEMIS_SESSION_TTL_SECONDS`: session lifetime in seconds (30 days by
  default).

The browser sends the stored bearer token on vault API calls and also includes
same-origin cookies. `/api/auth/logout` clears the server cookie, and the client
removes its persisted session. If the standalone auth endpoints are unavailable
(such as browser-only demo mode), the UI keeps a local bearer-token fallback so
existing password-protected demos still work without a server.

## Browser Persistence

Web mode has two storage modes:

- If you open a real directory while running `pnpm dev:web`, notes are read
  from and saved to markdown files in that directory through the local Vite
  `/api/vault/*` middleware. On Linux, enter an absolute path such as
  `/home/alex/notes` when the browser prompt asks for a vault folder. The
  server also resolves `~/notes` and existing relative paths to absolute paths
  before storing the vault selection.
- Local git actions in web mode are handled by the same local server. The
  server uses `ARTEMIS_WEB_VAULT_ROOT` as the default vault root when set, then
  falls back to `/root/git` when that directory exists. You can also set
  `ARTEMIS_GIT_BINARY` if `git` is not on `PATH`. Commits use the repository's
  configured git author when present; otherwise Artemis writes a repo-local
  fallback from `ARTEMIS_GIT_AUTHOR_NAME` and `ARTEMIS_GIT_AUTHOR_EMAIL`
  (`Artemis Web <artemis@localhost>` by default). The old `TOLARIA_*` variables
  still work as compatibility aliases.
- If no local vault API is available, the demo vault is persisted in
  `localStorage` under `tolaria:web-vault:*` keys. Created notes, edits,
  deletes, app settings, and the active vault list survive page reloads in the
  same browser profile, but they are not written to a filesystem directory.

If a local Vite vault API is available at `/api/vault/*`, Artemis uses it for
filesystem-backed vault reads and writes. Otherwise it stays fully client-side.
Image and PDF previews are also served through the local `/api/vault/asset`
route in web mode.

Browsers cannot open your Linux file manager or launch a system default app
directly from a web page. In web mode, Artemis keeps those actions browser-only:
"Copy file path" and "Copy folder path" copy the path to the clipboard, show the
directory in the toast, and fall back to a manual-copy prompt when the browser
blocks clipboard access.

## Production Web Build

```bash
pnpm build:web
pnpm serve:web
```

The included static server supports the local vault API for reading, saving,
and git operations against local repositories. Without a local vault API,
filesystem and git operations use the browser-safe mock implementations.
The production web server listens on `0.0.0.0:5173` unless `ARTEMIS_HOST`,
`ARTEMIS_PORT`, `ARTEMIS_WEB_PORT`, or `PORT` is set.
