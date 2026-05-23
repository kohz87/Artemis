import { act, render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_VAULTS } from './hooks/useVaultSwitcher'
import type { ViewDefinition, ViewFile } from './types'

// Provide a localStorage mock that supports all methods (jsdom's may be incomplete)
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock mock-web module
const mockEntries = [
  {
    path: '/vault/project/test.md',
    filename: 'test.md',
    title: 'Test Project',
    isA: 'Project',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: 'Active',
    archived: false,
    owner: 'Luca',
    cadence: null,
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 1024,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null, sort: null,
    view: null,
    visible: true,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: true,
    fileKind: 'markdown',
  },
  {
    path: '/vault/topic/dev.md',
    filename: 'dev.md',
    title: 'Software Development',
    isA: 'Topic',
    aliases: ['Dev'],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    owner: null,
    cadence: null,
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 256,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null, sort: null,
    view: null,
    visible: true,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: true,
    fileKind: 'markdown',
  },
]

const mockAllContent: Record<string, string> = {
  '/vault/project/test.md': '---\ntitle: Test Project\nis_a: Project\n---\n\n# Test Project\n\nSome content.',
  '/vault/topic/dev.md': '---\ntitle: Software Development\nis_a: Topic\n---\n\n# Software Development\n',
}

const mockVaultList = {
  vaults: [{ label: 'Test Vault', path: '/vault' }],
  active_vault: '/vault',
  hidden_defaults: [],
}

const mockDefaultVaultPath = '/Users/mock/Documents/Getting Started'
const expectedDefaultVaultPath = DEFAULT_VAULTS[0].path || mockDefaultVaultPath

const mockCommandResults: Record<string, unknown> = {
  load_vault_list: mockVaultList,
  list_vault: mockEntries,
  list_vault_folders: [],
  list_views: [],
  get_all_content: mockAllContent,
  get_modified_files: [],
  get_note_content: mockAllContent['/vault/project/test.md'] || '',
  save_note_content: null,
  reload_vault_entry: ({ path }: { path: string }) => mockEntries.find((entry) => entry.path === path) ?? null,
  sync_vault_asset_scope_for_window: null,
  get_file_history: [],
  get_settings: { auto_pull_interval_minutes: null, telemetry_consent: true, crash_reporting_enabled: null, analytics_enabled: null, anonymous_id: null, release_channel: null },
  is_git_repo: true,
  init_git_repo: null,
  git_pull: { status: 'up_to_date', message: 'Already up to date', updatedFiles: [], conflictFiles: [] },
  save_settings: null,
  check_vault_exists: true,
  get_default_vault_path: expectedDefaultVaultPath,
  list_themes: [],
  get_vault_settings: { theme: null },
}

