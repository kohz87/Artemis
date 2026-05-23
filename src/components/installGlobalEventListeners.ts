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

let installed = false

export function installGlobalEventListeners(): () => void {
  if (installed) return () => {}

  installed = true
  document.addEventListener('dragover', preventFileDropNavigation, true)
  document.addEventListener('drop', preventFileDropNavigation, true)

  return () => {
    document.removeEventListener('dragover', preventFileDropNavigation, true)
    document.removeEventListener('drop', preventFileDropNavigation, true)
    installed = false
  }
}
