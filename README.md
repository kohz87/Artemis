# Artemis

Artemis is a local-first markdown knowledge base for writing, organizing, searching, and versioning notes. It treats a folder of `.md` files as the source of truth, layers a fast React/Vite web interface on top, and keeps your notes portable so they continue to work in any editor or git workflow.

Artemis is now a web-only app. There is no active Tauri desktop runtime, Rust backend, native updater, MCP configuration, model catalog, AI-provider setup, or desktop release setup in this repository. Filesystem and git operations run through the local web vault API when it is available, with browser-local demo persistence as the fallback.

## What Artemis does

- Files-first notes: every note is a plain markdown file with optional YAML frontmatter.
- Vault-based organization: open a folder as a vault, create notes, browse folders, and keep metadata close to the files.
- Git-aware workflows: initialize git, commit changes, connect remotes, pull/push, and resolve conflicts from the app.
- Fast editing: rich editing, raw markdown editing, wikilinks, backlinks, search, file previews, and keyboard-first commands.
- Web runtime: run the React app through Vite with a local `/api/vault` backend for real filesystem-backed vaults.
- Browser fallback mode: if the local vault API is unavailable, Artemis keeps a demo vault in browser `localStorage`.
- Optional password gate: protect a standalone web session with `ARTEMIS_PASSWORD`.
- Configurable network binding: use `ARTEMIS_HOST`, `ARTEMIS_PORT`, `ARTEMIS_API_HOST`, and `ARTEMIS_API_PORT` for local, LAN, or server deployments.

Current configuration is limited to the web listener, local vault API listener, optional password/session settings, telemetry/localization build-time settings, and per-vault note/git metadata.

## Requirements

- Node.js 20+
- pnpm 11.1.3, as pinned by `packageManager` in `package.json`
- git CLI, required for local vault git features

If Corepack is available, enable it before installing so the pinned pnpm version is used:

```bash
corepack enable
corepack prepare pnpm@11.1.3 --activate
```

## Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/kohz87/Artemis.git
cd Artemis
pnpm install
```

Create a local environment file if you want custom ports, telemetry keys, localization credentials, vault defaults, or password protection. No AI/API-key environment variables are required:

```bash
cp .env.example .env.local
```

The most common local settings are:

```bash
# Vite frontend listener. Defaults to localhost:5202.
ARTEMIS_HOST=localhost
ARTEMIS_PORT=5202

# Standalone local vault API listener used by pnpm dev. Defaults to 127.0.0.1:5302.
ARTEMIS_API_HOST=127.0.0.1
ARTEMIS_API_PORT=5302

# Optional default root for filesystem-backed web vaults. When set, this also
# scopes the vault API whitelist unless ARTEMIS_ALLOWED_VAULT_ROOTS is set.
ARTEMIS_WEB_VAULT_ROOT=~/ArtemisVault

# Optional explicit vault API whitelist. Defaults to your home directory when
# neither ARTEMIS_ALLOWED_VAULT_ROOTS nor ARTEMIS_WEB_VAULT_ROOT is set.
ARTEMIS_ALLOWED_VAULT_ROOTS=~/notes:~/work-notes

# Optional git binary and fallback author for local vault git operations.
ARTEMIS_GIT_BINARY=git
ARTEMIS_GIT_AUTHOR_NAME=Artemis Web
ARTEMIS_GIT_AUTHOR_EMAIL=artemis@localhost

# Optional. Leave blank to disable the login gate.
ARTEMIS_PASSWORD=
ARTEMIS_AUTH_USERNAME=artemis
ARTEMIS_AUTH_EMAIL=
ARTEMIS_SESSION_SECRET=
ARTEMIS_SESSION_TTL_SECONDS=2592000
```

Telemetry and localization settings, when needed for development or release builds, are also read from `.env.local`:

```bash
VITE_SENTRY_DSN=
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://eu.i.posthog.com
LARA_ACCESS_KEY_ID=
LARA_ACCESS_KEY_SECRET=
```

## Run Artemis locally

Start the full local development stack:

```bash
pnpm dev
```

`pnpm dev` runs both:

- `pnpm dev:server` — standalone Node `/api/vault` and `/api/auth` server, defaulting to `127.0.0.1:5302`.
- `pnpm dev:frontend` — Vite frontend, defaulting to `http://localhost:5202` and proxying API calls to the vault server.

Open:

```text
http://localhost:5202
```

You can also run the two processes independently in separate terminals:

```bash
pnpm dev:server
pnpm dev:frontend
```

`pnpm dev:web` is kept as a compatibility alias for the full web development stack:

