import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dispatchMenuEvent, useMenuEvents, type MenuEventHandlers } from './useMenuEvents'

function makeHandlers(): MenuEventHandlers {
  return {
    onSetViewMode: vi.fn(),
    onCreateNote: vi.fn(),
    onCreateType: vi.fn(),
    onQuickOpen: vi.fn(),
    onSave: vi.fn(),
    onOpenSettings: vi.fn(),
    onToggleInspector: vi.fn(),
    onCommandPalette: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onToggleOrganized: vi.fn(),
    onArchiveNote: vi.fn(),
    onDeleteNote: vi.fn(),
    onSearch: vi.fn(),
    onToggleRawEditor: vi.fn(),
    onToggleDiff: vi.fn(),
    onPastePlainText: vi.fn(),
    onGoBack: vi.fn(),
    onGoForward: vi.fn(),
    onSelectFilter: vi.fn(),
    onOpenVault: vi.fn(),
    onRemoveActiveVault: vi.fn(),
    onRestoreGettingStarted: vi.fn(),
    onAddRemote: vi.fn(),
    onCommitPush: vi.fn(),
    onPull: vi.fn(),
    onResolveConflicts: vi.fn(),
    onViewChanges: vi.fn(),
    onReloadVault: vi.fn(),
    onOpenInNewWindow: vi.fn(),
    onRestoreDeletedNote: vi.fn(),
    activeTabPathRef: { current: '/vault/test.md' } as React.MutableRefObject<string | null>,
    multiSelectionCommandRef: { current: null },
    activeTabPath: '/vault/test.md',
    hasRestorableDeletedNote: false,
    hasNoRemote: false,
  }
}

describe('useMenuEvents note-list search bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches the note-list search toggle event for the menu item', () => {
    const listener = vi.fn()
    window.addEventListener('laputa:toggle-note-list-search', listener)

    dispatchMenuEvent('edit-toggle-note-list-search', makeHandlers())

    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener('laputa:toggle-note-list-search', listener)
  })

  it('accepts note-list search availability events without native menu sync', () => {
    renderHook(() => useMenuEvents(makeHandlers()))

    act(() => {
      window.dispatchEvent(new CustomEvent('laputa:note-list-search-availability', {
        detail: { enabled: true },
      }))
    })
  })
})
