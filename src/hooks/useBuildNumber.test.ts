import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useBuildNumber } from './useBuildNumber'

vi.mock('../backend/client', () => ({
  callWebBackend: vi.fn().mockResolvedValue('b223'),
}))

beforeEach(() => { vi.clearAllMocks() })

describe('useBuildNumber', () => {
  it('returns build number from the web backend mock', async () => {
    const { result } = renderHook(() => useBuildNumber())
    await waitFor(() => expect(result.current).toBe('b223'))
  })

  it('returns fallback on error', async () => {
    const { callWebBackend } = await import('../backend/client')
    vi.mocked(callWebBackend).mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => useBuildNumber())
    await waitFor(() => expect(result.current).toBe('b?'))
  })

  it('ignores build number requests that settle after unmount', async () => {
    const { callWebBackend } = await import('../backend/client')
    let rejectBuildNumber!: (reason?: unknown) => void
    vi.mocked(callWebBackend).mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectBuildNumber = reject
      }),
    )

    const { result, unmount } = renderHook(() => useBuildNumber())
    unmount()

    const originalWindow = globalThis.window
    try {
      vi.stubGlobal('window', undefined)
      rejectBuildNumber(new Error('late failure'))
      await Promise.resolve()
      await Promise.resolve()
    } finally {
      vi.stubGlobal('window', originalWindow)
    }

    expect(result.current).toBeUndefined()
  })
})

