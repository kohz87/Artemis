import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { ClipboardText, FileDashed, FilePdf, ImageSquare, WarningCircle } from '@phosphor-icons/react'
import type { VaultEntry } from '../types'
import { trackFilePreviewAction, trackFilePreviewFailed, trackFilePreviewOpened } from '../lib/productAnalytics'
import { filePreviewKind, previewFileTypeLabel, type FilePreviewKind } from '../utils/filePreview'
import { filePreviewAssetSrc } from '../utils/filePreviewAsset'
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

function FilePreviewPdf({
  entry,
  pdfSrc,
}: {
  entry: VaultEntry
  pdfSrc: string
}) {
  const fallback = fallbackContentForPreviewKind('pdf')

  return (
    <object
      data={pdfSrc}
      type="application/pdf"
      title={entry.title}
      className="h-full min-h-[320px] w-full bg-background"
      data-testid="pdf-file-preview"
    >
      <FilePreviewFallback
        icon={fallback.icon}
        title={fallback.title}
        description={fallback.description}
      />
    </object>
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
  onImageError,
}: {
  entry: VaultEntry
  previewKind: FilePreviewKind | null
  assetSrc: string | null
  imageFailed: boolean
  onImageError: () => void
}) {
  if (shouldRenderImagePreview(previewKind === 'image', assetSrc, imageFailed)) {
    return <FilePreviewImage entry={entry} imageSrc={assetSrc} onImageError={onImageError} />
  }

  if (previewKind === 'pdf' && assetSrc !== null) {
    return <FilePreviewPdf entry={entry} pdfSrc={assetSrc} />
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
  const previewKind = filePreviewKind(entry)
  const assetSrc = useMemo(() => (previewKind ? filePreviewAssetSrc(entry.path) : null), [entry.path, previewKind])
  const fileTypeLabel = previewFileTypeLabel(entry)
  const imageFailed = failedImagePath === entry.path
  const handleImageError = useCallback(() => {
    setFailedImagePath(entry.path)
    trackFilePreviewFailed('image')
  }, [entry.path])

  useEffect(() => {
    trackFilePreviewOpened(previewKind)
  }, [entry.path, previewKind])

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
          onImageError={handleImageError}
        />
      </div>
    </section>
  )
}
