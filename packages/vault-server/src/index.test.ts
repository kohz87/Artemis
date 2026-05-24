import { get, request } from 'node:http'
import type { AddressInfo } from 'node:net'
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createVaultHttpServer, handleVaultApiRequest } from './index'

const servers: ReturnType<typeof createVaultHttpServer>[] = []

interface JsonResponse {
  statusCode: number
  body: unknown
  headers?: Record<string, string | string[] | undefined>
}

function getJson(url: string): Promise<unknown> {
  return getJsonResponse(url).then(({ body }) => body)
}

function getJsonResponse(url: string): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(body), headers: response.headers })
        } catch (error) {
          reject(error)
        }
      })
    }).on('error', reject)
  })
}

function postJsonResponse(url: string, payload: unknown): Promise<JsonResponse> {
  return postJsonResponseWithHeaders(url, payload, {})
}

function postJsonResponseWithHeaders(
  url: string,
  payload: unknown,
  headers: Record<string, string>,
): Promise<JsonResponse> {
  const body = JSON.stringify(payload)
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
    }, (response) => {
      let responseBody = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { responseBody += chunk })
      response.on('end', () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(responseBody), headers: response.headers })
        } catch (error) {
          reject(error)
        }
      })
    })
    req.on('error', reject)
    req.end(body)
  })
}

function getJsonResponseWithHeaders(url: string, headers: Record<string, string>): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    get(url, { headers }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(body), headers: response.headers })
        } catch (error) {
          reject(error)
        }
      })
    }).on('error', reject)
  })
}

afterEach(async () => {
  vi.restoreAllMocks()
  delete process.env.ARTEMIS_WEB_VAULT_ROOT
  delete process.env.TOLARIA_WEB_VAULT_ROOT
  delete process.env.ARTEMIS_ALLOWED_VAULT_ROOTS
  delete process.env.ARTEMIS_PASSWORD
  delete process.env.ARTEMIS_AUTH_USERNAME
  delete process.env.ARTEMIS_AUTH_EMAIL
  delete process.env.ARTEMIS_SESSION_SECRET
  delete process.env.ARTEMIS_SESSION_TTL_SECONDS
  await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })))
  servers.length = 0
})

