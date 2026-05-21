import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NOTE_TARGET_FOLDER_STORAGE_PREFIX,
  resolveNoteTargetFolder,
  useNoteTargetFolder,
} from './useNoteTargetFolder'
import type { SidebarSelection } from '../types'

const vaultPath = '/wiki'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('resolveNoteTargetFolder', () => {
  it('uses the selected vault-relative folder and persists it for next session', () => {
    const selection: SidebarSelection = { kind: 'folder', path: 'projects/realmforge' }

    expect(resolveNoteTargetFolder({ selection, vaultPath, storedFolderPath: 'archive' })).toEqual({
      folderPath: 'projects/realmforge',
      shouldPersist: true,
    })
  })

  it('converts an absolute selected folder under the vault into a vault-relative folder', () => {
    const selection: SidebarSelection = { kind: 'folder', path: '/wiki/archive/2026-05' }

    expect(resolveNoteTargetFolder({ selection, vaultPath, storedFolderPath: null })).toEqual({
      folderPath: 'archive/2026-05',
      shouldPersist: true,
    })
  })

  it('falls back to the last stored folder when the current selection is not a folder', () => {
    const selection: SidebarSelection = { kind: 'filter', filter: 'inbox' }

    expect(resolveNoteTargetFolder({ selection, vaultPath, storedFolderPath: 'projects/test' })).toEqual({
      folderPath: 'projects/test',
      shouldPersist: false,
    })
  })

  it('rejects traversal attempts instead of routing new notes outside the vault', () => {
    const selection: SidebarSelection = { kind: 'folder', path: '../outside' }

    expect(resolveNoteTargetFolder({ selection, vaultPath, storedFolderPath: 'archive' })).toEqual({
      folderPath: 'archive',
      shouldPersist: false,
    })
  })

  it('treats the vault root selection as the root default and clears persistence', () => {
    const selection: SidebarSelection = { kind: 'folder', path: '', rootPath: vaultPath }

    expect(resolveNoteTargetFolder({ selection, vaultPath, storedFolderPath: 'archive' })).toEqual({
      folderPath: null,
      shouldPersist: true,
    })
  })
})

describe('useNoteTargetFolder', () => {
  it('persists the selected folder per vault and restores it for a later non-folder selection', () => {
    const { result, rerender } = renderHook(
      ({ selection }) => useNoteTargetFolder({ selection, vaultPath }),
      { initialProps: { selection: { kind: 'folder', path: 'projects/test' } as SidebarSelection } },
    )

    expect(result.current).toBe('projects/test')
    expect(localStorage.getItem(`${NOTE_TARGET_FOLDER_STORAGE_PREFIX}${vaultPath}`)).toBe('projects/test')

    act(() => {
      rerender({ selection: { kind: 'filter', filter: 'inbox' } })
    })

    expect(result.current).toBe('projects/test')
  })

  it('clears the stored preference when the vault root is selected', () => {
    localStorage.setItem(`${NOTE_TARGET_FOLDER_STORAGE_PREFIX}${vaultPath}`, 'archive')

    const { result } = renderHook(() => useNoteTargetFolder({
      selection: { kind: 'folder', path: '', rootPath: vaultPath },
      vaultPath,
    }))

    expect(result.current).toBeNull()
    expect(localStorage.getItem(`${NOTE_TARGET_FOLDER_STORAGE_PREFIX}${vaultPath}`)).toBeNull()
  })
})
