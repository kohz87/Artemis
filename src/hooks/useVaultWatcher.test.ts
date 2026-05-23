import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  VAULT_WATCHER_DEBOUNCE_MS,
  WEB_VAULT_POLL_MS,
  changedWebVaultPaths,
  normalizeWatchPath,
  resolveChangedPath,
  useRecentVaultWrites,
  useVaultWatcher,
} from './useVaultWatcher'

async function flushWatcherDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(VAULT_WATCHER_DEBOUNCE_MS)
    await Promise.resolve()
  })
}

function mockVaultPollSnapshots(...snapshots: Array<Array<{ path: string; modifiedAt: number; fileSize: number }>>) {
  let index = 0
  const fetchMock = vi.fn(async () => {
    const snapshot = snapshots[Math.min(index, snapshots.length - 1)] ?? []
    index += 1
    return {
      ok: true,
      json: async () => snapshot,
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('watch path helpers', () => {
  it('normalizes slashes and private tmp aliases', () => {
    expect(normalizeWatchPath('/private/tmp/vault//')).toBe('/tmp/vault')
    expect(normalizeWatchPath('C:\\Users\\Luca\\Vault')).toBe('C:/Users/Luca/Vault')
  })

  it('resolves relative watcher paths against the active vault', () => {
    expect(resolveChangedPath({ path: 'notes/day.md', vaultPath: '/vault' })).toBe('/vault/notes/day.md')
    expect(resolveChangedPath({ path: '/vault/notes/day.md', vaultPath: '/vault' })).toBe('/vault/notes/day.md')
  })

  it('detects changed, added, and removed web vault entries from metadata snapshots', () => {
    expect(changedWebVaultPaths([
      { path: '/vault/a.md', modifiedAt: 1, fileSize: 10 },
      { path: '/vault/removed.md', modifiedAt: 1, fileSize: 10 },
      { path: '/vault/same.md', modifiedAt: 1, fileSize: 10 },
    ], [
      { path: '/vault/a.md', modifiedAt: 2, fileSize: 10 },
      { path: '/vault/added.md', modifiedAt: 1, fileSize: 10 },
      { path: '/vault/same.md', modifiedAt: 1, fileSize: 10 },
    ])).toEqual(['/vault/a.md', '/vault/added.md', '/vault/removed.md'])
  })
})

describe('useRecentVaultWrites', () => {
  it('filters recent app-owned writes but keeps later external changes', () => {
    let now = 1000
    const { result } = renderHook(() => useRecentVaultWrites({ vaultPath: '/vault', now: () => now }))

    act(() => {
      result.current.markInternalWrite('/vault/notes/self.md')
    })

    expect(result.current.filterExternalPaths([
      '/vault/notes/self.md',
      '/vault/notes/external.md',
    ])).toEqual(['/vault/notes/external.md'])

    now += 5000
    expect(result.current.filterExternalPaths(['/vault/notes/self.md'])).toEqual(['/vault/notes/self.md'])
  })

  it('clears recent writes when the active vault changes', () => {
    const { result, rerender } = renderHook(
      ({ vaultPath }) => useRecentVaultWrites({ vaultPath, now: () => 1000 }),
      { initialProps: { vaultPath: '/vault-a' } },
    )

    act(() => {
      result.current.markInternalWrite('/vault-a/note.md')
    })
    rerender({ vaultPath: '/vault-b' })

    expect(result.current.filterExternalPaths(['/vault-a/note.md'])).toEqual(['/vault-a/note.md'])
  })
})

describe('useVaultWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('polls the web vault API outside desktop instead of starting the native watcher', async () => {
    const fetchMock = mockVaultPollSnapshots(
      [{ path: '/vault/a.md', modifiedAt: 1, fileSize: 10 }],
      [{ path: '/vault/a.md', modifiedAt: 2, fileSize: 10 }],
    )
    const onVaultChanged = vi.fn()

    renderHook(() => useVaultWatcher({
      vaultPath: '/vault',
      onVaultChanged,
      webPollMs: WEB_VAULT_POLL_MS,
    }))

    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/vault/list?path=%2Fvault&watch=1', { cache: 'no-store' })

    await act(async () => {
      vi.advanceTimersByTime(WEB_VAULT_POLL_MS)
      await Promise.resolve()
    })
    expect(onVaultChanged).not.toHaveBeenCalled()

    await flushWatcherDebounce()
    expect(onVaultChanged).toHaveBeenCalledWith(['/vault/a.md'])
  })

})