function buildNeighborhoodEntry({
  path,
  title,
  relatedRefs,
  outgoingLinks,
  modifiedAt,
}: {
  path: string
  title: string
  relatedRefs: string[]
  outgoingLinks: string[]
  modifiedAt: number
}) {
  return {
    path,
    filename: path.split('/').pop() ?? `${title.toLowerCase()}.md`,
    title,
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: relatedRefs,
    status: null,
    modifiedAt,
    createdAt: null,
    fileSize: 128,
    archived: false,
    snippet: '',
    wordCount: 12,
    relationships: relatedRefs.length > 0 ? { 'Related to': relatedRefs } : {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: true,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks,
    properties: {},
    hasH1: true,
    fileKind: 'markdown',
  }
}

const neighborhoodEntries = [
  buildNeighborhoodEntry({
    path: '/vault/alpha.md',
    title: 'Alpha',
    relatedRefs: ['[[Beta]]'],
    outgoingLinks: ['Beta'],
    modifiedAt: 1700000003,
  }),
  buildNeighborhoodEntry({
    path: '/vault/beta.md',
    title: 'Beta',
    relatedRefs: ['[[Gamma]]'],
    outgoingLinks: ['Gamma'],
    modifiedAt: 1700000002,
  }),
  buildNeighborhoodEntry({
    path: '/vault/gamma.md',
    title: 'Gamma',
    relatedRefs: [],
    outgoingLinks: [],
    modifiedAt: 1700000001,
  }),
]

const neighborhoodContent: Record<string, string> = {
  '/vault/alpha.md': '# Alpha\n\n[[Beta]]',
  '/vault/beta.md': '# Beta\n\n[[Gamma]]',
  '/vault/gamma.md': '# Gamma',
}

function configureNeighborhoodVault() {
  mockCommandResults.list_vault = neighborhoodEntries
  mockCommandResults.get_all_content = neighborhoodContent
  mockCommandResults.get_note_content = ({ path }: { path: string }) => neighborhoodContent[path] ?? ''
}

function configureNeighborhoodFavoritesVault() {
  mockCommandResults.list_vault = neighborhoodEntries.map((entry) =>
    entry.path === '/vault/alpha.md'
      ? { ...entry, favorite: true, favoriteIndex: 0 }
      : entry,
  )
  mockCommandResults.get_all_content = neighborhoodContent
  mockCommandResults.get_note_content = ({ path }: { path: string }) => neighborhoodContent[path] ?? ''
}

function getHeaderForNoteList(noteListContainer: HTMLElement) {
  return within(noteListContainer.parentElement as HTMLElement).getByRole('heading', { level: 3 })
}

async function clickNoteListItem(noteListContainer: HTMLElement, title: string, options?: MouseEventInit) {
  await waitFor(() => {
    expect(within(noteListContainer).getByText(title)).toBeInTheDocument()
  })
  await act(async () => {
    fireEvent.click(within(noteListContainer).getByText(title), options)
    await Promise.resolve()
  })
}

async function enterNeighborhood(noteListContainer: HTMLElement, title: string) {
  await clickNoteListItem(noteListContainer, title, { metaKey: true })
}

async function pressEscape() {
  await act(async () => {
    fireEvent.keyDown(window, { key: 'Escape' })
    await Promise.resolve()
  })
}

function resetMockCommandResults() {
  Object.assign(mockCommandResults, {
    load_vault_list: mockVaultList,
    list_vault: mockEntries,
    list_vault_folders: [],
    list_views: [],
    get_all_content: mockAllContent,
    get_modified_files: [],
    get_note_content: mockAllContent['/vault/project/test.md'] || '',
    save_note_content: null,
    reload_vault_entry: ({ path }: { path: string }) => mockEntries.find((entry) => entry.path === path) ?? null,
    sync_vault_asset_scope_for_window: null,
    get_file_history: [],
    get_settings: {
      auto_pull_interval_minutes: null,
      auto_advance_inbox_after_organize: null,
      telemetry_consent: true,
      crash_reporting_enabled: null,
      analytics_enabled: null,
      anonymous_id: null,
      release_channel: null,
    },
    is_git_repo: true,
    init_git_repo: null,
    save_settings: null,
    check_vault_exists: true,
    get_default_vault_path: expectedDefaultVaultPath,
    list_themes: [],
    get_vault_settings: { theme: null },
  })
}

function resolveMockCommandResult(cmd: string, args?: unknown) {
  const result = Reflect.get(mockCommandResults, cmd) as unknown
  return typeof result === 'function'
    ? (result as (input?: unknown) => unknown)(args)
    : result ?? null
}

vi.mock('./backend/client', () => ({
  callWebBackend: vi.fn(async (cmd: string, args?: unknown) => resolveMockCommandResult(cmd, args)),
  listVault: vi.fn(async (path: string) => resolveMockCommandResult('list_vault', { path })),
  reloadVault: vi.fn(async (path: string) => resolveMockCommandResult('reload_vault', { path })),
  listVaultFolders: vi.fn(async (path: string) => resolveMockCommandResult('list_vault_folders', { path })),
  listViews: vi.fn(async (path: string) => resolveMockCommandResult('list_views', { path })),
  checkVaultExists: vi.fn(async (path: string) => resolveMockCommandResult('check_vault_exists', { path })),
  gitCommit: vi.fn(async (vaultPath: string, message: string) => resolveMockCommandResult('git_commit', { vaultPath, message })),
  gitPush: vi.fn(async (vaultPath: string) => resolveMockCommandResult('git_push', { vaultPath })),
  addMockEntry: vi.fn(),
  updateMockContent: vi.fn(),
  trackMockChange: vi.fn(),
}))


// Mock BlockNote components (they need DOM APIs not available in jsdom)
vi.mock('@blocknote/core', () => ({
  BlockNoteSchema: { create: () => ({ extend: () => ({}) }) },
  createCodeBlockSpec: vi.fn(() => ({})),
  createExtension: (factory: unknown) => () => factory,
  defaultInlineContentSpecs: {},
  filterSuggestionItems: vi.fn(() => []),
}))

vi.mock('@blocknote/code-block', () => ({
  codeBlockOptions: {},
}))

vi.mock('@blocknote/core/extensions', () => ({
  filterSuggestionItems: vi.fn(() => []),
}))

vi.mock('@blocknote/react', () => ({
  createReactBlockSpec: () => () => ({}),
  createReactInlineContentSpec: () => ({ render: () => null }),
  BlockNoteViewRaw: ({ children, editable }: { children?: ReactNode; editable?: boolean }) => (
    <div data-testid="blocknote-view" data-editable={editable !== false ? 'true' : 'false'}>
      <div contentEditable={editable !== false} suppressContentEditableWarning data-testid="mock-editor">
        mock editor
      </div>
      {children}
    </div>
  ),
  LinkToolbar: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ComponentsContext: {
    Provider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  },
  useCreateBlockNote: () => ({
    tryParseMarkdownToBlocks: async () => [],
    replaceBlocks: () => {},
    document: [],
    insertInlineContent: () => {},
    setTextCursorPosition: () => {},
    focus: () => {},
    onMount: (cb: () => void) => { cb(); return () => {} },
  }),
  LinkToolbarController: () => null,
  EditLinkButton: () => null,
  DeleteLinkButton: () => null,
  SideMenuController: () => null,
  SuggestionMenuController: () => null,
  useComponentsContext: () => ({
    LinkToolbar: {
      Button: ({
        children,
        label,
        onClick,
      }: { children?: ReactNode; label?: string; onClick?: () => void }) => (
        <button onClick={onClick} type="button">
          {label}
          {children}
        </button>
      ),
    },
  }),
  useDictionary: () => ({
    link_toolbar: {
      open: { tooltip: 'Open in a new tab' },
    },
  }),
}))

vi.mock('@blocknote/mantine', () => ({
  components: {},
  BlockNoteView: ({ children }: { children?: React.ReactNode }) => <div data-testid="blocknote-view">{children}</div>,
}))

vi.mock('@blocknote/mantine/style.css', () => ({}))

vi.mock('./components/tolariaEditorFormatting', () => ({
  TolariaFormattingToolbar: () => null,
  TolariaFormattingToolbarController: () => null,
}))

import App from './App'
import { TooltipProvider } from '@/components/ui/tooltip'

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: TooltipProvider })
}

