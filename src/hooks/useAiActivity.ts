import { useState, useEffect, useRef, useCallback } from 'react'
import { isTauri } from '../mock-tauri'

export type HighlightElement = 'editor' | 'tab' | 'properties' | 'notelist' | null

export interface AiActivity {
  highlightElement: HighlightElement
  highlightPath: string | null
}

export interface AiActivityCallbacks {
  onOpenNote?: (path: string) => void
  onOpenTab?: (path: string) => void
  onSetFilter?: (type: string) => void
  onVaultChanged?: (path?: string) => void
}

interface McpBridgeInfo {
  uiWsUrl?: string
  uiPort?: number
}

function configuredDefaultUiWsUrl(): string {
  const explicitUrl = import.meta.env.VITE_ARTEMIS_MCP_WS_UI_URL || import.meta.env.VITE_MCP_WS_UI_URL
  if (explicitUrl) return explicitUrl

  const port = import.meta.env.VITE_ARTEMIS_MCP_WS_UI_PORT || import.meta.env.VITE_MCP_WS_UI_PORT || '9711'
  return `ws://localhost:${port}`
}

function usableUiWsUrl(info: McpBridgeInfo | null | undefined): string | null {
  if (typeof info?.uiWsUrl === 'string' && info.uiWsUrl.startsWith('ws')) return info.uiWsUrl
  if (typeof info?.uiPort === 'number' && Number.isInteger(info.uiPort)) return `ws://localhost:${info.uiPort}`
  return null
}

async function resolveUiWsUrl(): Promise<string> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const info = await invoke<McpBridgeInfo>('get_mcp_bridge_info')
      return usableUiWsUrl(info) ?? configuredDefaultUiWsUrl()
    } catch {
      return configuredDefaultUiWsUrl()
    }
  }

  try {
    const response = await fetch('/api/mcp/info', { cache: 'no-store' })
    if (!response.ok) return configuredDefaultUiWsUrl()
    return usableUiWsUrl(await response.json() as McpBridgeInfo) ?? configuredDefaultUiWsUrl()
  } catch {
    return configuredDefaultUiWsUrl()
  }
}

const WS_UI_URL = configuredDefaultUiWsUrl()
const HIGHLIGHT_DURATION_MS = 800
const RECONNECT_DELAY_MS = 3000

/**
 * Listens on the UI WebSocket bridge for UI action events
 * from the MCP server. Handles highlight, open_note, open_tab, set_filter,
 * and vault_changed actions.
 */
export function useAiActivity(callbacks?: AiActivityCallbacks): AiActivity {
  const [highlightElement, setHighlightElement] = useState<HighlightElement>(null)
  const [highlightPath, setHighlightPath] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbacksRef = useRef(callbacks)
  useEffect(() => { callbacksRef.current = callbacks })

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data as string)
      if (data.type !== 'ui_action') return
      switch (data.action) {
        case 'highlight':
          setHighlightElement(data.element ?? null)
          setHighlightPath(data.path ?? null)
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => {
            setHighlightElement(null)
            setHighlightPath(null)
          }, HIGHLIGHT_DURATION_MS)
          break
        case 'open_note':
          if (data.path) callbacksRef.current?.onOpenNote?.(data.path)
          break
        case 'open_tab':
          if (data.path) callbacksRef.current?.onOpenTab?.(data.path)
          break
        case 'set_filter':
          if (data.filterType) callbacksRef.current?.onSetFilter?.(data.filterType)
          break
        case 'vault_changed':
          callbacksRef.current?.onVaultChanged?.(data.path)
          break
      }
    } catch {
      // Ignore parse errors from malformed messages
    }
  }, [])

  useEffect(() => {
    let ws: WebSocket | null = null
    let mounted = true
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let currentUrl = WS_UI_URL

    function connect(url = currentUrl) {
      if (!mounted) return
      currentUrl = url
      try {
        ws = new WebSocket(url)
        ws.onmessage = handleMessage
        ws.onclose = () => {
          if (mounted) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
        }
        ws.onerror = () => { /* Silent — bridge may not be running */ }
      } catch {
        if (mounted) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    connect()
    void resolveUiWsUrl().then((url) => {
      if (!mounted || url === WS_UI_URL) return
      currentUrl = url
      if (ws) {
        ws.onclose = null
        ws.close()
      }
      if (reconnectTimer) clearTimeout(reconnectTimer)
      connect(url)
    })

    return () => {
      mounted = false
      ws?.close()
      if (timerRef.current) clearTimeout(timerRef.current)
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [handleMessage])

  return { highlightElement, highlightPath }
}
