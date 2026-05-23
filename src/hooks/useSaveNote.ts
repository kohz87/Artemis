import { useCallback } from 'react'
import { callWebBackend, updateMockContent } from '../backend/client'
import { cacheNoteContent } from './useTabManagement'

export async function persistContent(path: string, content: string, vaultPath?: string): Promise<void> {
  const args = vaultPath ? { path, content, vaultPath } : { path, content }
  await callWebBackend('save_note_content', args)
}

/**
 * Hook that provides an explicit save function for note content.
 * Called on Cmd+S — no debounce, no auto-save.
 *
 * @param updateContent - callback to also update in-memory state after save
 */
export function useSaveNote(updateContent: (path: string, content: string) => void, vaultPath?: string) {
  const saveNote = useCallback(async (path: string, content: string) => {
    await persistContent(path, content, vaultPath)
    cacheNoteContent(path, content)
    updateMockContent(path, content)
    updateContent(path, content)
  }, [updateContent, vaultPath])

  return { saveNote }
}
