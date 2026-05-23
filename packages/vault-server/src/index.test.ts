import { get } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createVaultHttpServer, handleVaultApiRequest } from './index'

const servers: ReturnType<typeof createVaultHttpServer>[] = []

function getJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(error)
        }
      })
    }).on('error', reject)
  })
}

afterEach(async () => {
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

  it('includes PDF files in vault listings so All Notes PDF visibility can render them', async () => {
    const vaultPath = mkdtempSync(path.join(tmpdir(), 'artemis-pdf-vault-'))
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
      rmSync(vaultPath, { recursive: true, force: true })
    }
  })
})
