# Getting Started

How to navigate the web codebase, run the app, and find what you need.

## Prerequisites

- **Node.js** 20+ and **pnpm 8+**
- **git** CLI (required by the local web vault git integration features)

## Quick Start

```bash
# Install dependencies
pnpm install

# Run in browser (no Rust needed — uses mock data or the local vault API)
pnpm dev:web
# Open http://localhost:5202

# Run tests
pnpm test          # Vitest unit tests
pnpm playwright:smoke  # Curated Playwright core smoke lane (~5 min)
pnpm playwright:regression  # Full Playwright regression suite
```

## Optional Web Listening Configuration

Vite reads `ARTEMIS_HOST` and `ARTEMIS_PORT` from `.env.local` or the shell when
running `pnpm dev:web`. The default is `localhost:5202` for Vite
dev compatibility. Use `ARTEMIS_HOST=0.0.0.0` when another device on the network
needs to reach the dev server:

```bash
ARTEMIS_HOST=0.0.0.0 ARTEMIS_PORT=5200 pnpm dev:web
```

## Optional Web Password Protection

Set `ARTEMIS_PASSWORD` in `.env.local` or in the deployment environment before starting/building the Vite app to require a simple persistent login before the Artemis UI loads:

```bash
cp .env.example .env.local
ARTEMIS_PASSWORD='choose-a-long-password' pnpm dev
```

Leave `ARTEMIS_PASSWORD` unset or blank to run without password protection. Successful logins are remembered in `localStorage` with `authenticated`, `session_created_at`, and `last_accessed_at` fields, so access persists across browser close/reopen until 30 days of inactivity. The session panel shows creation/access timestamps and provides both `Log out` and `Clear Session` controls to remove the persistent session immediately.

## Starter Vaults And Remotes

`create_getting_started_vault` clones the public starter repo and then removes every git remote from the new local copy. That means Getting Started vaults open local-only by default. Users connect a compatible remote later through the bottom-bar `No remote` chip or the command palette, both of which feed the same `AddRemoteModal` and `git_add_remote` backend flow.

Linux AppImage builds still use the user's system `git`. Before Artemis spawns that `git` process, it removes AppImage loader overrides such as `LD_LIBRARY_PATH`, `LD_PRELOAD`, and `GIT_EXEC_PATH` so HTTPS clone helpers use the host git libraries instead of bundled AppImage libraries.

## Directory Structure

