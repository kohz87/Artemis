import { describe, expect, it } from 'vitest'
import {
  APP_LOCALES,
  EN_TRANSLATIONS,
  localeCatalogLocales,
  translate,
} from './i18n'

describe('i18n', () => {
  it('keeps English locale metadata aligned with the locale registry', () => {
    expect(APP_LOCALES).toContain('zh-CN')
    expect(APP_LOCALES).toContain('zh-TW')
    expect(APP_LOCALES).toContain('ko-KR')
  })

  it('keeps locale label keys present in English', () => {
    expect(EN_TRANSLATIONS['locale.itIT']).toBe('Italian')
    expect(EN_TRANSLATIONS['locale.koKR']).toBe('Korean')
  })

  it('loads a translation catalog for every configured locale', () => {
    expect(localeCatalogLocales()).toEqual(APP_LOCALES)
  })

  it('drops English-only plural suffix values for non-English locales', () => {
    expect(translate('en', 'status.conflict.count', { count: 2, plural: 's' })).toBe('2 conflicts')
    expect(translate('zh-CN', 'status.conflict.count', { count: 2, plural: 's' })).toBe('2 个冲突')
    expect(translate('zh-TW', 'status.conflict.count', { count: 2, plural: 's' })).toBe('2 個衝突')
  })
})

