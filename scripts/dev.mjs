import { spawn } from 'node:child_process'

const commands = [
  ['vault-server', 'pnpm', ['dev:server']],
  ['vite', 'pnpm', ['dev:frontend']],
]

let shuttingDown = false

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
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

function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) child.kill(signal)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
