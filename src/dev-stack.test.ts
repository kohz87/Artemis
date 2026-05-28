import { describe, expect, it } from 'vitest'

import { commandsForDevStack, devStackEnv } from '../scripts/dev-helpers.mjs'

describe('commandsForDevStack', () => {
  it('starts both the vault server and frontend with the selected API port', () => {
    expect(commandsForDevStack()).toEqual([
      ['vault-server', 'pnpm', ['dev:server']],
      ['vite', 'pnpm', ['dev:frontend']],
    ])
  })
})

describe('devStackEnv', () => {
  it('points both spawned processes at the selected API endpoint', () => {
    expect(devStackEnv({ env: { ARTEMIS_API_PORT: '5302' }, apiHost: '127.0.0.1', apiPort: 5303 })).toMatchObject({
      ARTEMIS_API_HOST: '127.0.0.1',
      ARTEMIS_API_PORT: '5303',
    })
  })
})
