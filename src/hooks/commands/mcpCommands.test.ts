import { describe, expect, it, vi } from 'vitest'
import { buildMcpCommands } from './mcpCommands'

describe('buildMcpCommands', () => {
  it('opens the Artemis MCP setup action', () => {
    const onOpenMcpSetup = vi.fn()

    const [command] = buildMcpCommands({ onOpenMcpSetup })

    expect(command?.id).toBe('open-mcp-setup')
    expect(command?.label).toBe('Set Up Artemis MCP')
    command?.execute()
    expect(onOpenMcpSetup).toHaveBeenCalledOnce()
  })
})

