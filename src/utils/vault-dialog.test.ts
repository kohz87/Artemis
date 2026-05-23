import { describe, it, expect, vi, beforeEach } from 'vitest'

import { pickFolder } from './vault-dialog'

function browserPromptTitle(title = 'Enter folder path'): string {
  return `${title}\n\nEnter an absolute path on the machine running Artemis Web, for example /home/alex/notes.`
}

describe('pickFolder', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns user input from prompt in browser mode', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('/Users/test/my-vault')

    const result = await pickFolder('Select vault')
    expect(result).toBe('/Users/test/my-vault')
    expect(window.prompt).toHaveBeenCalledWith(browserPromptTitle('Select vault'))
  })

  it('returns null when user cancels prompt in browser mode', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null)

    const result = await pickFolder('Select vault')
    expect(result).toBeNull()
  })

  it('uses default title when none provided in browser mode', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('/some/path')

    await pickFolder()
    expect(window.prompt).toHaveBeenCalledWith(browserPromptTitle())
  })

  it('normalizes file URLs returned by the browser prompt', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('file:///Users/test/My%20Vault')

    const result = await pickFolder('Select vault')

    expect(result).toBe('/Users/test/My Vault')
  })

  it('treats file://localhost Windows paths as local paths instead of UNC hosts', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('file://localhost/C:/Users/test/My%20Vault')

    const result = await pickFolder('Select vault')

    expect(result).toBe('C:/Users/test/My Vault')
  })
})
