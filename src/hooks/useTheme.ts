import { useMemo } from 'react'
import themeConfig from '../theme.json'

type ThemeValue = string | number | Record<string, unknown> | unknown[]

/** Convert a nested theme config object into a flat map of CSS custom properties */
function flattenTheme(
  obj: Record<string, ThemeValue>,
  prefix = '--'
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(obj)) {
    const cssKey = `${prefix}${camelToKebab(key)}`

    if (value === null || value === undefined) continue
    if (Array.isArray(value)) continue // skip arrays (e.g. nestedBulletSymbols)

    if (typeof value === 'object') {
      Object.assign(result, flattenTheme(value as Record<string, ThemeValue>, `${cssKey}-`))
    } else if (typeof value === 'number') {
      // Numbers that look like px values get 'px' suffix; ratios/weights don't
      // These are unitless values; everything else gets 'px'
      const isUnitless = /weight|lineHeight|opacity/i.test(key) ||
        cssKey.includes('line-height') ||
        cssKey.includes('font-weight')
      const needsPx = !isUnitless
      result[cssKey] = needsPx ? `${value}px` : String(value)
    } else {
      result[cssKey] = String(value)
    }
  }

  return result
}

function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

export function useEditorTheme() {
  const { cssVars, styleString } = useMemo(() => {
    const vars = flattenTheme(themeConfig as Record<string, ThemeValue>)
    const str = Object.entries(vars)
      .map(([k, v]) => `${k}: ${v};`)
      .join('\n')
    return { cssVars: vars, styleString: str }
  }, [])

  return { themeConfig, cssVars, styleString }
}
