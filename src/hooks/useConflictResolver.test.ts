import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConflictResolver } from './useConflictResolver'

const callWebBackendFn = vi.fn()
vi.mock('../backend/client', () => ({
  callWebBackend: (...args: unknown[]) => callWebBackendFn(...args),
}))

describe('useConflictResolver', () => {
  const onResolved = vi.fn()
  const onToast = vi.fn()
  const onOpenFile = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    callWebBackendFn.mockResolvedValue(undefined)
  })

  function renderResolver(files: string[] = ['note.md', 'plan.md']) {
    const hook = renderHook(() =>
      useConflictResolver({
        vaultPath: '/vault',
        onResolved,
        onToast,
        onOpenFile,
      }),
    )
    // Initialize files
    act(() => { hook.result.current.initFiles(files) })
    return hook
  }

  it('initializes file states from conflict files', () => {
    const { result } = renderResolver()
    expect(result.current.fileStates).toHaveLength(2)
    expect(result.current.fileStates[0]).toEqual({ file: 'note.md', resolution: null, resolving: false })
    expect(result.current.fileStates[1]).toEqual({ file: 'plan.md', resolution: null, resolving: false })
    expect(result.current.allResolved).toBe(false)
  })

  it('resolves a file with ours strategy', async () => {
    const { result } = renderResolver()

    await act(async () => {
      await result.current.resolveFile('note.md', 'ours')
    })

    expect(callWebBackendFn).toHaveBeenCalledWith('git_resolve_conflict', {
      vaultPath: '/vault', file: 'note.md', strategy: 'ours',
    })
    expect(result.current.fileStates[0].resolution).toBe('ours')
    expect(result.current.allResolved).toBe(false) // plan.md still unresolved
  })

  it('resolves a file with theirs strategy', async () => {
    const { result } = renderResolver()

    await act(async () => {
      await result.current.resolveFile('plan.md', 'theirs')
    })

    expect(callWebBackendFn).toHaveBeenCalledWith('git_resolve_conflict', {
      vaultPath: '/vault', file: 'plan.md', strategy: 'theirs',
    })
    expect(result.current.fileStates[1].resolution).toBe('theirs')
  })

  it('marks allResolved when all files are resolved', async () => {
    const { result } = renderResolver()

    await act(async () => {
      await result.current.resolveFile('note.md', 'ours')
    })
    expect(result.current.allResolved).toBe(false)

    await act(async () => {
      await result.current.resolveFile('plan.md', 'theirs')
    })
    expect(result.current.allResolved).toBe(true)
  })

  it('sets manual resolution when opening in editor', () => {
    const { result } = renderResolver()

    act(() => { result.current.openInEditor('note.md') })

    expect(onOpenFile).toHaveBeenCalledWith('note.md')
    expect(result.current.fileStates[0].resolution).toBe('manual')
  })

  it('commits resolution and calls onResolved', async () => {
    callWebBackendFn.mockImplementation((cmd: string) => {
      if (cmd === 'git_commit_conflict_resolution') return Promise.resolve('Committed')
      return Promise.resolve(undefined)
    })

    const { result } = renderResolver(['note.md'])

    await act(async () => {
      await result.current.resolveFile('note.md', 'ours')
    })

    await act(async () => {
      await result.current.commitResolution()
    })

    expect(callWebBackendFn).toHaveBeenCalledWith('git_commit_conflict_resolution', { vaultPath: '/vault' })
    expect(onResolved).toHaveBeenCalled()
    expect(onToast).toHaveBeenCalledWith('Conflicts resolved — sync resumed')
  })

  it('does not commit when not all files are resolved', async () => {
    const { result } = renderResolver()

    await act(async () => {
      await result.current.commitResolution()
    })

    expect(callWebBackendFn).not.toHaveBeenCalledWith('git_commit_conflict_resolution', expect.anything())
  })

  it('shows error when resolve fails', async () => {
    callWebBackendFn.mockRejectedValueOnce(new Error('git checkout failed'))

    const { result } = renderResolver()

    await act(async () => {
      await result.current.resolveFile('note.md', 'ours')
    })

    expect(result.current.error).toContain('Failed to resolve note.md')
    expect(result.current.fileStates[0].resolution).toBeNull()
  })

  it('shows error when commit fails', async () => {
    callWebBackendFn.mockImplementation((cmd: string) => {
      if (cmd === 'git_commit_conflict_resolution') return Promise.reject(new Error('user.email not set'))
      return Promise.resolve(undefined)
    })

    const { result } = renderResolver(['note.md'])

    await act(async () => {
      await result.current.resolveFile('note.md', 'ours')
    })
    await act(async () => {
      await result.current.commitResolution()
    })

    expect(result.current.error).toContain('Commit failed')
    expect(onResolved).not.toHaveBeenCalled()
  })

  it('resets state on initFiles', async () => {
    const { result } = renderResolver(['note.md'])

    await act(async () => {
      await result.current.resolveFile('note.md', 'ours')
    })
    expect(result.current.fileStates[0].resolution).toBe('ours')

    act(() => { result.current.initFiles(['other.md']) })

    expect(result.current.fileStates).toHaveLength(1)
    expect(result.current.fileStates[0]).toEqual({ file: 'other.md', resolution: null, resolving: false })
    expect(result.current.error).toBeNull()
  })
})

