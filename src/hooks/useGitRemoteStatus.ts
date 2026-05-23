import { useCallback, useEffect, useState } from 'react'
import { callWebBackend } from '../backend/client'
import type { GitRemoteStatus } from '../types'

function webCommand<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return callWebBackend<T>(command, args)
}

export interface GitRemoteState {
  remoteStatus: GitRemoteStatus | null
  refreshRemoteStatus: () => Promise<GitRemoteStatus | null>
}

async function readRemoteStatus(vaultPath: string): Promise<GitRemoteStatus> {
  return webCommand<GitRemoteStatus>('git_remote_status', { vaultPath })
}

export function useGitRemoteStatus(vaultPath: string): GitRemoteState {
  const [remoteStatus, setRemoteStatus] = useState<GitRemoteStatus | null>(null)

  const refreshRemoteStatus = useCallback(async () => {
    try {
      const status = await readRemoteStatus(vaultPath)
      setRemoteStatus(status)
      return status
    } catch {
      setRemoteStatus(null)
      return null
    }
  }, [vaultPath])

  useEffect(() => {
    let cancelled = false

    async function loadRemoteStatus() {
      try {
        const status = await readRemoteStatus(vaultPath)
        if (!cancelled) setRemoteStatus(status)
      } catch {
        if (!cancelled) setRemoteStatus(null)
      }
    }

    void loadRemoteStatus()
    return () => {
      cancelled = true
    }
  }, [vaultPath])

  return { remoteStatus, refreshRemoteStatus }
}
