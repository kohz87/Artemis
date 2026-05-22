export interface PdfPreviewSettings {
  page: number
  zoom: number
}

interface PdfPreviewStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export const defaultPdfPreviewSettings: PdfPreviewSettings = {
  page: 1,
  zoom: 100,
}

const MIN_PAGE = 1
const MIN_ZOOM = 50
const MAX_ZOOM = 200
const STORAGE_PREFIX = 'artemis:pdf-preview:'

function fallbackStorage(): PdfPreviewStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isValidSettings(value: unknown): value is PdfPreviewSettings {
  if (!value || typeof value !== 'object') return false
  const settings = value as Partial<PdfPreviewSettings>
  return isValidPage(settings.page) && isValidZoom(settings.zoom)
}

export function isValidPage(page: unknown): page is number {
  return typeof page === 'number' && Number.isInteger(page) && page >= MIN_PAGE
}

export function isValidZoom(zoom: unknown): zoom is number {
  return typeof zoom === 'number' && Number.isInteger(zoom) && zoom >= MIN_ZOOM && zoom <= MAX_ZOOM
}

export function clampPdfZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function pdfPreviewSettingsStorageKey(path: string): string {
  return `${STORAGE_PREFIX}${encodeURI(path)}`
}

export function readPdfPreviewSettings(
  path: string,
  storage: PdfPreviewStorage | null = fallbackStorage(),
): PdfPreviewSettings {
  if (!storage) return defaultPdfPreviewSettings

  try {
    const stored = storage.getItem(pdfPreviewSettingsStorageKey(path))
    if (!stored) return defaultPdfPreviewSettings
    const parsed = JSON.parse(stored) as unknown
    if (!isValidSettings(parsed)) return defaultPdfPreviewSettings
    return parsed
  } catch {
    return defaultPdfPreviewSettings
  }
}

export function writePdfPreviewSettings(
  path: string,
  settings: PdfPreviewSettings,
  storage: PdfPreviewStorage | null = fallbackStorage(),
): void {
  if (!storage) return

  try {
    storage.setItem(pdfPreviewSettingsStorageKey(path), JSON.stringify(settings))
  } catch {
    // localStorage can be unavailable in restricted contexts.
  }
}

export function pdfPreviewSrc(assetSrc: string, settings: PdfPreviewSettings): string {
  const fragment = new URLSearchParams({
    page: String(settings.page),
    zoom: String(settings.zoom),
  })

  return `${assetSrc}#${fragment.toString()}`
}
