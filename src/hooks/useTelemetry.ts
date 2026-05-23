import { useEffect, useRef } from 'react'
import { callWebBackend } from '../backend/client'
import { initSentry, teardownSentry, initPostHog, teardownPostHog, updatePostHogIdentify, setReleaseChannel } from '../lib/telemetry'
import { normalizeReleaseChannel, type ReleaseChannel } from '../lib/releaseChannel'
import type { Settings } from '../types'

function webCommand(command: string): Promise<void> {
  return callWebBackend<void>(command)
}

function resolveReleaseChannel(releaseChannel: Settings['release_channel']): ReleaseChannel {
  return normalizeReleaseChannel(releaseChannel)
}

function syncCrashReporting(
  crashEnabled: boolean,
  anonymousId: string | null,
  wasEnabled: boolean,
): void {
  if (crashEnabled && anonymousId) {
    if (!wasEnabled) initSentry(anonymousId)
    return
  }

  if (!wasEnabled) return

  teardownSentry()
  webCommand('reinit_telemetry').catch((err) => console.warn('[telemetry] Reinit failed:', err))
}

function syncAnalytics(
  analyticsEnabled: boolean,
  anonymousId: string | null,
  releaseChannel: ReleaseChannel,
  wasEnabled: boolean,
): void {
  if (!analyticsEnabled) {
    if (wasEnabled) teardownPostHog()
    return
  }

  if (!anonymousId) return

  if (wasEnabled) {
    updatePostHogIdentify(releaseChannel)
    return
  }

  initPostHog(anonymousId, releaseChannel)
}

/**
 * Initializes / tears down Sentry and PostHog reactively based on user settings.
 * Call once in App after settings are loaded.
 */
export function useTelemetry(settings: Settings, loaded: boolean): void {
  const prevCrash = useRef(false)
  const prevAnalytics = useRef(false)

  useEffect(() => {
    if (!loaded) return
    const crashEnabled = settings.crash_reporting_enabled === true
    const analyticsEnabled = settings.analytics_enabled === true
    const anonymousId = settings.anonymous_id
    const releaseChannel = resolveReleaseChannel(settings.release_channel)

    syncCrashReporting(crashEnabled, anonymousId, prevCrash.current)
    setReleaseChannel(releaseChannel)
    syncAnalytics(analyticsEnabled, anonymousId, releaseChannel, prevAnalytics.current)

    prevCrash.current = crashEnabled
    prevAnalytics.current = analyticsEnabled
  }, [loaded, settings.crash_reporting_enabled, settings.analytics_enabled, settings.anonymous_id, settings.release_channel])
}
