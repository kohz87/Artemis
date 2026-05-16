import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import App from './App.tsx'
import { FrontendReadyMarker } from './components/FrontendReadyMarker'
import { LinuxTitlebar } from './components/LinuxTitlebar'
import { applyStoredThemeMode } from './lib/themeMode'
import {
  APP_COMMAND_EVENT_NAME,
  isAppCommandId,
  isNativeMenuCommandId,
} from './hooks/appCommandDispatcher'
import {
  getShortcutEventInit,
  type AppCommandShortcutEventInit,
  type AppCommandShortcutEventOptions,
} from './hooks/appCommandCatalog'
import { shouldUseLinuxWindowChrome } from './utils/platform'
import { reloadFrontendOnceIfStartupFailed } from './utils/frontendReady'

const EDITOR_DROP_SELECTOR = '.editor__blocknote-container'

function dataTransferHasFiles(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false
  if (dataTransfer.files.length > 0) return true
  if (Array.from(dataTransfer.types).includes('Files')) return true

  return Array.from(dataTransfer.items).some((item) => item.kind === 'file')
}

function isEditorDropTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(EDITOR_DROP_SELECTOR) !== null
}

function preventFileDropNavigation(event: DragEvent): void {
  if (isEditorDropTarget(event.target)) return
  if (!dataTransferHasFiles(event.dataTransfer)) return

  event.preventDefault()
}

document.addEventListener('dragover', preventFileDropNavigation, true)
document.addEventListener('drop', preventFileDropNavigation, true)

// Disable the embedded native context menu in Tauri before React handles the event.
// Capture phase fires first, while React bubble phase still reaches custom menus.
if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) {
  document.addEventListener('contextmenu', (e) => e.preventDefault(), true)
}

if (shouldUseLinuxWindowChrome()) {
  document.body.classList.add('linux-chrome')
}

applyStoredThemeMode(document, window.localStorage)

function dispatchDeterministicShortcutEvent(init: AppCommandShortcutEventInit) {
  const target =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : document.body ?? window

  target.dispatchEvent(new KeyboardEvent('keydown', init))
}

window.__laputaTest = {
  dispatchAppCommand(id: string) {
    if (!isAppCommandId(id)) {
      throw new Error(`Unknown app command: ${id}`)
    }
    window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT_NAME, { detail: id }))
  },
  dispatchShortcutEvent(init: AppCommandShortcutEventInit) {
    dispatchDeterministicShortcutEvent(init)
  },
  async triggerMenuCommand(id: string) {
    if (!isNativeMenuCommandId(id)) {
      throw new Error(`Unknown native menu command: ${id}`)
    }

    if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) {
      const { invoke } = await import('@tauri-apps/api/core')
      return invoke('trigger_menu_command', { id })
    }

    if (!window.__laputaTest?.dispatchBrowserMenuCommand) {
      throw new Error('Artemis test bridge is missing dispatchBrowserMenuCommand')
    }

    window.__laputaTest.dispatchBrowserMenuCommand(id)
    return undefined
  },
  triggerShortcutCommand(id: string, options?: AppCommandShortcutEventOptions) {
    if (!isAppCommandId(id)) {
      throw new Error(`Unknown app command: ${id}`)
    }

    const init = getShortcutEventInit(id, options)
    if (!init) {
      throw new Error(`Command ${id} does not define a keyboard shortcut`)
    }

    dispatchDeterministicShortcutEvent(init)
  },
}

const sentryReactErrorHandler = Sentry.reactErrorHandler()

function captureReactRootError(
  error: unknown,
  errorInfo: { componentStack?: string },
): void {
  sentryReactErrorHandler(error, { componentStack: errorInfo.componentStack ?? '' })
  reloadFrontendOnceIfStartupFailed()
}

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; componentStack: string }
> {
  state: { error: Error | null; componentStack: string } = { error: null, componentStack: '' }

  static getDerivedStateFromError(error: Error) {
    return { error, componentStack: '' }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureReactRootError(error, { componentStack: errorInfo.componentStack ?? '' })
    this.setState({ componentStack: errorInfo.componentStack ?? '' })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main
        style={{
          minHeight: '100dvh',
          padding: 24,
          background: 'var(--background, #fff)',
          color: 'var(--foreground, #37352f)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <h1 style={{ margin: '0 0 12px', fontSize: 20 }}>Artemis failed to render</h1>
        <p style={{ margin: '0 0 16px', color: 'var(--muted-foreground, #787774)' }}>
          The app hit a startup error. Copy the message below from this page or the browser console.
        </p>
        <pre
          style={{
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            border: '1px solid var(--border, #e9e9e7)',
            borderRadius: 8,
            padding: 12,
            background: 'var(--surface-sidebar, #f7f6f3)',
            fontSize: 12,
          }}
        >
          {this.state.error.stack ?? this.state.error.message}
          {this.state.componentStack ? `\n\nComponent stack:${this.state.componentStack}` : ''}
        </pre>
      </main>
    )
  }
}

createRoot(document.getElementById('root')!, {
  onCaughtError: captureReactRootError,
  onUncaughtError: captureReactRootError,
  onRecoverableError: captureReactRootError,
}).render(
  <StrictMode>
    <TooltipProvider>
      <RootErrorBoundary>
        <LinuxTitlebar />
        <App />
        <FrontendReadyMarker />
      </RootErrorBoundary>
    </TooltipProvider>
  </StrictMode>,
)
