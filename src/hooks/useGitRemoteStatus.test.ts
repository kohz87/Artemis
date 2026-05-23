import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useGitRemoteStatus } from './useGitRemoteStatus'

const callWebBackendFn = vi.fn()


vi.mock('../backend/client', () => ({
  callWebBackend: (command: string, args: Record<string, unknown>) => callWebBackendFn(command, args),
}))

describe('useGitRemoteStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads remote status on mount', async () => {
    callWebBackendFn.mockResolvedValue({ branch: 'main', ahead: 0, behind: 0, hasRemote: false })

    const { result } = renderHook(() => useGitRemoteStatus('/vault'))

    await waitFor(() => {
      expect(result.current.remoteStatus).toEqual({ branch: 'main', ahead: 0, behind: 0, hasRemote: false })
    })
    expect(callWebBackendFn).toHaveBeenCalledWith('git_remote_status', { vaultPath: '/vault' })
  })

  it('refreshRemoteStatus updates the current remote state', async () => {
    callWebBackendFn
      .mockResolvedValueOnce({ branch: 'main', ahead: 0, behind: 0, hasRemote: true })
      .mockResolvedValueOnce({ branch: 'main', ahead: 1, behind: 0, hasRemote: false })

    const { result } = renderHook(() => useGitRemoteStatus('/vault'))

    await waitFor(() => {
      expect(result.current.remoteStatus?.hasRemote).toBe(true)
    })

    await act(async () => {
      await result.current.refreshRemoteStatus()
    })

    expect(result.current.remoteStatus).toEqual({ branch: 'main', ahead: 1, behind: 0, hasRemote: false })
  })
})