```
artemis/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point (renders <App />)
│   ├── App.tsx                   # Root component — orchestrates layout + state
│   ├── App.css                   # App shell layout styles
│   ├── types.ts                  # Shared TS types (VaultEntry, Settings, etc.)
│   ├── backend/                  # Web backend client, demo handlers, optional HTTP vault API
│   ├── theme.json                # Editor typography theme configuration
│   ├── index.css                 # Semantic app theme variables + Tailwind setup
│   │
│   ├── components/               # UI components (~98 files)
│   │   ├── Sidebar.tsx           # Left panel: filters + type groups
│   │   ├── SidebarParts.tsx      # Sidebar subcomponents
│   │   ├── NoteList.tsx          # Second panel: filtered note list
│   │   ├── NoteItem.tsx          # Individual note item
│   │   ├── PulseView.tsx         # Git activity feed (replaces NoteList)
│   │   ├── Editor.tsx            # Third panel: editor orchestration
│   │   ├── EditorContent.tsx     # Editor content area
│   │   ├── EditorRightPanel.tsx  # Right panel toggle
│   │   ├── editorSchema.tsx      # BlockNote schema + wikilink type
│   │   ├── RawEditorView.tsx     # CodeMirror raw editor
│   │   ├── Inspector.tsx         # Fourth panel: metadata + relationships
│   │   ├── DynamicPropertiesPanel.tsx  # Editable frontmatter properties
│   │   ├── SearchPanel.tsx       # Search interface
│   │   ├── SettingsPanel.tsx     # App settings
│   │   ├── StatusBar.tsx         # Bottom bar: vault picker + sync
│   │   ├── CommandPalette.tsx    # Cmd+K command launcher
│   │   ├── BreadcrumbBar.tsx     # Breadcrumb + word count + actions
│   │   ├── WelcomeScreen.tsx     # Onboarding screen
│   │   ├── CloneVaultModal.tsx   # Clone a vault from any git URL
│   │   ├── AddRemoteModal.tsx    # Connect a local-only vault to a remote later
│   │   ├── ConflictResolverModal.tsx # Git conflict resolution
│   │   ├── CommitDialog.tsx      # Git commit modal
│   │   ├── CreateNoteDialog.tsx  # New note modal
│   │   ├── CreateTypeDialog.tsx  # New type modal
│   │   ├── inspector/            # Inspector sub-panels
│   │   │   ├── BacklinksPanel.tsx
│   │   │   ├── RelationshipsPanel.tsx
│   │   │   ├── GitHistoryPanel.tsx
│   │   │   └── ...
│   │   └── ui/                   # shadcn/ui primitives
│   │       ├── button.tsx, dialog.tsx, input.tsx, ...
│   │
│   ├── hooks/                    # Custom React hooks (~86 files)
│   │   ├── useVaultLoader.ts     # Loads vault entries + content
│   │   ├── useVaultSwitcher.ts   # Multi-vault management
│   │   ├── useVaultConfig.ts     # Per-vault UI settings
│   │   ├── useNoteActions.ts     # Composes creation + rename + frontmatter
│   │   ├── useNoteCreation.ts    # Note/type creation
│   │   ├── useNoteRename.ts     # Note renaming + wikilink updates
│   │   ├── useAutoSync.ts        # Auto git pull/push
│   │   ├── useConflictResolver.ts # Git conflict handling
│   │   ├── useEditorSave.ts      # Auto-save with debounce
│   │   ├── useTheme.ts           # Flatten theme.json → CSS vars
│   │   ├── useUnifiedSearch.ts   # Keyword search
│   │   ├── useNoteSearch.ts      # Note search
│   │   ├── useCommandRegistry.ts # Command palette registry
│   │   ├── useAppCommands.ts     # App-level commands
│   │   ├── useAppKeyboard.ts     # Keyboard shortcuts
│   │   ├── appCommandCatalog.ts  # Shortcut combos + command metadata
│   │   ├── appCommandDispatcher.ts # Shared shortcut/menu command IDs + dispatch
│   │   ├── useSettings.ts        # App settings
│   │   ├── useGettingStartedClone.ts # Shared Getting Started clone action
│   │   ├── useOnboarding.ts      # First-launch flow
│   │   ├── useCodeMirror.ts      # CodeMirror raw editor
│   │   └── ...
│   │
│   ├── utils/                    # Pure utility functions (~48 files)
│   │   ├── wikilinks.ts          # Wikilink preprocessing pipeline
│   │   ├── frontmatter.ts        # TypeScript YAML parser
│   │   ├── plainTextPaste.ts     # Shared Paste without Formatting command target registry
│   │   ├── noteListHelpers.ts    # Sorting, filtering, date formatting
│   │   ├── wikilink.ts           # Wikilink resolution
│   │   ├── configMigration.ts    # localStorage → vault config migration
│   │   ├── iconRegistry.ts       # Phosphor icon registry
│   │   ├── propertyTypes.ts      # Property type definitions
│   │   ├── vaultListStore.ts     # Vault list persistence
│   │   ├── vaultConfigStore.ts   # Vault config store
│   │   └── ...
│   │
│   ├── lib/
│   │   ├── i18n.ts               # App-owned localization runtime and locale resolution
│   │   ├── locales/              # JSON locale catalogs (English source + translated locales)
│   │   ├── releaseChannel.ts     # Alpha/stable normalization helpers
│   │   └── utils.ts              # Tailwind merge + cn() helper
│   │
│   └── test/
│       └── setup.ts              # Vitest test environment setup
│
├── scripts/                      # Node/Vite helper scripts
│   │   ├── vault_config.rs       # Per-vault UI config
│   │   ├── vault_list.rs         # Vault list persistence
│   │   └── menu.rs               # Native macOS menu bar
│   └── icons/                    # App icons
│
│   ├── vault.js                  # Vault file operations
│   ├── ws-bridge.js              # WebSocket bridge (ports 9710, 9711)
│   └── package.json
│
├── e2e/                          # Playwright E2E tests (~26 specs)
├── tests/smoke/                  # Playwright specs (full regression + @smoke subset)
├── design/                       # Per-task design files
├── demo-vault-v2/                # Curated local QA fixture for native/dev flows
├── scripts/                      # Build/utility scripts
│
├── package.json                  # Frontend dependencies + scripts
├── lara.yaml                     # Lara CLI locale sync configuration
├── vite.config.ts                # Vite bundler config
├── tsconfig.json                 # TypeScript config
├── playwright.config.ts          # Full Playwright regression config
├── playwright.smoke.config.ts    # Curated pre-push Playwright config
├── ui-design.pen                 # Master design file
└── docs/                         # This documentation
```

