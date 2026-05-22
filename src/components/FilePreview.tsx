import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { ClipboardText, FileDashed, FilePdf, ImageSquare, WarningCircle } from '@phosphor-icons/react'
import type { VaultEntry } from '../types'
import { trackFilePreviewAction, trackFilePreviewFailed, trackFilePreviewOpened } from '../lib/productAnalytics'
import { filePreviewKind, previewFileTypeLabel, type FilePreviewKind } from '../utils/filePreview'
import { filePreviewAssetSrc } from '../utils/filePreviewAsset'
import {
  clampPdfZoom,
  pdfPreviewSrc,
  readPdfPreviewSettings,
  writePdfPreviewSettings,
  type PdfPreviewSettings,
} from '../utils/pdfPreviewSettings'
import { focusNoteListContainer } from '../utils/neighborhoodHistory'
import { Button } from './ui/button'

interface FilePreviewProps {
  entry: VaultEntry
  onCopyFilePath?: (path: string) => void
}

interface FilePreviewFallbackProps {
  icon: 'warning' | 'file'
  title: string
  description: string
}

function fallbackContentForPreviewKind(previewKind: FilePreviewKind | null): FilePreviewFallbackProps {
  if (previewKind === 'image') {
    return {
      icon: 'warning',
      title: 'Image preview failed',
      description: 'Artemis could not render this image file in the preview.',
    }
  }

  if (previewKind === 'pdf') {
    return {
      icon: 'warning',
      title: 'PDF preview failed',
      description: 'Artemis could not render this PDF file in the preview.',
    }
  }

  return {
    icon: 'file',
    title: 'Preview unavailable',
    description: 'Artemis does not have an in-app preview for this file type.',
  }
}

function FilePreviewHeaderIcon({ previewKind }: { previewKind: FilePreviewKind | null }) {
  if (previewKind === 'image') {
    return <ImageSquare size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
  }

  if (previewKind === 'pdf') {
    return <FilePdf size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
  }

  return <FileDashed size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
}

function FilePreviewFallback({ icon, title, description }: FilePreviewFallbackProps) {
  const Icon = icon === 'warning' ? WarningCircle : FileDashed

  return (
    <div
      className="flex h-full min-h-[260px] flex-col items-center justify-center gap-4 px-8 text-center"
      data-testid="file-preview-fallback"
    >
      <Icon size={34} className="text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="m-0 text-[15px] font-semibold text-foreground">{title}</h2>
        <p className="m-0 max-w-md text-[13px] leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function FilePreviewHeader({
  entry,
  previewKind,
  fileTypeLabel,
  onCopyFilePath,
}: {
  entry: VaultEntry
  previewKind: FilePreviewKind | null
  fileTypeLabel: string
  onCopyFilePath?: () => void
}) {
  return (
    <div
      className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4"
      data-tauri-drag-region
    >
      <div className="flex min-w-0 items-center gap-2">
        <FilePreviewHeaderIcon previewKind={previewKind} />
        <div className="min-w-0">
          <h1 className="m-0 truncate text-[14px] font-semibold text-foreground">{entry.title}</h1>
          <p className="m-0 text-[11px] text-muted-foreground">{fileTypeLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onCopyFilePath && (
          <Button type="button" variant="ghost" size="sm" onClick={onCopyFilePath}>
            <ClipboardText size={15} />
            Copy path
          </Button>
        )}
      </div>
    </div>
  )
}

function FilePreviewPdfControls({
  settings,
  onPageChange,
  onZoomChange,
}: {
  settings: PdfPreviewSettings
  onPageChange: (page: number) => void
  onZoomChange: (zoom: number) => void
}) {
  const handlePageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const page = Number.parseInt(event.target.value, 10)
    if (Number.isInteger(page) && page > 0) onPageChange(page)
  }, [onPageChange])

  const zoomOut = useCallback(() => onZoomChange(clampPdfZoom(settings.zoom - 25)), [onZoomChange, settings.zoom])
  const zoomIn = useCallback(() => onZoomChange(clampPdfZoom(settings.zoom + 25)), [onZoomChange, settings.zoom])

  return (
    <div className="flex h-[44px] shrink-0 items-center justify-end gap-2 border-b border-border px-4 text-[12px] text-muted-foreground">
      <label className="flex items-center gap-2">
        Page
        <input
          aria-label="PDF page"
          className="h-8 w-16 rounded-md border border-input bg-background px-2 text-foreground"
          min={1}
          type="number"
          value={settings.page}
          onChange={handlePageChange}
        />
      </label>
      <Button type="button" variant="ghost" size="sm" onClick={zoomOut} aria-label="Zoom out">
        −
      </Button>
      <span aria-label="PDF zoom" className="min-w-12 text-center text-foreground">{settings.zoom}%</span>
      <Button type="button" variant="ghost" size="sm" onClick={zoomIn} aria-label="Zoom in">
        +
      </Button>
    </div>
  )
}

