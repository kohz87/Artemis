

const URL_PATTERN = /^https?:\/\//i
const BARE_DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+([/?#]|$)/i
const UNSAFE_URL_WHITESPACE_PATTERN = /\s/

export function normalizeExternalUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || UNSAFE_URL_WHITESPACE_PATTERN.test(trimmed)) return null

  const candidate = URL_PATTERN.test(trimmed)
    ? trimmed
    : BARE_DOMAIN_PATTERN.test(trimmed)
      ? `https://${trimmed}`
      : null

  if (!candidate) return null

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return candidate
  } catch {
    return null
  }
}

export function isUrlValue(value: string): boolean {
  return normalizeExternalUrl(value) !== null
}

export function normalizeUrl(url: string): string {
  const normalized = normalizeExternalUrl(url)
  if (normalized) return normalized
  if (URL_PATTERN.test(url)) return url
  return `https://${url}`
}

/** Open a URL in the system browser. Uses desktop opener plugin in native mode, window.open in browser. */
export async function openExternalUrl(url: string): Promise<void> {
  const normalized = normalizeExternalUrl(url)
  if (!normalized) return

  window.open(normalized, '_blank')
}

/** Copy a local file or folder path to the system clipboard. */
export async function copyLocalPath(absolutePath: string): Promise<void> {
  await copyTextToClipboard(absolutePath)
}

/** Copy text in browser mode, with a legacy selection fallback for non-secure origins. */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  if (copyTextWithLegacySelection(text)) return

  throw new Error('Clipboard API is unavailable')
}

function copyTextWithLegacySelection(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-1000px'
  textarea.style.left = '-1000px'

  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}
