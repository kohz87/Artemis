export function filePreviewAssetSrc(path: string): string {
  return `/api/vault/asset?path=${encodeURIComponent(path)}`
}
