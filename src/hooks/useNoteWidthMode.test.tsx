import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { NoteWidthMode, Settings, VaultEntry } from '../types'
import { useNoteWidthMode } from './useNoteWidthMode'


vi.mock('../backend/client', () => ({
  callWebBackend: vi.fn(() => Promise.reject(new Error('not available'))),
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

const baseEntry: VaultEntry = {
  path: 'Plain.md',
  filename: 'Plain.md',
  title: 'Plain',
  isA: null,
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  archived: false,
  modifiedAt: null,
  createdAt: null,
  fileSize: 0,
  snippet: '',
  wordCount: 0,
  relationships: {},
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
  outgoingLinks: [],
  properties: {},
  hasH1: false,
  fileKind: 'markdown',
}

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    auto_pull_interval_minutes: null,
    autogit_enabled: null,
    autogit_idle_threshold_seconds: null,
    autogit_inactive_threshold_seconds: null,
    auto_advance_inbox_after_organize: null,
    telemetry_consent: null,
    crash_reporting_enabled: null,
    analytics_enabled: null,
    anonymous_id: null,
    release_channel: null,
    theme_mode: null,
    ui_language: null,
    note_width_mode: null,
    note_width_overrides: null,
    hide_gitignored_files: null,
    all_notes_show_pdfs: null,
    all_notes_show_images: null,
    all_notes_show_unsupported: null,
    word_wrap_enabled: null,
    ...overrides,
  }
}

function renderWidthHook({
  entry = baseEntry,
  content = 'Body without frontmatter',
  settings = createSettings(),
  saveSettings = vi.fn(() => Promise.resolve()),
  updateFrontmatter = vi.fn(() => Promise.resolve()),
}: {
  entry?: VaultEntry
  content?: string
  settings?: Settings
  saveSettings?: (settings: Settings) => Promise<void>
  updateFrontmatter?: (path: string, key: string, value: unknown) => Promise<void>
} = {}) {
  return {
    saveSettings,
    updateFrontmatter,
    hook: renderHook(() => useNoteWidthMode({
      tabs: [{ entry, content }],
      activeTabPath: entry.path,
      settings,
      saveSettings,
      updateFrontmatter,
      setToastMessage: vi.fn(),
    })),
  }
}

describe('useNoteWidthMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses persisted note width overrides before falling back to the default width', () => {
    const settings = createSettings({
      note_width_mode: 'normal',
      note_width_overrides: { [baseEntry.path]: 'wide' },
    })

    const { hook } = renderWidthHook({ settings })

    expect(hook.result.current.noteWidth).toBe('wide')
  })

  it('persists a note width override in settings when the note cannot store frontmatter', async () => {
    const settings = createSettings({ note_width_mode: 'normal', note_width_overrides: null })
    const { hook, saveSettings, updateFrontmatter } = renderWidthHook({ settings })

    await act(async () => {
      await hook.result.current.setNoteWidth('wide' as NoteWidthMode)
    })

    expect(updateFrontmatter).not.toHaveBeenCalled()
    expect(saveSettings).toHaveBeenCalledWith({
      ...settings,
      note_width_overrides: { [baseEntry.path]: 'wide' },
    })
    expect(hook.result.current.noteWidth).toBe('wide')
  })
})
