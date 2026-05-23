import { afterEach, describe, expect, it } from 'vitest'

import { isLinux, isMac, shouldUseLinuxWindowChrome } from './platform'

const originalUserAgent = navigator.userAgent

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  })
}

describe('platform helpers', () => {
  afterEach(() => {
    setUserAgent(originalUserAgent)
  })

  it('detects Linux user agents but ignores Android', () => {
    setUserAgent('Mozilla/5.0 (X11; Linux x86_64)')
    expect(isLinux()).toBe(true)

    setUserAgent('Mozilla/5.0 (Linux; Android 14)')
    expect(isLinux()).toBe(false)
  })

  it('detects macOS user agents', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    expect(isMac()).toBe(true)
  })

  it('never enables custom Linux window chrome in the web build', () => {
    setUserAgent('Mozilla/5.0 (X11; Linux x86_64)')
    expect(shouldUseLinuxWindowChrome()).toBe(false)
  })
})
