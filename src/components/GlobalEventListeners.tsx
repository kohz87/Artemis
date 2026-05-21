import { useEffect } from 'react'

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

function preventContextMenu(event: MouseEvent): void {
  event.preventDefault()
}

let installed = false

export function installGlobalEventListeners(): () => void {
  if (installed) return () => {}

  installed = true
  document.addEventListener('dragover', preventFileDropNavigation, true)
  document.addEventListener('drop', preventFileDropNavigation, true)

  // Disable the embedded native context menu in Tauri before React handles
  // the event. Capture phase fires first, while React bubble phase still
  // reaches custom menus.
  const isTauri = '__TAURI__' in window || '__TAURI_INTERNALS__' in window
  if (isTauri) {
    document.addEventListener('contextmenu', preventContextMenu, true)
  }

  return () => {
    document.removeEventListener('dragover', preventFileDropNavigation, true)
    document.removeEventListener('drop', preventFileDropNavigation, true)
    if (isTauri) {
      document.removeEventListener('contextmenu', preventContextMenu, true)
    }
    installed = false
  }
}

/**
 * Registers document-level event listeners that must persist for the app's
 * lifetime. Uses useEffect so cleanup runs on unmount (HMR, SPA navigation).
 */
export function GlobalEventListeners() {
  useEffect(() => {
    return installGlobalEventListeners()
  }, [])

  return null
}