```bash
pnpm dev:web
```

For frontend-only development, run `pnpm dev:frontend` and start `pnpm dev:server`
in another terminal when you need filesystem-backed vaults.

To expose the frontend on your network or use a different port:

```bash
ARTEMIS_HOST=0.0.0.0 ARTEMIS_PORT=5200 pnpm dev
```

When running with the local vault API, Artemis reads and writes real markdown files in the vault folder you select. If the local vault API is unavailable, it falls back to browser-local demo persistence under `tolaria:web-vault:*` `localStorage` keys.

## First vault setup

1. Start Artemis with `pnpm dev`.
2. Open `http://localhost:5202`.
3. Open or select a vault folder when prompted. Use an absolute path such as `/home/alex/notes`, `~/notes`, or a folder under `ARTEMIS_WEB_VAULT_ROOT`.
4. Create a note. Artemis writes it as a `.md` file in the selected vault when the local vault API is available.
5. If you want version history, initialize git for that vault from the setup flow, status bar, or command palette.
6. If you want remote sync, connect a git remote from the bottom-bar remote chip or command palette.

A vault can be either a plain folder or a git repository. Plain folders support markdown editing, search, and navigation; git-backed vaults additionally support history, commits, pull/push, remotes, auto-sync, and conflict resolution.

## Optional password protection

Set `ARTEMIS_PASSWORD` before starting Artemis to require a login before the UI and local vault API can be used:

```bash
ARTEMIS_PASSWORD='choose-a-long-password' pnpm dev
```

Optional auth settings:

- `ARTEMIS_AUTH_USERNAME` / `ARTEMIS_USERNAME` — username stored in the session identity; defaults to `artemis`.
- `ARTEMIS_AUTH_EMAIL` — optional email stored in the session identity.
- `ARTEMIS_SESSION_SECRET` — HMAC signing secret for session tokens; defaults to the password when omitted.
- `ARTEMIS_SESSION_TTL_SECONDS` — session lifetime; defaults to 30 days.

Successful logins persist in browser storage and also use a same-origin `HttpOnly`, `SameSite=Strict` `artemis_session` cookie for local API requests. Use the session panel to log out or clear the stored session immediately.

## Production web build

Build and serve the browser version:

```bash
pnpm build:web
pnpm serve:web
```

The production server serves `dist/` and includes the local `/api/vault/*` and `/api/auth/*` routes. It loads `.env` and `.env.local` if present, without overriding variables already set by the shell. It listens on `0.0.0.0:5173` unless `ARTEMIS_HOST`, `ARTEMIS_PORT`, `ARTEMIS_WEB_PORT`, or `PORT` is set:

```bash
ARTEMIS_HOST=0.0.0.0 ARTEMIS_PORT=5200 pnpm serve:web
```

## Useful commands

```bash
pnpm dev                 # Run vault API server and Vite frontend together
pnpm dev:server          # Run only the standalone local vault API/auth server
pnpm dev:frontend        # Run only the Vite frontend
pnpm dev:web             # Compatibility alias for the full web dev stack
pnpm build               # Type-check and build web assets
pnpm build:web           # Type-check and build web assets
pnpm serve:web           # Serve the production web build with local API routes
pnpm lint                # ESLint
pnpm test                # Vitest test suite
pnpm test:coverage       # Vitest coverage gate
pnpm playwright:smoke    # Curated Playwright smoke tests
pnpm playwright:regression # Full Playwright smoke directory
pnpm l10n:translate      # Update translated locale catalogs
pnpm l10n:validate       # Validate locale catalogs
```

## Project layout

```text
src/                    React frontend, hooks, components, utilities, localization
src/backend/            Typed web backend client, HTTP bridge, browser fallback handlers
packages/vault-server/  Standalone Node /api/vault and /api/auth server
docs/                   Architecture notes, setup docs, and ADRs
scripts/                Local build, serving, and validation helpers
tests/                  Playwright tests
demo-vault-v2/          Curated local QA fixture
```

## More documentation

- `docs/WEB.md` — web runtime, vault API, auth, and deployment notes
- `docs/GETTING-STARTED.md` — deeper development guide
- `docs/ARCHITECTURE.md` — system design and data flow
- `docs/ABSTRACTIONS.md` — core product and code abstractions
- `docs/adr/0111-web-only-vite-vault-backend.md` — current web-only architecture decision
- `docs/adr/` — architecture decision records

## Security

If you find a security issue, report it privately using the process in `SECURITY.md`.

## License

Artemis is licensed under AGPL-3.0-or-later.
