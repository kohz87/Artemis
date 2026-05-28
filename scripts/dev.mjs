import { spawn } from 'node:child_process'
import net from 'node:net'

import {
  commandsForDevStack,
  devStackEnv,
  vaultServerHost,
  vaultServerPort,
} from './dev-helpers.mjs'

const apiHost = vaultServerHost()
const requestedApiPort = vaultServerPort()
const apiPort = await findAvailablePort(apiHost, requestedApiPort)
const childEnv = devStackEnv({ apiHost, apiPort })
const commands = commandsForDevStack()

if (apiPort !== requestedApiPort) {
  console.warn(
    `[dev] Artemis API port ${requestedApiPort} is already in use; starting this dev stack on ${apiPort} instead.`,
  )
}

let shuttingDown = false

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: childEnv,
    stdio: ['inherit', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`))
  child.on('error', (error) => {
    console.error(`[${name}] failed to start`, error)
    shutdown('SIGTERM')
    process.exitCode = 1
  })
  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    shutdown('SIGTERM')
    process.exitCode = code ?? (signal ? 1 : 0)
  })

  return child
})

async function findAvailablePort(host, preferredPort) {
  for (let port = preferredPort; port <= 65535; port += 1) {
    if (await canBind(host, port)) return port
  }
  throw new Error(`No available port found at or above ${preferredPort}`)
}

function canBind(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, host)
  })
}

function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) child.kill(signal)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
