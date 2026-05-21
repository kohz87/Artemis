# Artemis

Artemis is a local-first markdown knowledge base for writing, organizing, searching, and versioning notes. It treats a folder of `.md` files as the source of truth, layers a fast React/Tauri interface on top, and keeps your notes portable so they continue to work in any editor or git workflow.

## What Artemis does

- Files-first notes: every note is a plain markdown file with optional YAML frontmatter.
- Vault-based organization: open a folder as a vault, create notes, browse folders, and keep metadata close to the files.
- Git-aware workflows: initialize git, commit changes, connect remotes, pull/push, and resolve conflicts from the app.
- Fast editing: rich editing, raw markdown editing, wikilinks, backlinks, search, file previews, and keyboard-first commands.
- Web or desktop runtime: run as a browser app through Vite, or as a native desktop app through Tauri.
- Optional web password gate: protect a standalone web session with `ARTEMIS_PASSWORD`.
- Configurable network binding: use `ARTEMIS_HOST` and `ARTEMIS_PORT` for local, LAN, or server deployments.

## Requirements

For web development:

- Node.js 20+
- pnpm 8+
- git

For desktop development:

- Rust stable
- Tauri system dependencies for your OS

Linux desktop dependencies:

```bash
# Debian / Ubuntu 22.04+
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  libsoup-3.0-dev patchelf

# Fedora 38+
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel

# Arch / Manjaro
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg
```

## Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/kohz87/Artemis.git
cd Artemis
pnpm install
```

Create a local environment file if you want custom ports, telemetry keys, localization credentials, or password protection:

```bash
cp .env.example .env.local
```

The most common local settings are:

```bash
# Bind only to this machine by default.
ARTEMIS_HOST=localhost

# Default dev port used by Vite and Tauri.
ARTEMIS_PORT=5202

# Optional. Leave blank to disable the login gate.
ARTEMIS_PASSWORD=
```

## Run Artemis in the browser

Start the web development server:

```bash
pnpm dev:web
```

Open the URL printed by Vite. By default Artemis listens on:

```text
http://localhost:5202
```

To expose it on your network or use a different port:

```bash
ARTEMIS_HOST=0.0.0.0 ARTEMIS_PORT=5200 pnpm dev:web
```

When running in web mode, Artemis uses the local Vite `/api/vault/*` middleware to read and write real markdown files when a vault folder is selected. If the local vault API is unavailable, it falls back to browser-local demo persistence.

## First vault setup

1. Start Artemis with `pnpm dev:web` or `pnpm tauri dev`.
2. Open or select a vault folder when prompted.
3. Use a dedicated folder for your notes, for example `~/ArtemisVault` or `~/notes`.
4. Create a note. Artemis writes it as a `.md` file in the selected vault.
5. If you want version history, initialize git for that vault from the setup flow, status bar, or command palette.
6. If you want remote sync, connect a git remote from the bottom-bar remote chip or command palette.

A vault can be either a plain folder or a git repository. Plain folders support markdown editing, search, and navigation; git-backed vaults additionally support history, commits, pull/push, remotes, auto-sync, and conflict resolution.

## Optional password protection

Set `ARTEMIS_PASSWORD` before starting or building Artemis to require a login before the UI loads:

```bash
ARTEMIS_PASSWORD='choose-a-long-password' pnpm dev:web
```

Successful logins persist in `localStorage` with creation and last-accessed timestamps. Sessions expire after 30 days of inactivity. Use the session panel to log out or clear the stored session immediately.

## Production web build

Build and serve the browser version:

```bash
pnpm build:web
pnpm serve:web
```

The production web server listens on `0.0.0.0:5173` unless `ARTEMIS_HOST`, `ARTEMIS_PORT`, `ARTEMIS_WEB_PORT`, or `PORT` is set:

```bash
ARTEMIS_HOST=0.0.0.0 ARTEMIS_PORT=5200 pnpm serve:web
```

## Run Artemis as a desktop app

Start the Tauri desktop app:

```bash
pnpm tauri dev
```

Tauri uses the same React frontend and native Rust commands for filesystem, git, updater, and desktop integrations.

## Useful commands

```bash
pnpm dev:web              # Web dev server
pnpm build:web            # Type-check and build web assets
pnpm serve:web            # Serve the production web build
pnpm tauri dev            # Native desktop development
pnpm lint                 # ESLint
pnpm test                 # Vitest test suite
pnpm test:coverage        # Vitest coverage gate
pnpm playwright:smoke     # Curated Playwright smoke tests
pnpm playwright:regression # Full Playwright smoke directory
```

Rust tests live under `src-tauri`:

```bash
cd src-tauri
cargo test
```

## Project layout

```text
src/                React frontend, hooks, components, utilities, localization
src-tauri/          Tauri/Rust backend commands, vault scanning, git integration
docs/               Architecture notes, setup docs, and ADRs
scripts/            Local build, serving, and validation helpers
tests/              Playwright tests
```

## More documentation

- `docs/WEB.md` — web runtime, vault API, and deployment notes
- `docs/GETTING-STARTED.md` — deeper development guide
- `docs/ARCHITECTURE.md` — system design and data flow
- `docs/ABSTRACTIONS.md` — core product and code abstractions
- `docs/adr/` — architecture decision records

## Security

If you find a security issue, report it privately using the process in `SECURITY.md`.

## License

Artemis is licensed under AGPL-3.0-or-later.