describe('vault-server module', () => {
  it('exports the vault API request handler for Vite and standalone servers', () => {
    expect(handleVaultApiRequest).toEqual(expect.any(Function))
  })

  it('creates a reusable HTTP server that handles /api/vault routes independently of Vite', async () => {
    const server = createVaultHttpServer()
    servers.push(server)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    const { port } = server.address() as AddressInfo
    await expect(getJson(`http://127.0.0.1:${port}/api/vault/ping`)).resolves.toEqual({ ok: true })
  })

  it('issues a signed auth session cookie with user identity and accepts it for protected vault routes', async () => {
    process.env.ARTEMIS_PASSWORD = 'swordfish'
    process.env.ARTEMIS_AUTH_USERNAME = 'luca'
    process.env.ARTEMIS_AUTH_EMAIL = 'luca@example.test'
    process.env.ARTEMIS_SESSION_SECRET = 'test-secret'
    const server = createVaultHttpServer()
    servers.push(server)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    const { port } = server.address() as AddressInfo
    const unauthenticated = await getJsonResponse(`http://127.0.0.1:${port}/api/vault/ping`)
    expect(unauthenticated.statusCode).toBe(401)

    const login = await postJsonResponse(`http://127.0.0.1:${port}/api/auth/login`, { password: 'swordfish' })
    expect(login.statusCode).toBe(200)
    expect(login.body).toMatchObject({
      user: { username: 'luca', email: 'luca@example.test' },
      transport: 'cookie',
    })
    expect(login.body).toHaveProperty('token')
    const cookie = (login.headers?.['set-cookie'] as string[])[0]
    expect(cookie).toContain('artemis_session=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')

    const authenticated = await getJsonResponseWithHeaders(`http://127.0.0.1:${port}/api/vault/ping`, { Cookie: cookie })
    expect(authenticated.statusCode).toBe(200)
    expect(authenticated.body).toEqual({ ok: true })
  })

  it('rejects expired bearer sessions and clears cookie sessions on logout', async () => {
    process.env.ARTEMIS_PASSWORD = 'swordfish'
    process.env.ARTEMIS_SESSION_SECRET = 'test-secret'
    process.env.ARTEMIS_SESSION_TTL_SECONDS = '1'
    const server = createVaultHttpServer()
    servers.push(server)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    const { port } = server.address() as AddressInfo
    const login = await postJsonResponse(`http://127.0.0.1:${port}/api/auth/login`, { password: 'swordfish' })
    expect(login.statusCode).toBe(200)
    const { token } = login.body as { token: string }
    const cookie = (login.headers?.['set-cookie'] as string[])[0]

    vi.setSystemTime(Date.now() + 2_000)
    const expired = await getJsonResponseWithHeaders(`http://127.0.0.1:${port}/api/auth/session`, {
      Authorization: `Bearer ${token}`,
    })
    expect(expired.statusCode).toBe(401)

    vi.setSystemTime(Date.now() - 2_000)
    const logout = await postJsonResponseWithHeaders(`http://127.0.0.1:${port}/api/auth/logout`, {}, { Cookie: cookie })
    expect(logout.statusCode).toBe(200)
    expect((logout.headers?.['set-cookie'] as string[])[0]).toContain('Max-Age=0')
  })

  it('refreshes a valid session token and rotates the auth cookie expiry', async () => {
    process.env.ARTEMIS_PASSWORD = 'swordfish'
    process.env.ARTEMIS_SESSION_SECRET = 'test-secret'
    process.env.ARTEMIS_SESSION_TTL_SECONDS = '60'
    const server = createVaultHttpServer()
    servers.push(server)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    const { port } = server.address() as AddressInfo
    const login = await postJsonResponse(`http://127.0.0.1:${port}/api/auth/login`, { password: 'swordfish' })
    expect(login.statusCode).toBe(200)
    const originalToken = (login.body as { token: string }).token
    const cookie = (login.headers?.['set-cookie'] as string[])[0]

    vi.setSystemTime(Date.now() + 2_000)
    const refresh = await postJsonResponseWithHeaders(`http://127.0.0.1:${port}/api/auth/refresh`, {}, { Cookie: cookie })

    expect(refresh.statusCode).toBe(200)
    expect(refresh.body).toMatchObject({ authenticated: true, transport: 'cookie' })
    expect((refresh.body as { token: string }).token).not.toBe(originalToken)
    expect((refresh.headers?.['set-cookie'] as string[])[0]).toContain('artemis_session=')
  })


  it('includes PDF files in vault listings so All Notes PDF visibility can render them', async () => {
    const vaultRoot = mkdtempSync(path.join(tmpdir(), 'artemis-vault-root-'))
    const vaultPath = path.join(vaultRoot, 'pdf-vault')
    mkdirSync(vaultPath)
    process.env.ARTEMIS_WEB_VAULT_ROOT = vaultRoot
    try {
      writeFileSync(path.join(vaultPath, 'note.md'), '# Note\n')
      writeFileSync(path.join(vaultPath, 'report.pdf'), '%PDF-1.4\n')
      writeFileSync(path.join(vaultPath, 'views.yml'), 'name: Test view\n')

      const server = createVaultHttpServer()
      servers.push(server)
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

      const { port } = server.address() as AddressInfo
      const entries = await getJson(
        `http://127.0.0.1:${port}/api/vault/list?path=${encodeURIComponent(vaultPath)}`,
      )

      expect(entries).toEqual(expect.arrayContaining([
        expect.objectContaining({
          path: path.join(vaultPath, 'report.pdf'),
          filename: 'report.pdf',
          title: 'report.pdf',
          fileKind: 'binary',
        }),
        expect.objectContaining({
          path: path.join(vaultPath, 'views.yml'),
          filename: 'views.yml',
          title: 'views.yml',
          fileKind: 'text',
        }),
      ]))
    } finally {
      rmSync(vaultRoot, { recursive: true, force: true })
    }
  })

  it('returns 403 and logs when a query path escapes the configured vault root', async () => {
    const vaultRoot = mkdtempSync(path.join(tmpdir(), 'artemis-vault-root-'))
    const outside = mkdtempSync(path.join(tmpdir(), 'artemis-secret-'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    process.env.ARTEMIS_WEB_VAULT_ROOT = vaultRoot
    try {
      writeFileSync(path.join(outside, 'secret.md'), '# Secret\n')
      const server = createVaultHttpServer()
      servers.push(server)
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

      const { port } = server.address() as AddressInfo
      const response = await getJsonResponse(
        `http://127.0.0.1:${port}/api/vault/content?path=${encodeURIComponent(path.join(outside, 'secret.md'))}`,
      )

      expect(response.statusCode).toBe(403)
      expect(response.body).toEqual({ error: 'Forbidden path' })
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Blocked suspicious vault path access'), expect.any(Object))
    } finally {
      rmSync(vaultRoot, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('returns 403 for symlinks inside the vault root that resolve outside it', async () => {
    const vaultRoot = mkdtempSync(path.join(tmpdir(), 'artemis-vault-root-'))
    const outside = mkdtempSync(path.join(tmpdir(), 'artemis-secret-'))
    const linkPath = path.join(vaultRoot, 'linked-secret.md')
    process.env.ARTEMIS_WEB_VAULT_ROOT = vaultRoot
    try {
      writeFileSync(path.join(outside, 'secret.md'), '# Secret\n')
      symlinkSync(path.join(outside, 'secret.md'), linkPath)
      const server = createVaultHttpServer()
      servers.push(server)
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

      const { port } = server.address() as AddressInfo
      const response = await getJsonResponse(
        `http://127.0.0.1:${port}/api/vault/content?path=${encodeURIComponent(linkPath)}`,
      )

      expect(response.statusCode).toBe(403)
      expect(response.body).toEqual({ error: 'Forbidden path' })
    } finally {
      rmSync(vaultRoot, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('returns 403 when save attempts to write outside the configured vault root', async () => {
    const vaultRoot = mkdtempSync(path.join(tmpdir(), 'artemis-vault-root-'))
    const outside = mkdtempSync(path.join(tmpdir(), 'artemis-secret-'))
    process.env.ARTEMIS_WEB_VAULT_ROOT = vaultRoot
    try {
      const server = createVaultHttpServer()
      servers.push(server)
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

      const { port } = server.address() as AddressInfo
      const response = await postJsonResponse(`http://127.0.0.1:${port}/api/vault/save`, {
        path: path.join(outside, 'secret.md'),
        content: '# Secret\n',
      })

      expect(response.statusCode).toBe(403)
      expect(response.body).toEqual({ error: 'Forbidden path' })
    } finally {
      rmSync(vaultRoot, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('returns 403 and leaves outside files intact when delete targets a path outside the vault root', async () => {
    const vaultRoot = mkdtempSync(path.join(tmpdir(), 'artemis-vault-root-'))
    const outside = mkdtempSync(path.join(tmpdir(), 'artemis-secret-'))
    const secretPath = path.join(outside, 'secret.md')
    process.env.ARTEMIS_WEB_VAULT_ROOT = vaultRoot
    try {
      writeFileSync(secretPath, '# Secret\n')
      const server = createVaultHttpServer()
      servers.push(server)
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

      const { port } = server.address() as AddressInfo
      const response = await postJsonResponse(`http://127.0.0.1:${port}/api/vault/delete`, {
        path: secretPath,
      })

      expect(response.statusCode).toBe(403)
      expect(response.body).toEqual({ error: 'Forbidden path' })
      expect(existsSync(secretPath)).toBe(true)
    } finally {
      rmSync(vaultRoot, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })
})
