import { useState, useEffect } from 'react'
import { callWebBackend } from '../backend/client'

function webCommand<T>(cmd: string): Promise<T> {
  return callWebBackend<T>(cmd)
}

export function useBuildNumber(): string | undefined {
  const [buildNumber, setBuildNumber] = useState<string>()

  useEffect(() => {
    let mounted = true

    webCommand<string>('get_build_number')
      .then((value) => {
        if (mounted) setBuildNumber(value)
      })
      .catch(() => {
        if (mounted) setBuildNumber('b?')
      })

    return () => {
      mounted = false
    }
  }, [])

  return buildNumber
}
