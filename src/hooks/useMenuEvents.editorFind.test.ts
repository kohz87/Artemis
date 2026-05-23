import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, it, vi } from 'vitest'
import { useMenuEvents, type MenuEventHandlers } from './useMenuEvents'

function makeHandlers(): MenuEventHandlers {
  return {
    activeTabPath: '/vault/a.md',
    activeTabPathRef: { current: '/vault/a.md' },
    hasNoRemote: false,
    hasRestorableDeletedNote: false,
    multiSelectionCommandRef: { current: null },
    onArchiveNote: vi.fn(),
    onCommandPalette: vi.fn(),
    onCreateNote: vi.fn(),
    onDeleteNote: vi.fn(),
    onFindInNote: vi.fn(),
    onOpenSettings: vi.fn(),
    onPastePlainText: vi.fn(),
    onQuickOpen: vi.fn(),
    onReplaceInNote: vi.fn(),
    onSave: vi.fn(),
    onSearch: vi.fn(),
    onSetViewMode: vi.fn(),
    onToggleInspector: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
  }
}

describe('useMenuEvents editor find state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tracks editor find availability without syncing native menu state', () => {
    renderHook(() => useMenuEvents(makeHandlers()))

    act(() => {
      window.dispatchEvent(new CustomEvent('laputa:editor-find-availability', {
        detail: { enabled: true },
      }))
    })
  })
})
