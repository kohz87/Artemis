import { afterEach, describe, expect, it, vi } from 'vitest'

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestUrl(input: RequestInfo | URL) {
  return input instanceof Request ? input.url : String(input)
}

describe('tryVaultApi', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  it('retries vault API discovery after an unavailable response', async () => {
    let vaultApiOnline = false
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url === '/api/vault/ping') {
        return jsonResponse({ ok: vaultApiOnline }, vaultApiOnline ? 200 : 503)
      }
      if (url === 'http://localhost:3000/api/vault/list?path=%2Ffixture') {
        return jsonResponse([{ title: 'Alpha Project' }])
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    const { tryVaultApi } = await import('./vault-api')

    await expect(tryVaultApi('list_vault', { path: '/fixture' })).resolves.toBeUndefined()

    vaultApiOnline = true

    await expect(tryVaultApi('list_vault', { path: '/fixture' })).resolves.toEqual([{ title: 'Alpha Project' }])
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/api/vault/ping')).toHaveLength(2)
  })

  it('unwraps note content responses from the vault API', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url === '/api/vault/ping') {
        return jsonResponse({ ok: true })
      }
      if (url === 'http://localhost:3000/api/vault/content?path=%2Ffixture%2Falpha.md') {
        return jsonResponse({ content: '# Alpha Project' })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    const { tryVaultApi } = await import('./vault-api')

    await expect(tryVaultApi('get_note_content', { path: '/fixture/alpha.md' })).resolves.toBe('# Alpha Project')
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/api/vault/ping')).toHaveLength(1)
  })

  it('validates cached note content through the vault API', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url === '/api/vault/ping') {
        return jsonResponse({ ok: true })
      }
      if (url === 'http://localhost:3000/api/vault/content?path=%2Ffixture%2Falpha.md') {
        return jsonResponse({ content: '# Alpha Project' })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    const { tryVaultApi } = await import('./vault-api')

    await expect(tryVaultApi('validate_note_content', {
      path: '/fixture/alpha.md',
      content: '# Alpha Project',
    })).resolves.toBe(true)
    await expect(tryVaultApi('validate_note_content', {
      path: '/fixture/alpha.md',
      content: '# Stale',
    })).resolves.toBe(false)
  })

  it('surfaces vault API errors instead of falling back to browser mocks', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url === '/api/vault/ping') {
        return jsonResponse({ ok: true })
      }
      if (url === 'http://localhost:3000/api/vault/git/commit') {
        return jsonResponse({ error: 'Nothing to commit' }, 400)
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    const { tryVaultApi } = await import('./vault-api')

    await expect(tryVaultApi('git_commit', {
      vaultPath: '/fixture',
      message: 'Save changes',
    })).rejects.toThrow('Nothing to commit')
  })

  it('routes add-remote requests through the vault API', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url === '/api/vault/ping') {
        return jsonResponse({ ok: true })
      }
      if (url === 'http://localhost:3000/api/vault/git/add-remote') {
        return jsonResponse({ status: 'connected', message: 'Remote connected' })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    const { tryVaultApi } = await import('./vault-api')

    await expect(tryVaultApi('git_add_remote', {
      request: {
        vaultPath: '/fixture',
        remoteUrl: 'https://example.test/repo.git',
      },
    })).resolves.toEqual({ status: 'connected', message: 'Remote connected' })
  })

  it('routes batch note deletes through the vault API', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url === '/api/vault/ping') {
        return jsonResponse({ ok: true })
      }
      if (url === 'http://localhost:3000/api/vault/delete') {
        const body = await (input as Request).json()
        expect(body).toEqual({ paths: ['/fixture/a.md', '/fixture/b.md'] })
        return jsonResponse(['/fixture/a.md', '/fixture/b.md'])
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    const { tryVaultApi } = await import('./vault-api')

    await expect(tryVaultApi('batch_delete_notes', {
      paths: ['/fixture/a.md', '/fixture/b.md'],
    })).resolves.toEqual(['/fixture/a.md', '/fixture/b.md'])
  })
})

