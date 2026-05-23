import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCommitFlow } from './useCommitFlow'

const callWebBackendFn = vi.fn()
const mockTrackEvent = vi.fn()


vi.mock('../backend/client', () => ({
  callWebBackend: (command: string, args: Record<string, unknown>) => callWebBackendFn(command, args),
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: (event: string, properties?: Record<string, unknown>) => mockTrackEvent(event, properties),
}))

describe('useCommitFlow', () => {
  let savePending: vi.Mock
  let loadModifiedFiles: vi.Mock
  let resolveRemoteStatus: vi.Mock
  let setToastMessage: vi.Mock
  let onPushRejected: vi.Mock

  beforeEach(() => {
    savePending = vi.fn().mockResolvedValue(undefined)
    loadModifiedFiles = vi.fn().mockResolvedValue(undefined)
    resolveRemoteStatus = vi.fn().mockResolvedValue({ branch: 'main', ahead: 0, behind: 0, hasRemote: true })
    setToastMessage = vi.fn()
    onPushRejected = vi.fn()
    mockTrackEvent.mockReset()
    callWebBackendFn.mockReset()
    callWebBackendFn.mockImplementation((command: string) => {
      if (command === 'git_commit') return Promise.resolve('[main abc1234] test commit')
      if (command === 'git_push') return Promise.resolve({ status: 'ok', message: 'Pushed to remote' })
      if (command === 'get_modified_files') return Promise.resolve([{ path: '/vault/a.md', relativePath: 'a.md', status: 'modified' }])
      throw new Error(`Unexpected command: ${command}`)
    })
  })

  function renderCommitFlow() {
    return renderHook(() => useCommitFlow({
      savePending,
      loadModifiedFiles,
      resolveRemoteStatus,
      setToastMessage,
      onPushRejected,
      vaultPath: '/vault',
    }))
  }

  it('openCommitDialog saves pending, refreshes files, and sets local mode when no remote exists', async () => {
    resolveRemoteStatus.mockResolvedValueOnce({ branch: 'main', ahead: 0, behind: 0, hasRemote: false })
    const { result } = renderCommitFlow()

    await act(async () => {
      await result.current.openCommitDialog()
    })

    expect(savePending).toHaveBeenCalledTimes(1)
    expect(loadModifiedFiles).toHaveBeenCalledTimes(1)
    expect(resolveRemoteStatus).toHaveBeenCalledTimes(1)
    expect(result.current.showCommitDialog).toBe(true)
    expect(result.current.commitMode).toBe('local')
  })

  it('handleCommitPush commits and pushes when a remote is configured', async () => {
    const { result } = renderCommitFlow()

    await act(async () => {
      await result.current.handleCommitPush('test message')
    })

    expect(savePending).toHaveBeenCalled()
    expect(callWebBackendFn).toHaveBeenNthCalledWith(1, 'git_commit', { vaultPath: '/vault', message: 'test message' })
    expect(callWebBackendFn).toHaveBeenNthCalledWith(2, 'git_push', { vaultPath: '/vault' })
    expect(setToastMessage).toHaveBeenCalledWith('Committed and pushed')
    expect(loadModifiedFiles).toHaveBeenCalled()
    expect(resolveRemoteStatus).toHaveBeenCalledTimes(2)
    expect(mockTrackEvent).toHaveBeenCalledWith('commit_made', undefined)
    expect(result.current.showCommitDialog).toBe(false)
  })

  it('runAutomaticCheckpoint saves pending first and uses the deterministic automatic message', async () => {
    const { result } = renderCommitFlow()

    await act(async () => {
      await result.current.runAutomaticCheckpoint({ savePendingBeforeCommit: true })
    })

    expect(savePending).toHaveBeenCalledTimes(1)
    expect(callWebBackendFn).toHaveBeenNthCalledWith(1, 'get_modified_files', { vaultPath: '/vault' })
    expect(callWebBackendFn).toHaveBeenNthCalledWith(2, 'git_commit', { vaultPath: '/vault', message: 'Updated 1 note' })
    expect(callWebBackendFn).toHaveBeenNthCalledWith(3, 'git_push', { vaultPath: '/vault' })
    expect(setToastMessage).toHaveBeenCalledWith('Committed and pushed')
  })

  it('runAutomaticCheckpoint retries push-only when local commits are already ahead', async () => {
    resolveRemoteStatus.mockResolvedValue({ branch: 'main', ahead: 2, behind: 0, hasRemote: true })
    callWebBackendFn.mockImplementation((command: string) => {
      if (command === 'get_modified_files') return Promise.resolve([])
      if (command === 'git_push') return Promise.resolve({ status: 'ok', message: 'Pushed to remote' })
      throw new Error(`Unexpected command: ${command}`)
    })

    const { result } = renderCommitFlow()

    await act(async () => {
      await result.current.runAutomaticCheckpoint()
    })

    expect(callWebBackendFn).toHaveBeenCalledTimes(2)
    expect(callWebBackendFn).toHaveBeenNthCalledWith(1, 'get_modified_files', { vaultPath: '/vault' })
    expect(callWebBackendFn).toHaveBeenNthCalledWith(2, 'git_push', { vaultPath: '/vault' })
    expect(setToastMessage).toHaveBeenCalledWith('Pushed committed changes')
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })

  it('runAutomaticCheckpoint reports when there is nothing to commit or push', async () => {
    callWebBackendFn.mockImplementation((command: string) => {
      if (command === 'get_modified_files') return Promise.resolve([])
      throw new Error(`Unexpected command: ${command}`)
    })

    const { result } = renderCommitFlow()

    await act(async () => {
      await result.current.runAutomaticCheckpoint()
    })

    expect(setToastMessage).toHaveBeenCalledWith('Nothing to commit or push')
    expect(mockTrackEvent).not.toHaveBeenCalled()
  })

  it('handleCommitPush commits locally and skips push when no remote is configured', async () => {
    resolveRemoteStatus.mockResolvedValue({ branch: 'main', ahead: 0, behind: 0, hasRemote: false })
    callWebBackendFn.mockImplementation((command: string) => {
      if (command === 'git_commit') return Promise.resolve('[main abc1234] test message')
      throw new Error(`Unexpected command: ${command}`)
    })
    const { result } = renderCommitFlow()

    await act(async () => {
      await result.current.handleCommitPush('test message')
    })

    expect(callWebBackendFn).toHaveBeenCalledTimes(1)
    expect(callWebBackendFn).toHaveBeenCalledWith('git_commit', { vaultPath: '/vault', message: 'test message' })
    expect(setToastMessage).toHaveBeenCalledWith('Committed locally (no remote configured)')
    expect(onPushRejected).not.toHaveBeenCalled()
  })

  it('handleCommitPush calls onPushRejected when push is rejected', async () => {
    callWebBackendFn.mockImplementation((command: string) => {
      if (command === 'git_commit') return Promise.resolve('[main abc1234] test message')
      if (command === 'git_push') return Promise.resolve({ status: 'rejected', message: 'Push rejected' })
      throw new Error(`Unexpected command: ${command}`)
    })
    const { result } = renderCommitFlow()

    await act(async () => {
      await result.current.handleCommitPush('test message')
    })

    expect(onPushRejected).toHaveBeenCalledTimes(1)
    expect(setToastMessage).toHaveBeenCalledWith(expect.stringContaining('push rejected'))
  })

  it('handleCommitPush shows error toast on failure', async () => {
    callWebBackendFn.mockImplementation(() => Promise.reject(new Error('push failed')))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderCommitFlow()

    await act(async () => {
      await result.current.handleCommitPush('test')
    })

    expect(setToastMessage).toHaveBeenCalledWith('Commit failed: push failed')
    consoleSpy.mockRestore()
  })

  it('closeCommitDialog closes the dialog', async () => {
    const { result } = renderCommitFlow()

    await act(async () => {
      await result.current.openCommitDialog()
    })
    expect(result.current.showCommitDialog).toBe(true)

    act(() => {
      result.current.closeCommitDialog()
    })
    expect(result.current.showCommitDialog).toBe(false)
  })
})

