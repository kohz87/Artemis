import { createVaultHttpServer, vaultServerHost, vaultServerPort } from './index.ts'

const host = vaultServerHost()
const port = vaultServerPort()
const server = createVaultHttpServer()

server.on('listening', () => {
  console.log(`Artemis vault server listening on http://${host}:${port}`)
})

server.on('error', (error) => {
  console.error('Artemis vault server failed to start', error)
  process.exitCode = 1
})

server.listen(port, host)