function FilePreviewPdf({
  entry,
  pdfSrc,
  settings,
  onPageChange,
  onZoomChange,
}: {
  entry: VaultEntry
  pdfSrc: string
  settings: PdfPreviewSettings
  onPageChange: (page: number) => void
  onZoomChange: (zoom: number) => void
}) {
  const fallback = fallbackContentForPreviewKind('pdf')

  return (
    <div className="flex h-full min-h-[320px] flex-col">
      <FilePreviewPdfControls
        settings={settings}
        onPageChange={onPageChange}
        onZoomChange={onZoomChange}
      />
      <object
        data={pdfPreviewSrc(pdfSrc, settings)}
        type="application/pdf"
        title={entry.title}
        className="min-h-[320px] w-full flex-1 bg-background"
        data-testid="pdf-file-preview"
      >
        <FilePreviewFallback
          icon={fallback.icon}
          title={fallback.title}
          description={fallback.description}
        />
      </object>
    </div>
  )
}

function FilePreviewImage({
  entry,
  imageSrc,
  onImageError,
}: {
  entry: VaultEntry
  imageSrc: string
  onImageError: () => void
}) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center p-6">
      <img
        src={imageSrc}
        alt={entry.title}
        className="max-h-full max-w-full object-contain"
        data-testid="image-file-preview"
        onError={onImageError}
      />
    </div>
  )
}

function shouldRenderImagePreview(isImage: boolean, imageSrc: string | null, imageFailed: boolean): imageSrc is string {
  return isImage && imageSrc !== null && !imageFailed
}

function FilePreviewBody({
  entry,
  previewKind,
  assetSrc,
  imageFailed,
  pdfSettings,
  onImageError,
  onPdfPageChange,
  onPdfZoomChange,
}: {
  entry: VaultEntry
  previewKind: FilePreviewKind | null
  assetSrc: string | null
  imageFailed: boolean
  pdfSettings: PdfPreviewSettings
  onImageError: () => void
  onPdfPageChange: (page: number) => void
  onPdfZoomChange: (zoom: number) => void
}) {
  if (shouldRenderImagePreview(previewKind === 'image', assetSrc, imageFailed)) {
    return <FilePreviewImage entry={entry} imageSrc={assetSrc} onImageError={onImageError} />
  }

  if (previewKind === 'pdf' && assetSrc !== null) {
    return (
      <FilePreviewPdf
        entry={entry}
        pdfSrc={assetSrc}
        settings={pdfSettings}
        onPageChange={onPdfPageChange}
        onZoomChange={onPdfZoomChange}
      />
    )
  }

  const fallback = fallbackContentForPreviewKind(previewKind)

  return (
    <FilePreviewFallback
      icon={fallback.icon}
      title={fallback.title}
      description={fallback.description}
    />
  )
}

export function FilePreview({
  entry,
  onCopyFilePath,
}: FilePreviewProps) {
  const [failedImagePath, setFailedImagePath] = useState<string | null>(null)
  const [storedPdfSettings, setStoredPdfSettings] = useState(() => ({
    path: entry.path,
    settings: readPdfPreviewSettings(entry.path),
  }))
  const previewKind = filePreviewKind(entry)
  const assetSrc = useMemo(() => (previewKind ? filePreviewAssetSrc(entry.path) : null), [entry.path, previewKind])
  const fileTypeLabel = previewFileTypeLabel(entry)
  const pdfSettings = storedPdfSettings.path === entry.path
    ? storedPdfSettings.settings
    : readPdfPreviewSettings(entry.path)
  const imageFailed = failedImagePath === entry.path
  const handleImageError = useCallback(() => {
    setFailedImagePath(entry.path)
    trackFilePreviewFailed('image')
  }, [entry.path])

  useEffect(() => {
    trackFilePreviewOpened(previewKind)
  }, [entry.path, previewKind])

  useEffect(() => {
    if (previewKind === 'pdf') writePdfPreviewSettings(entry.path, pdfSettings)
  }, [entry.path, pdfSettings, previewKind])

  const handlePdfPageChange = useCallback((page: number) => {
    setStoredPdfSettings((current) => ({
      path: entry.path,
      settings: { ...(current.path === entry.path ? current.settings : readPdfPreviewSettings(entry.path)), page },
    }))
  }, [entry.path])

  const handlePdfZoomChange = useCallback((zoom: number) => {
    setStoredPdfSettings((current) => ({
      path: entry.path,
      settings: { ...(current.path === entry.path ? current.settings : readPdfPreviewSettings(entry.path)), zoom },
    }))
  }, [entry.path])

  const handleCopyFilePath = useCallback(() => {
    trackFilePreviewAction('copy_path', previewKind)
    onCopyFilePath?.(entry.path)
  }, [entry.path, onCopyFilePath, previewKind])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    focusNoteListContainer(document)
  }, [])

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground"
      data-testid="file-preview"
      tabIndex={0}
      role="group"
      aria-label={`Preview ${entry.title}`}
      onKeyDown={handleKeyDown}
    >
      <FilePreviewHeader
        entry={entry}
        previewKind={previewKind}
        fileTypeLabel={fileTypeLabel}
        onCopyFilePath={onCopyFilePath ? handleCopyFilePath : undefined}
      />
      <div className="min-h-0 flex-1 overflow-auto bg-background">
        <FilePreviewBody
          entry={entry}
          previewKind={previewKind}
          assetSrc={assetSrc}
          imageFailed={imageFailed}
          pdfSettings={pdfSettings}
          onImageError={handleImageError}
          onPdfPageChange={handlePdfPageChange}
          onPdfZoomChange={handlePdfZoomChange}
        />
      </div>
    </section>
  )
}
