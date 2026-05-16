import { convertFileSrc } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'

export function filePreviewAssetSrc(path: string): string {
  if (isTauri()) return convertFileSrc(path)
  return `/api/vault/asset?path=${encodeURIComponent(path)}`
}