## Key Files to Know

### Fixtures

- `demo-vault-v2/` is the small checked-in QA fixture used for native/manual Artemis flows. It is intentionally curated around a handful of search, relationship, project-navigation, and attachment scenarios.
- `tests/fixtures/test-vault/` is the deterministic Playwright fixture copied into temp directories for isolated integration and smoke tests.
- `python3 scripts/generate_demo_vault.py` generates the larger synthetic vault on demand at `generated-fixtures/demo-vault-large/` for scale/performance experiments. That output is gitignored and should not bloat the normal QA fixture.

### Start here

| File | Why it matters |
|------|---------------|
| `src/App.tsx` | Root component. Shows the 4-panel layout, state flow, and how all features connect. |
| `src/types.ts` | All shared TypeScript types. Read this first to understand the data model. |
| `src/backend/client.ts` | Explicit web backend helper functions. This is the frontend-backend API surface. |
| `src/backend/client.ts` | Typed web backend client helpers and command dispatch. |

### Data layer

| File | Why it matters |
|------|---------------|
| `src/hooks/useVaultLoader.ts` | How vault data is loaded and managed through the web backend client. |
| `src/hooks/useNoteActions.ts` | Orchestrates note operations: composes `useNoteCreation`, `useNoteRename`, frontmatter CRUD, and wikilink navigation. |
| `src/hooks/useVaultSwitcher.ts` | Multi-vault management, vault switching, and persisting cloned vaults in the switcher list. |
| `src/hooks/useGettingStartedClone.ts` | Shared "Clone Getting Started Vault" action for the status bar and command palette. |
| `src/components/AddRemoteModal.tsx` | Modal UI for connecting a local-only vault to a compatible remote. |
| `src/backend/web-command-handlers.ts` | Demo data and browser fallback handlers for web testing. |

### Web Backend

| File | Why it matters |
|------|---------------|
| `src/backend/client.ts` | Typed helper functions for each supported web backend command. |
| `src/backend/vault-api.ts` | Optional `/api/vault` HTTP bridge used when a real web vault backend is available. |
| `src/backend/web-command-handlers.ts` | Browser fallback handlers and demo vault state for local development and tests. |

### Editor

| File | Why it matters |
|------|---------------|
| `src/components/Editor.tsx` | BlockNote setup, breadcrumb bar, diff/raw toggle. |
| `src/components/SingleEditorView.tsx` | Shared BlockNote shell, Artemis formatting controllers, and suggestion menus. |
| `src/components/editorSchema.tsx` | Custom wikilink inline content type definition. |
| `src/components/tolariaEditorFormatting.tsx` | Markdown-safe formatting toolbar surface for BlockNote. |
| `src/components/tolariaEditorFormattingConfig.ts` | Filters toolbar and slash-menu commands to markdown-roundtrippable actions. |
| `src/utils/wikilinks.ts` | Wikilink preprocessing pipeline (markdown ↔ BlockNote). |
| `src/components/RawEditorView.tsx` | CodeMirror 6 raw markdown editor. |


### Styling

| File | Why it matters |
|------|---------------|
| `src/index.css` | Semantic CSS custom properties for app-owned light/dark themes. |
| `src/theme.json` | Editor-specific typography theme (fonts, headings, lists, code blocks). |

### Settings & Config

| File | Why it matters |
|------|---------------|
| `src/lib/releaseChannel.ts` | Normalizes persisted updater-channel values (`stable` default, optional `alpha`). |
| `src/hooks/useVaultConfig.ts` | Per-vault local UI preferences (zoom, view mode, colors, Inbox columns, explicit organization workflow). |
| `src/hooks/useUpdater.ts` | In-app updates using the selected alpha/stable feed. |

## Architecture Patterns

### Web backend client

Data-fetching code calls explicit helpers from `src/backend/client.ts`, for example `listVault(path)`, `saveNoteContent(path, content)`, and `gitCommit(vaultPath, message)`. The client first tries the optional `/api/vault` HTTP bridge and falls back to browser demo handlers for local development and tests. Components do not import platform APIs or generic invoke bridges directly.

