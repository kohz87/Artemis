import { useEffect } from 'react'
import { installGlobalEventListeners } from './installGlobalEventListeners'

/**
 * Registers document-level event listeners that must persist for the app's
 * lifetime. Uses useEffect so cleanup runs on unmount (HMR, SPA navigation).
 */
export function GlobalEventListeners() {
  useEffect(() => {
    return installGlobalEventListeners()
  }, [])

  return null
}
