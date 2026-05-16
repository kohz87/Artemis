/**
 * Vault dialog utilities.
 * In Tauri mode, uses the native dialog plugin for folder picking.
 * In browser mode, falls back to window.prompt() for testing.
 */

import { isTauri } from '../mock-tauri'

export const NATIVE_FOLDER_PICKER_UNAVAILABLE_MESSAGE =
  'Native folder picker is unavailable in this environment.'

export class NativeFolderPickerBlockedError extends Error {
  constructor(message = NATIVE_FOLDER_PICKER_UNAVAILABLE_MESSAGE) {
    super(message)
    this.name = 'NativeFolderPickerBlockedError'
  }
}

export function isNativeFolderPickerBlockedError(
  error: unknown,
): error is NativeFolderPickerBlockedError {
  return error instanceof NativeFolderPickerBlockedError
}

export function formatFolderPickerActionError(
  action: string,
  error: unknown,
): string {
  if (isNativeFolderPickerBlockedError(error)) {
    return error.message
  }

  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : ''

  return message ? `${action}: ${message}` : action
}

function normalizePickedFolderPath(selected: string | string[] | null): string | null {
  const selectedPath = Array.isArray(selected)
    ? (typeof selected[0] === 'string' ? selected[0] : null)
    : selected

  if (typeof selectedPath !== 'string') {
    return null
  }

  if (!selectedPath.startsWith('file://')) {
    return selectedPath
  }

  try {
    const parsed = new URL(selectedPath)
    if (parsed.protocol !== 'file:') {
      return selectedPath
    }

    const decodedPath = decodeURIComponent(parsed.pathname)
    if (parsed.hostname && parsed.hostname.toLowerCase() !== 'localhost') {
      return `//${parsed.hostname}${decodedPath}`
    }

    if (/^\/[A-Za-z]:/.test(decodedPath)) {
      return decodedPath.slice(1)
    }

    return decodedPath
  } catch {
    return selectedPath
  }
}

/**
 * Selects a vault directory. Tauri can use a native picker; browser mode asks
 * for an absolute path on the machine running the Vite/static server.
 * Returns the selected path, or null if the user cancelled.
 */
export async function pickFolder(title?: string): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      directory: true,
      multiple: false,
      title: title ?? 'Select folder',
    })
    return normalizePickedFolderPath(selected)
  }
  const promptTitle = `${title ?? 'Enter folder path'}\n\nEnter an absolute path on the machine running Artemis Web, for example /home/alex/notes.`
  const pickedPath = normalizePickedFolderPath(prompt(promptTitle))
  if (!pickedPath) return null

  try {
    const res = await fetch(`/api/vault/resolve-path?path=${encodeURIComponent(pickedPath)}`)
    if (!res.ok) return pickedPath
    const resolved = await res.json()
    return typeof resolved === 'string' && resolved.trim() ? resolved : pickedPath
  } catch {
    return pickedPath
  }
}
