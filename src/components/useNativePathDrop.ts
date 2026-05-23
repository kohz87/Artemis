import type { RefObject } from 'react'

interface NativePathDropOptions<T extends HTMLElement> {
  targetRef: RefObject<T | null>
  disabled?: boolean
  onPathDrop: (paths: string[]) => void
}

/**
 * Web builds do not receive native OS path-drop events. Keep the hook as a
 * no-op compatibility surface for text inputs that still call it.
 */
export function useNativePathDrop<T extends HTMLElement>({
  targetRef,
  disabled,
  onPathDrop,
}: NativePathDropOptions<T>) {
  void targetRef
  void disabled
  void onPathDrop
}
