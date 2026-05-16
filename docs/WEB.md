# Artemis Web

Artemis can run as a browser app without the Tauri desktop shell.

## Local Web Development

```bash
pnpm install
pnpm dev:web
```

Open the URL printed by Vite. Browser mode uses the same React UI as the
desktop app and falls back to the mock Tauri command layer when native commands
are unavailable.

The development server binds to `0.0.0.0:5202` by default, so on a new Fedora
machine you can open `http://localhost:5202` locally or
`http://<fedora-ip>:5202` from another device on the same network. Set
`ARTEMIS_WEB_PORT=5300` before `pnpm dev:web` or `pnpm serve:web` to use a
different browser port.

MCP bridge ports are configurable too. `ARTEMIS_MCP_WS_PORT` controls the tool
bridge, default `9710`, and `ARTEMIS_MCP_WS_UI_PORT` controls the UI action
bridge, default `9711`. Reconnect Artemis MCP after changing either value so
external tool config snippets are refreshed.

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
The production web server listens on `0.0.0.0:5173` unless `ARTEMIS_WEB_PORT`
or `PORT` is set.
