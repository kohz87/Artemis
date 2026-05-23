import { afterEach, describe, expect, it, vi } from 'vitest'

import { callWebBackend } from './client'

const originalHandlers = window.__mockHandlers

describe('callWebBackend', () => {
  afterEach(() => {
    window.__mockHandlers = originalHandlers
    vi.restoreAllMocks()
  })

  it('dispatches commands to the browser fallback handler when no web API responds', async () => {
    window.__mockHandlers = {
      custom_command: vi.fn(() => ({ ok: true })),
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))

    await expect(callWebBackend('custom_command', { path: '/vault' })).resolves.toEqual({ ok: true })
    expect(window.__mockHandlers.custom_command).toHaveBeenCalledWith({ path: '/vault' })
  })

  it('throws for commands that neither the web API nor fallback handlers support', async () => {
    window.__mockHandlers = {}
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))

    await expect(callWebBackend('missing_command')).rejects.toThrow(
      'No web backend handler for command: missing_command',
    )
  })
})
