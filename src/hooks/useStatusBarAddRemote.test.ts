import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitRemoteStatus } from '../types'
import { REQUEST_ADD_REMOTE_EVENT } from '../utils/addRemoteEvents'
import { useStatusBarAddRemote } from './useStatusBarAddRemote'

const callWebBackendMock = vi.fn()


vi.mock('../backend/client', () => ({
  callWebBackend: (...args: unknown[]) => callWebBackendMock(...args),
}))

function remoteStatus(hasRemote: boolean): GitRemoteStatus {
  return {
    branch: 'main',
    ahead: 0,
    behind: 0,
    hasRemote,
  }
}

describe('useStatusBarAddRemote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callWebBackendMock.mockResolvedValue(remoteStatus(false))
  })

  it('delegates to onAddRemote when provided', async () => {
    const onAddRemote = vi.fn()
    const { result } = renderHook(() =>
      useStatusBarAddRemote({
        vaultPath: '/vault',
        isGitVault: true,
        remoteStatus: remoteStatus(false),
        onAddRemote,
      }),
    )

    await act(async () => {
      await result.current.openAddRemote()
    })

    expect(onAddRemote).toHaveBeenCalledTimes(1)
    expect(callWebBackendMock).not.toHaveBeenCalled()
    expect(result.current.showAddRemote).toBe(false)
  })

  it('does nothing when the vault is not git-backed', async () => {
    const { result } = renderHook(() =>
      useStatusBarAddRemote({
        vaultPath: '/vault',
        isGitVault: false,
        remoteStatus: remoteStatus(false),
      }),
    )

    await act(async () => {
      await result.current.openAddRemote()
    })

    expect(result.current.showAddRemote).toBe(false)
    expect(callWebBackendMock).not.toHaveBeenCalled()
  })

  it('opens when the refreshed remote status has no remote and closes when it does', async () => {
    const { result, rerender } = renderHook(
      ({ remote }) =>
        useStatusBarAddRemote({
          vaultPath: '/vault',
          isGitVault: true,
          remoteStatus: remote,
        }),
      {
        initialProps: { remote: remoteStatus(false) },
      },
    )

    await act(async () => {
      await result.current.openAddRemote()
    })

    expect(callWebBackendMock).toHaveBeenCalledWith('git_remote_status', { vaultPath: '/vault' })
    expect(result.current.showAddRemote).toBe(true)
    expect(result.current.visibleRemoteStatus).toEqual(remoteStatus(false))

    callWebBackendMock.mockResolvedValue(remoteStatus(true))

    await act(async () => {
      await result.current.handleRemoteConnected('connected')
    })

    expect(result.current.visibleRemoteStatus).toEqual(remoteStatus(true))

    await act(async () => {
      result.current.closeAddRemote()
    })
    expect(result.current.showAddRemote).toBe(false)

    rerender({ remote: remoteStatus(false) })
    expect(result.current.visibleRemoteStatus).toEqual(remoteStatus(true))
  })

  it('opens repository settings when the latest refresh already has a remote', async () => {
    callWebBackendMock.mockResolvedValue(remoteStatus(true))

    const { result } = renderHook(() =>
      useStatusBarAddRemote({
        vaultPath: '/vault',
        isGitVault: true,
        remoteStatus: remoteStatus(false),
      }),
    )

    await act(async () => {
      await result.current.openAddRemote()
    })

    expect(result.current.showAddRemote).toBe(true)
    expect(result.current.visibleRemoteStatus).toEqual(remoteStatus(true))
  })

  it('reacts to the global add-remote request event', async () => {
    const { result } = renderHook(() =>
      useStatusBarAddRemote({
        vaultPath: '/vault',
        isGitVault: true,
        remoteStatus: remoteStatus(false),
      }),
    )

    await act(async () => {
      window.dispatchEvent(new Event(REQUEST_ADD_REMOTE_EVENT))
    })

    await waitFor(() => {
      expect(result.current.showAddRemote).toBe(true)
    })
  })
})

