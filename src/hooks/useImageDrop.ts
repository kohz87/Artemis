import { useEffect, useState, type RefObject } from 'react'

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
function hasImageFiles(dt: DataTransfer): boolean {
  for (let i = 0; i < dt.items.length; i++) {
    if (dt.items[i].kind === 'file' && IMAGE_MIME_TYPES.includes(dt.items[i].type)) return true
  }
  return false
}

/** Upload an image file and return a browser data URL for insertion. */
export async function uploadImageFile(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

interface UseImageDropOptions {
  containerRef: RefObject<HTMLDivElement | null>
  /** Retained for API compatibility; HTML drops are handled by the editor paste/drop pipeline. */
  onImageUrl?: (url: string) => void
  vaultPath?: string
}

function useHtmlImageDropFeedback(
  containerRef: RefObject<HTMLDivElement | null>,
  setIsDragOver: (isDragOver: boolean) => void,
) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer || !hasImageFiles(e.dataTransfer)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
    }

    const handleDragLeave = (e: DragEvent) => {
      if (!container.contains(e.relatedTarget as Node)) setIsDragOver(false)
    }

    const handleDrop = () => setIsDragOver(false)

    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('dragleave', handleDragLeave)
    container.addEventListener('drop', handleDrop)

    return () => {
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('dragleave', handleDragLeave)
      container.removeEventListener('drop', handleDrop)
    }
  }, [containerRef, setIsDragOver])
}

export function useImageDrop({ containerRef }: UseImageDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false)

  useHtmlImageDropFeedback(containerRef, setIsDragOver)

  return { isDragOver }
}
