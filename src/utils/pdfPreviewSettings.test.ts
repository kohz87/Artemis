import { describe, expect, it } from 'vitest'
import {
  defaultPdfPreviewSettings,
  pdfPreviewSettingsStorageKey,
  pdfPreviewSrc,
  readPdfPreviewSettings,
  writePdfPreviewSettings,
} from './pdfPreviewSettings'

describe('pdfPreviewSettings', () => {
  it('uses a stable per-file storage key without exposing raw path punctuation', () => {
    expect(pdfPreviewSettingsStorageKey('/vault/Attachments/report one.pdf')).toBe(
      'artemis:pdf-preview:/vault/Attachments/report%20one.pdf',
    )
  })

  it('falls back to default settings when storage is empty or malformed', () => {
    const storage = new Map<string, string>()
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    }

    expect(readPdfPreviewSettings('/vault/report.pdf', adapter)).toEqual(defaultPdfPreviewSettings)

    adapter.setItem(pdfPreviewSettingsStorageKey('/vault/report.pdf'), '{"page":0,"zoom":999}')

    expect(readPdfPreviewSettings('/vault/report.pdf', adapter)).toEqual(defaultPdfPreviewSettings)
  })

  it('persists page and zoom settings for the same PDF path', () => {
    const storage = new Map<string, string>()
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    }

    writePdfPreviewSettings('/vault/report.pdf', { page: 4, zoom: 150 }, adapter)

    expect(readPdfPreviewSettings('/vault/report.pdf', adapter)).toEqual({ page: 4, zoom: 150 })
  })

  it('adds page and zoom hash settings to embedded PDF sources', () => {
    expect(pdfPreviewSrc('/api/vault/asset?path=%2Fvault%2Freport.pdf', { page: 3, zoom: 125 })).toBe(
      '/api/vault/asset?path=%2Fvault%2Freport.pdf#page=3&zoom=125',
    )
  })
})