### Props-Down, Callbacks-Up

No global state management (no Redux, no Context). `App.tsx` owns the state and passes it down as props. Child-to-parent communication uses callback props (`onSelectNote`, etc.).

### Discriminated Unions for Selection State

```typescript
type SidebarSelection =
  | { kind: 'filter'; filter: SidebarFilter }
  | { kind: 'sectionGroup'; type: string }
  | { kind: 'folder'; path: string }
  | { kind: 'entity'; entry: VaultEntry }
  | { kind: 'view'; filename: string }
```

### Command Registry

`useCommandRegistry` + `useAppCommands` build a centralized command registry. Commands are registered with labels, shortcuts, and handlers. The `CommandPalette` (Cmd+K) fuzzy-searches this registry. Settings commands can update installation-local preferences directly when they reuse an existing settings path, such as the light/dark theme-mode actions writing `settings.theme_mode`. Shortcut combos live in `appCommandCatalog.ts`; real keypresses always flow through `useAppKeyboard`, while command-palette actions use the same command IDs through `appCommandDispatcher.ts`. Plain-text paste follows this path: the command owns `Cmd+Shift+V`, the palette exposes the same action, and `plainTextPaste.ts` resolves the active rich/raw editor target or focused text control before reading clipboard text. The same shortcut manifest also declares deterministic QA metadata for each shortcut-capable command.

Commands whose availability depends on the current note or Git state should derive from the same command registry state used by the command palette. The deleted-note restore action in Changes view is the reference example: the row opens a deleted diff preview and the command palette exposes "Restore Deleted Note" only while that preview is active.

Current-note find/replace is a surface-aware command: editor focus enables "Find in Note" / "Replace in Note" and routes Cmd+F into raw CodeMirror mode; note-list focus enables existing note-list search instead. When adding another focus-dependent command, mirror this pattern through the registry availability state.

For automated shortcut QA, use the explicit proof path from `appCommandCatalog.ts`:

- `window.__laputaTest.triggerShortcutCommand()` for deterministic renderer shortcut-event coverage


## Running Tests

```bash
# Unit tests (fast, no browser)
pnpm test

# Unit tests with coverage (must pass ≥70%)
pnpm test:coverage

# Playwright core smoke lane (requires dev server)
BASE_URL="http://localhost:5173" pnpm playwright:smoke

# Full Playwright regression suite
BASE_URL="http://localhost:5173" pnpm playwright:regression

# Single Playwright test
BASE_URL="http://localhost:5173" npx playwright test tests/smoke/<slug>.spec.ts
```

## Common Tasks

### Add a new web backend command

1. Write the Rust function in the appropriate module (`vault/`, `git/`, etc.)
2. Add a command handler in `commands/`
3. Register it in the `generate_handler![]` macro in `lib.rs`
4. Add an explicit helper in `src/backend/client.ts` and call that helper from the appropriate hook or utility
5. Add a browser fallback handler in `src/backend/web-command-handlers.ts`

### Add a new component

1. Create `src/components/MyComponent.tsx`
2. If it needs vault data, receive it as props from the parent
3. Wire it into `App.tsx` or the relevant parent component
4. Add a test file `src/components/MyComponent.test.tsx`

### Add a new entity type

1. Create a type document at the vault root: `mytype.md` with `type: Type` frontmatter (icon, color, order, etc.)
2. The sidebar section groups are auto-generated from type documents — no code change needed if `visible: true`
3. Update `CreateNoteDialog.tsx` type options if users should be able to create it from the dialog
4. Notes of this type are created at the vault root with `type: MyType` in frontmatter — no dedicated folder needed

### Add a command palette entry

1. Register the command in `useAppCommands.ts` via the command registry
2. Add a corresponding menu bar item in `menu.rs` for discoverability
3. If it has a keyboard shortcut, register it in `appCommandCatalog.ts` with the canonical command ID, modifier rule, and deterministic QA mode, then wire the matching native menu item in `menu.rs` if it should also appear in the menu bar
4. If its enabled state depends on runtime selection (active note, deleted preview, Git status, etc.), thread that flag through `useMenuEvents.ts` and `update_menu_state` so the native menu enables/disables correctly

### Modify styling

1. **Global app/theme variables**: Edit `src/index.css`
2. **Editor typography**: Edit `src/theme.json`


