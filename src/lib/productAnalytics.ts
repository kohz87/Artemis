import { trackEvent } from './telemetry'
import type { AllNotesFileVisibility } from '../utils/allNotesFileVisibility'
import type { FilePreviewKind } from '../utils/filePreview'

type TrackedPreviewKind = FilePreviewKind | 'unsupported'
type FilePreviewAction = 'copy_path'

const ALL_NOTES_VISIBILITY_CATEGORIES: ReadonlyArray<keyof AllNotesFileVisibility> = [
  'pdfs',
  'images',
  'unsupported',
]

function trackedPreviewKind(previewKind: FilePreviewKind | null): TrackedPreviewKind {
  return previewKind ?? 'unsupported'
}

function numericFlag(value: boolean): number {
  return value ? 1 : 0
}

export function trackFilePreviewOpened(previewKind: FilePreviewKind | null): void {
  trackEvent('file_preview_opened', {
    preview_kind: trackedPreviewKind(previewKind),
  })
}

export function trackFilePreviewAction(action: FilePreviewAction, previewKind: FilePreviewKind | null): void {
  trackEvent('file_preview_action', {
    action,
    preview_kind: trackedPreviewKind(previewKind),
  })
}

export function trackFilePreviewFailed(previewKind: FilePreviewKind): void {
  trackEvent('file_preview_failed', { preview_kind: previewKind })
}

export function trackAllNotesVisibilityChanged(
  previous: AllNotesFileVisibility,
  next: AllNotesFileVisibility,
): void {
  for (const category of ALL_NOTES_VISIBILITY_CATEGORIES) {
    if (previous[category] === next[category]) continue
    trackEvent('all_notes_visibility_changed', {
      category,
      enabled: numericFlag(next[category]),
    })
  }
}

export function trackInlineImageLightboxOpened(): void {
  trackEvent('inline_image_lightbox_opened')
}