const SLOW_APP_READY_TIMEOUT_MS = 10_000

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockCommandResults()
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('renders the four-panel layout', async () => {
    render(<App />)
    expect(await screen.findByText('All Notes', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('creates custom views with a portable fallback filename for symbol-only names', async () => {
    const savedViews: ViewFile[] = []
    const saveView = vi.fn(({ filename, definition }: { filename: string; definition: ViewDefinition }) => {
      if (filename === '.yml') throw new Error('Invalid view filename')
      savedViews.push({ filename, definition })
      return null
    })
    mockCommandResults.save_view_cmd = saveView
    mockCommandResults.list_views = () => savedViews
    mockCommandResults.reload_vault = mockEntries

    render(<App />)

    await screen.findByText('All Notes')
    fireEvent.click(screen.getByRole('button', { name: 'Create view' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByPlaceholderText(/Active Projects|Reading List/i), {
      target: { value: '🚀' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(saveView).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'view.yml',
        definition: expect.objectContaining({ name: '🚀' }),
      }))
    })
  }, 10000)

  it('loads and displays vault entries in sidebar', async () => {
    render(<App />)
    await waitFor(() => {
      // Entries appear in both Sidebar and NoteList
      expect(screen.getAllByText('Test Project').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Software Development').length).toBeGreaterThan(0)
    })
  })

  it('keeps the app shell usable while the vault note scan is pending', async () => {
    let resolveListVault: ((value: typeof mockEntries) => void) | null = null
    const listVaultPromise = new Promise<typeof mockEntries>((resolve) => {
      resolveListVault = resolve
    })
    mockCommandResults.list_vault = () => listVaultPromise

    render(<App />)

    expect(await screen.findByTestId('sidebar-loading-favorites', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByTestId('vault-loading-skeleton')).not.toBeInTheDocument()
    expect(screen.getByTestId('sidebar-top-nav')).toHaveTextContent('Inbox')
    expect(screen.getByTestId('sidebar-loading-views')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-loading-types')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-loading-folders')).toBeInTheDocument()
    expect(screen.getByTestId('note-list-loading-skeleton')).toBeInTheDocument()
    expect(screen.getByTestId('breadcrumb-title-skeleton')).toBeInTheDocument()
    expect(screen.getByTestId('editor-content-skeleton')).toBeInTheDocument()
    expect(screen.queryByText('Select a note to start editing')).not.toBeInTheDocument()
    expect(screen.getByTestId('status-vault-reloading')).toHaveAccessibleName('Reloading vault from disk')
    await act(async () => {
      fireEvent.keyDown(window, { key: 'p', code: 'KeyP', metaKey: true })
      await Promise.resolve()
    })
    expect(within(screen.getByTestId('quick-open-palette')).getByText('Reloading vault...')).toBeInTheDocument()

    await act(async () => {
      resolveListVault?.(mockEntries)
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.queryByTestId('vault-loading-skeleton')).not.toBeInTheDocument()
      expect(screen.queryByTestId('note-list-loading-skeleton')).not.toBeInTheDocument()
      expect(screen.queryByTestId('breadcrumb-title-skeleton')).not.toBeInTheDocument()
      expect(screen.queryByTestId('editor-content-skeleton')).not.toBeInTheDocument()
      expect(screen.queryByTestId('status-vault-reloading')).not.toBeInTheDocument()
      expect(screen.getAllByText('Test Project').length).toBeGreaterThan(0)
    })
  })

  it('shows empty state in editor when no note is selected', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Select a note to start editing')).toBeInTheDocument()
    })
  })

  it('keeps the empty editor state uncluttered', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Select a note to start editing')).toBeInTheDocument()
      expect(screen.queryByText(/to search/)).not.toBeInTheDocument()
    })
  })

  it('registers keyboard shortcuts without error', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('All Notes')).toBeInTheDocument()
    })

    // Cmd+S with no pending changes shows "Nothing to save"
    fireEvent.keyDown(window, { key: 's', metaKey: true })
    await waitFor(() => {
      expect(screen.getByText('Nothing to save')).toBeInTheDocument()
    })
  })
  it('opens the default vault after telemetry consent when no active vault is configured', async () => {
    mockCommandResults.get_settings = {
      auto_pull_interval_minutes: null,
      telemetry_consent: null,
      crash_reporting_enabled: null,
      analytics_enabled: null,
      anonymous_id: null,
      release_channel: null,
    }
    mockCommandResults.load_vault_list = { vaults: [], active_vault: null, hidden_defaults: [] }
    mockCommandResults.check_vault_exists = (args?: { path?: string }) => args?.path === expectedDefaultVaultPath

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Help improve Artemis')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('telemetry-accept'))

    await waitFor(() => {
      expect(screen.getByTestId('status-vault-trigger')).toHaveTextContent('Getting Started')
    })
    expect(screen.queryByTestId('welcome-screen')).not.toBeInTheDocument()
  })

  it.each([
    ['telemetry-accept', 'Allow anonymous reporting'],
    ['telemetry-decline', 'No thanks'],
  ])('opens a remembered default vault after %s even when onboarding was never completed', async (buttonTestId) => {
    const rememberedDefaultVaultPath = expectedDefaultVaultPath
    localStorage.setItem('tolaria_welcome_dismissed', '1')
    mockCommandResults.get_default_vault_path = rememberedDefaultVaultPath
    mockCommandResults.get_settings = {
      auto_pull_interval_minutes: null,
      telemetry_consent: null,
      crash_reporting_enabled: null,
      analytics_enabled: null,
      anonymous_id: null,
      release_channel: null,
    }
    mockCommandResults.load_vault_list = {
      vaults: [],
      active_vault: rememberedDefaultVaultPath,
      hidden_defaults: [],
    }
    mockCommandResults.check_vault_exists = (args?: { path?: string }) => args?.path === rememberedDefaultVaultPath

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Help improve Artemis')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId(buttonTestId))

    await waitFor(() => {
      expect(screen.getByTestId('status-vault-trigger')).toHaveTextContent('Getting Started')
    })
    expect(screen.queryByTestId('welcome-screen')).not.toBeInTheDocument()
  })

  it('uses the app shell loading state while the last vault is still resolving', async () => {
    localStorage.setItem('tolaria_welcome_dismissed', '1')

    let resolveVaultList: ((value: typeof mockVaultList) => void) | null = null

    mockCommandResults.load_vault_list = () =>
      new Promise<typeof mockVaultList>((resolve) => {
        resolveVaultList = resolve
      })
    mockCommandResults.check_vault_exists = (args?: { path?: string }) => args?.path === '/work'

    render(<App />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.queryByTestId('vault-loading-skeleton')).not.toBeInTheDocument()
    expect(screen.getByTestId('sidebar-loading-favorites')).toBeInTheDocument()
    expect(screen.getByTestId('note-list-loading-skeleton')).toBeInTheDocument()
    expect(screen.getByTestId('breadcrumb-title-skeleton')).toBeInTheDocument()
    expect(screen.getByTestId('editor-content-skeleton')).toBeInTheDocument()
    expect(screen.getByTestId('status-vault-reloading')).toHaveAccessibleName('Reloading vault from disk')
    expect(screen.queryByText('Vault not found')).not.toBeInTheDocument()

    await act(async () => {
      resolveVaultList?.({
        vaults: [{ label: 'Work Vault', path: '/work' }],
        active_vault: '/work',
        hidden_defaults: [],
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByTestId('status-vault-trigger')).toHaveTextContent('Work Vault')
    })
    expect(screen.queryByText('Vault not found')).not.toBeInTheDocument()
  })

  it('shows the missing-vault screen once the resolved active vault is confirmed missing', async () => {
    localStorage.setItem('tolaria_welcome_dismissed', '1')
    mockCommandResults.load_vault_list = {
      vaults: [{ label: 'Old Vault', path: '/missing-vault' }],
      active_vault: '/missing-vault',
      hidden_defaults: [],
    }
    mockCommandResults.check_vault_exists = (args?: { path?: string }) => args?.path === expectedDefaultVaultPath

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Vault not found')).toBeInTheDocument()
    })
    expect(screen.getByTestId('welcome-open-folder')).toHaveTextContent('Choose a different folder')
  })

  it('shows default vault instead of vault-missing when no active vault was persisted', async () => {
    localStorage.setItem('tolaria_welcome_dismissed', '1')
    mockCommandResults.load_vault_list = {
      vaults: [],
      active_vault: null,
      hidden_defaults: [],
    }
    mockCommandResults.check_vault_exists = (args?: { path?: string }) => args?.path === expectedDefaultVaultPath

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('status-vault-trigger')).toHaveTextContent('Getting Started')
    })
    expect(screen.queryByText('Vault not found')).not.toBeInTheDocument()
    expect(screen.queryByText('Welcome to Artemis')).not.toBeInTheDocument()
  })

  it('persists and opens an existing vault chosen from onboarding', async () => {
    const selectedVaultPath = '/Users/mock/Documents/Work Vault'
    const selectedVaultUrl = 'file:///Users/mock/Documents/Work%20Vault'
    const saveVaultList = vi.fn()
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(selectedVaultUrl)

    mockCommandResults.load_vault_list = { vaults: [], active_vault: null, hidden_defaults: [] }
    mockCommandResults.check_vault_exists = (args?: { path?: string }) => args?.path === selectedVaultPath
    mockCommandResults.save_vault_list = (args?: {
      list?: { vaults?: Array<{ label: string; path: string }>; active_vault?: string | null }
    }) => {
      saveVaultList(args)
      return null
    }

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('welcome-screen')).toBeInTheDocument()
    }, { timeout: SLOW_APP_READY_TIMEOUT_MS })

    fireEvent.click(screen.getByTestId('welcome-open-folder'))

    await waitFor(() => {
      expect(saveVaultList).toHaveBeenCalledWith({
        list: {
          vaults: [{ label: 'Work Vault', path: selectedVaultPath }],
          active_vault: selectedVaultPath,
          hidden_defaults: [],
        },
      })
    })
    expect(saveVaultList).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByTestId('status-vault-trigger')).toHaveTextContent('Work Vault')
    })

    promptSpy.mockRestore()
  })

  it('persists and opens the onboarding template vault after cloning', async () => {
    let templateExists = false
    const saveVaultList = vi.fn()
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('file:///Users/mock/Documents')
    const expectedLabel = 'Getting Started'

    mockCommandResults.load_vault_list = { vaults: [], active_vault: null, hidden_defaults: [] }
    mockCommandResults.check_vault_exists = (args?: { path?: string }) => {
      if (args?.path === expectedDefaultVaultPath) {
        return templateExists
      }
      return false
    }
    mockCommandResults.create_getting_started_vault = () => {
      templateExists = true
      return expectedDefaultVaultPath
    }
    mockCommandResults.save_vault_list = (args?: {
      list?: { vaults?: Array<{ label: string; path: string }>; active_vault?: string | null }
    }) => {
      saveVaultList(args)
      return null
    }

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('welcome-screen')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('welcome-create-vault'))

    await waitFor(() => {
      expect(saveVaultList).toHaveBeenCalledWith({
        list: {
          vaults: [],
          active_vault: expectedDefaultVaultPath,
          hidden_defaults: [],
        },
      })
    })
    expect(saveVaultList).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByTestId('status-vault-trigger')).toHaveTextContent(expectedLabel)
    })

    promptSpy.mockRestore()
  })

  it('renders sidebar with correct default selection (All Notes)', async () => {
    render(<App />)
    await waitFor(() => {
      // "All Notes" should be rendered as the selected nav item
      expect(screen.getByText('All Notes')).toBeInTheDocument()
      expect(screen.getByText('Archive')).toBeInTheDocument()
    })
  })

  it('pressing Escape in Neighborhood mode blurs the editor before unwinding note-list history', async () => {
    configureNeighborhoodVault()

    render(<App />)

    const noteListContainer = await screen.findByTestId('note-list-container', {}, { timeout: 5000 })
    const getHeader = () => getHeaderForNoteList(noteListContainer)

    await waitFor(() => {
      expect(getHeader()).toHaveTextContent('Inbox')
    })

    await enterNeighborhood(noteListContainer, 'Alpha')

    await waitFor(() => {
      expect(getHeader()).toHaveTextContent('Alpha')
    })

    const editor = screen.getByTestId('mock-editor')
    editor.focus()
    expect(editor).toHaveFocus()

    await pressEscape()

    await waitFor(() => {
      expect(noteListContainer).toHaveFocus()
      expect(getHeader()).toHaveTextContent('Alpha')
    })

    await enterNeighborhood(noteListContainer, 'Beta')

    await waitFor(() => {
      expect(getHeader()).toHaveTextContent('Beta')
    })

    await pressEscape()

    await waitFor(() => {
      expect(getHeader()).toHaveTextContent('Alpha')
    })

    await pressEscape()

    await waitFor(() => {
      expect(getHeader()).toHaveTextContent('Inbox')
    })
  }, 10_000)

  it('opens favorites directly into Neighborhood mode', async () => {
    configureNeighborhoodFavoritesVault()

    render(<App />)

    let favoritesSection: HTMLElement | undefined
    await waitFor(() => {
      const sidebar = screen.getByText('FAVORITES')
      const currentFavoritesSection = sidebar.closest('div')?.parentElement as HTMLElement
      expect(within(currentFavoritesSection).getByText('Alpha')).toBeInTheDocument()
      favoritesSection = currentFavoritesSection
    })
    fireEvent.click(within(favoritesSection!).getByText('Alpha'))

    const noteListContainer = await screen.findByTestId('note-list-container')
    await waitFor(() => {
      expect(getHeaderForNoteList(noteListContainer)).toHaveTextContent('Alpha')
    })

    expect(screen.getByText('Related to')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('defaults to All Notes when explicit organization is disabled in vault config', async () => {
    const workVaultPath = '/Users/mock/Documents/Work'
    mockCommandResults.load_vault_list = {
      vaults: [{ label: 'Work Vault', path: workVaultPath }],
      active_vault: workVaultPath,
      hidden_defaults: [],
    }
    const disabledWorkflowConfig = JSON.stringify({
      zoom: null,
      view_mode: null,
      editor_mode: null,
      tag_colors: null,
      status_colors: null,
      property_display_modes: null,
      inbox: { noteListProperties: null, explicitOrganization: false },
    })
    localStorage.setItem(`laputa:vault-config:${workVaultPath}`, disabledWorkflowConfig)

    render(<App />)

    await waitFor(() => {
      expect(within(screen.getByTestId('sidebar-top-nav')).queryByText('Inbox')).not.toBeInTheDocument()
      expect(screen.getByText('All Notes')).toBeInTheDocument()
    })
  })

  it('auto-advances to the next inbox item after organizing when the setting is enabled', async () => {
    configureNeighborhoodVault()
    mockCommandResults.get_settings = {
      auto_pull_interval_minutes: null,
      auto_advance_inbox_after_organize: true,
      telemetry_consent: true,
      crash_reporting_enabled: null,
      analytics_enabled: null,
      anonymous_id: null,
      release_channel: null,
    }

    render(<App />)

    const noteListContainer = await screen.findByTestId('note-list-container')
    await waitFor(() => {
      expect(getHeaderForNoteList(noteListContainer)).toHaveTextContent('Inbox')
    })

    await clickNoteListItem(noteListContainer, 'Alpha')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Set note as organized' })).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set note as organized' }))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(window.__laputaTest?.activeTabPath).toBe('/vault/beta.md')
    })
  }, 10_000)

  it('keeps the manually selected note after organizing finishes later', async () => {
    configureNeighborhoodVault()
    mockCommandResults.get_settings = {
      auto_pull_interval_minutes: null,
      auto_advance_inbox_after_organize: true,
      telemetry_consent: true,
      crash_reporting_enabled: null,
      analytics_enabled: null,
      anonymous_id: null,
      release_channel: null,
    }

    let resolveOrganizeSave!: () => void
    const organizeSave = new Promise<void>((resolve) => {
      resolveOrganizeSave = resolve
    })
    mockCommandResults.save_note_content = vi.fn(() => organizeSave)

    render(<App />)

    const noteListContainer = await screen.findByTestId('note-list-container')
    await waitFor(() => {
      expect(getHeaderForNoteList(noteListContainer)).toHaveTextContent('Inbox')
    })

    await clickNoteListItem(noteListContainer, 'Alpha')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Set note as organized' })).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set note as organized' }))
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(within(noteListContainer).getByText('Gamma'))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(window.__laputaTest?.activeTabPath).toBe('/vault/gamma.md')
    })

    await act(async () => {
      resolveOrganizeSave()
      await organizeSave
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(window.__laputaTest?.activeTabPath).toBe('/vault/gamma.md')
  }, 10_000)

  it('renders status bar', async () => {
    render(<App />)
    // StatusBar should be present
    await waitFor(() => {
      expect(screen.getByText('All Notes')).toBeInTheDocument()
    })
    // The status bar element should exist in the DOM
    const appShell = document.querySelector('.app-shell')
    expect(appShell).toBeInTheDocument()
  })

  it('switches vaults from the bottom bar after onboarding is ready', async () => {
    mockCommandResults.load_vault_list = {
      vaults: [
        { label: 'Test Vault', path: '/work' },
        { label: 'Work Vault', path: '/vault-2' },
      ],
      active_vault: '/work',
      hidden_defaults: [],
    }

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('status-vault-trigger')).toHaveTextContent('Test Vault')
    })

    fireEvent.click(screen.getByTestId('status-vault-trigger'))
    fireEvent.click(screen.getByTestId('vault-menu-item-Work Vault'))

    await waitFor(() => {
      expect(screen.getByTestId('status-vault-trigger')).toHaveTextContent('Work Vault')
    })
  })

  it('clears the Git setup dialog when switching to a Git-enabled vault', async () => {
    mockCommandResults.load_vault_list = {
      vaults: [
        { label: 'Missing Git', path: '/work' },
        { label: 'Git Vault', path: '/vault-2' },
      ],
      active_vault: '/work',
      hidden_defaults: [],
    }
    mockCommandResults.is_git_repo = ({ vaultPath }: { vaultPath?: string } = {}) => vaultPath === '/vault-2'

    render(<App />)

    expect(await screen.findByText('Enable Git for this vault?')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('status-vault-trigger'))
    fireEvent.click(screen.getByTestId('vault-menu-item-Git Vault'))

    await waitFor(() => {
      expect(screen.getByTestId('status-vault-trigger')).toHaveTextContent('Git Vault')
    })
    await waitFor(() => {
      expect(screen.queryByText('Enable Git for this vault?')).not.toBeInTheDocument()
    })
  })

  it('Cmd+1 hides sidebar and note list (editor-only mode)', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('All Notes')).toBeInTheDocument()
    })

    // All panels visible by default
    expect(document.querySelector('.app__sidebar')).toBeInTheDocument()
    expect(document.querySelector('.app__note-list')).toBeInTheDocument()

    // Cmd+1 → editor-only
    fireEvent.keyDown(window, { key: '1', metaKey: true })
    await waitFor(() => {
      expect(document.querySelector('.app__sidebar')).not.toBeInTheDocument()
      expect(document.querySelector('.app__note-list')).not.toBeInTheDocument()
    })
  })

  it('Cmd+2 shows editor + note list (sidebar hidden)', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('All Notes')).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: '2', metaKey: true })
    await waitFor(() => {
      expect(document.querySelector('.app__sidebar')).not.toBeInTheDocument()
      expect(document.querySelector('.app__note-list')).toBeInTheDocument()
    })
  })

  it('Cmd+3 restores all panels after Cmd+1', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('All Notes')).toBeInTheDocument()
    })

    // Switch to editor-only first
    fireEvent.keyDown(window, { key: '1', metaKey: true })
    await waitFor(() => {
      expect(document.querySelector('.app__sidebar')).not.toBeInTheDocument()
    })

    // Cmd+3 → all panels
    fireEvent.keyDown(window, { key: '3', metaKey: true })
    await waitFor(() => {
      expect(document.querySelector('.app__sidebar')).toBeInTheDocument()
      expect(document.querySelector('.app__note-list')).toBeInTheDocument()
    })
  })

})

