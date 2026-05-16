import type { CommandAction } from './types'
import { APP_COMMAND_IDS, getAppCommandShortcutDisplay } from '../appCommandCatalog'

interface McpCommandsConfig {
  onOpenMcpSetup?: () => void
}

export function buildMcpCommands({
  onOpenMcpSetup,
}: McpCommandsConfig): CommandAction[] {
  return [
    {
      id: 'open-mcp-setup',
      label: 'Set Up Artemis MCP',
      group: 'Settings',
      shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewToggleAiChat),
      keywords: ['mcp', 'artemis', 'external', 'tools', 'config', 'connect'],
      enabled: !!onOpenMcpSetup,
      execute: () => onOpenMcpSetup?.(),
    },
  ]
}
