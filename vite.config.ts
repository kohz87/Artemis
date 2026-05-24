/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function envPort(env: Record<string, string | undefined>, names: string[], fallback: number): number {
  for (const name of names) {
    const raw = env[name]?.trim()
    if (!raw) continue
    const port = Number(raw)
    if (Number.isInteger(port) && port > 0 && port <= 65535) return port
  }
  return fallback
}

function envString(env: Record<string, string | undefined>, names: string[], fallback: string): string {
  for (const name of names) {
    const raw = env[name]?.trim()
    if (raw) return raw
  }
  return fallback
}

const buildTarget = 'es2022'

const vitestCoverageDirectory = process.env.VITEST_COVERAGE_DIR
  ?? path.join(process.env.TMPDIR ?? '/tmp', 'tolaria-vitest-coverage', String(process.pid))

const devServerWatchIgnored = [
  '**/coverage/**',
  '**/test-results/**',
  '**/playwright-report/**',
  '**/dist/**',
  '**/src-tauri/target/**',
]

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const webDevHost = envString(env, ['ARTEMIS_HOST', 'HOST'], 'localhost')
  const webDevPort = envPort(env, ['ARTEMIS_PORT', 'ARTEMIS_WEB_PORT', 'VITE_ARTEMIS_WEB_PORT', 'PORT'], 5202)
  const apiDevBindHost = envString(env, ['ARTEMIS_API_HOST'], '127.0.0.1')
  const apiDevProxyHost = apiDevBindHost === '0.0.0.0' ? '127.0.0.1' : apiDevBindHost
  const apiDevPort = envPort(env, ['ARTEMIS_API_PORT', 'VITE_ARTEMIS_API_PORT'], 5302)

  return {

  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Inject the demo-vault-v2 path in local dev only - production Tauri builds and
  // CI must resolve the default vault path at runtime via the backend to avoid
  // baking the CI runner's absolute path into the distributed bundle.
  define: {
    ...(process.env.CI || (process.env.TAURI_PLATFORM && !process.env.TAURI_DEBUG)
      ? {}
      : { __DEMO_VAULT_PATH__: JSON.stringify(path.resolve(__dirname, 'demo-vault-v2')) }),
  },

  // Prevent vite from obscuring Rust errors
  clearScreen: false,

  // Tauri expects port 5202 by default. Standalone web can override host/port
  // with ARTEMIS_HOST and ARTEMIS_PORT, e.g. ARTEMIS_HOST=0.0.0.0 ARTEMIS_PORT=5200.
  server: {
    host: webDevHost,
    port: webDevPort,
    strictPort: true,
    allowedHosts: true,
    watch: {
      ignored: devServerWatchIgnored,
    },
    proxy: {
      '/api/vault': {
        target: `http://${apiDevProxyHost}:${apiDevPort}`,
        changeOrigin: true,
      },
      '/api/auth': {
        target: `http://${apiDevProxyHost}:${apiDevPort}`,
        changeOrigin: true,
      },
    },
  },

  // Env variables starting with VITE_, TAURI_, or ARTEMIS_ are exposed to the frontend.
  // ARTEMIS_PASSWORD intentionally gates a simple client-side standalone web login.
  envPrefix: ['VITE_', 'TAURI_', 'ARTEMIS_'],

  build: {
    // Standalone web builds use modern browser output.
    target: buildTarget,
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'packages/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Keep coverage temp files off the mounted workspace to avoid flaky
      // read-after-write races when Vitest re-reads its own coverage shards.
      reportsDirectory: vitestCoverageDirectory,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/types.ts',
        'src/components/ui/dropdown-menu.tsx',
        'src/components/ui/scroll-area.tsx',
        'src/components/ui/select.tsx',
        'src/components/ui/separator.tsx',
        'src/components/ui/tabs.tsx',
        'src/components/ui/tooltip.tsx',
        'src/components/ui/card.tsx',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  }
})
