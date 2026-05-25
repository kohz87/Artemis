import { readFileSync } from 'node:fs'
import {
  buildStableDownloadRedirectPage,
  extractStableDownloadTargets,
  extractStableDownloadTargetsFromReleases,
  resolveStableDownloadTargets,
} from './releaseDownloadPage'

describe('web release workflows', () => {
  it('publishes versioned web build artifacts without Tauri packaging inputs', () => {
    const alphaWorkflow = readFileSync(`${process.cwd()}/.github/workflows/release.yml`, 'utf8')
    const stableWorkflow = readFileSync(
      `${process.cwd()}/.github/workflows/release-stable.yml`,
      'utf8',
    )

    for (const workflow of [alphaWorkflow, stableWorkflow]) {
      expect(workflow).toContain('artemis-web-${{ needs.version.outputs.version }}.zip')
      expect(workflow).toContain('run: pnpm build')
      expect(workflow).not.toContain('src-tauri')
      expect(workflow).not.toContain('pnpm tauri')
      expect(workflow).not.toContain('Cargo.toml')
    }
  })

  it('passes the computed build version to the web Sentry release env', () => {
    const alphaWorkflow = readFileSync(`${process.cwd()}/.github/workflows/release.yml`, 'utf8')
    const stableWorkflow = readFileSync(
      `${process.cwd()}/.github/workflows/release-stable.yml`,
      'utf8',
    )
    const releaseEnv = 'VITE_SENTRY_RELEASE: ${{ needs.version.outputs.version }}'

    expect(alphaWorkflow).toContain(releaseEnv)
    expect(stableWorkflow).toContain(releaseEnv)
  })
})

describe('extractStableDownloadTargets', () => {
  it('returns stable downloads for each supported desktop platform when present', () => {
    expect(
      extractStableDownloadTargets({
        platforms: {
          'darwin-aarch64': {
            download_url: 'https://example.com/Tolaria-aarch64.dmg',
          },
          'darwin-x86_64': {
            download_url: 'https://example.com/Tolaria-x64.dmg',
          },
          'linux-x86_64': {
            download_url: 'https://example.com/Tolaria.AppImage',
          },
          'windows-x86_64': {
            url: 'https://example.com/Tolaria-setup.exe',
          },
        },
      }),
    ).toMatchObject({
      'darwin-aarch64': {
        label: 'macOS Apple Silicon',
        url: 'https://example.com/Tolaria-aarch64.dmg',
      },
      'darwin-x86_64': {
        label: 'macOS Intel',
        url: 'https://example.com/Tolaria-x64.dmg',
      },
      'linux-x86_64': {
        label: 'Linux',
        url: 'https://example.com/Tolaria.AppImage',
      },
      'windows-x86_64': {
        label: 'Windows',
        url: 'https://example.com/Tolaria-setup.exe',
      },
    })
  })
})

describe('buildStableDownloadRedirectPage', () => {
  it('builds a redirect page with platform-specific download links', () => {
    const html = buildStableDownloadRedirectPage({
      'darwin-aarch64': {
        buttonLabel: 'Download Artemis for macOS Apple Silicon',
        label: 'macOS Apple Silicon',
        url: 'https://example.com/Tolaria-aarch64.dmg',
      },
      'darwin-x86_64': {
        buttonLabel: 'Download Artemis for Intel Mac',
        label: 'macOS Intel',
        url: 'https://example.com/Tolaria-x64.dmg',
      },
      'windows-x86_64': {
        buttonLabel: 'Download Artemis for Windows',
        label: 'Windows',
        url: 'https://example.com/Tolaria-setup.exe',
      },
    })

    expect(html).toContain('Artemis Stable Download')
    expect(html).toContain('DOWNLOAD_TARGETS')
    expect(html).toContain('Download Artemis for Windows')
    expect(html).toContain('Download Artemis for macOS Apple Silicon')
    expect(html).toContain('Download Artemis for Intel Mac')
    expect(html).toContain('hasMultipleMacDownloads')
    expect(html).toContain('Choose the Apple Silicon or Intel Mac download below.')
    expect(html).toContain('window.location.replace')
    expect(html).toContain('color-scheme: light dark')
    expect(html).toContain('@media (prefers-color-scheme: dark)')
    expect(html).toContain('background: var(--download-surface-page)')
  })

  it('builds a fallback page when no stable downloads exist yet', () => {
    const html = buildStableDownloadRedirectPage({})

    expect(html).toContain('Artemis Stable Download Unavailable')
    expect(html).toContain('View release history')
    expect(html).toContain('https://refactoringhq.github.io/tolaria/')
    expect(html).not.toContain('DOWNLOAD_TARGETS')
  })
})

describe('resolveStableDownloadTargets', () => {
  it('falls back to stable release assets when latest.json is incomplete', () => {
    const latestPayload = {
      platforms: {
        'darwin-aarch64': {
          download_url: 'https://example.com/Tolaria-aarch64.dmg',
        },
      },
    }
    const releasesPayload = [
      {
        prerelease: false,
        assets: [
          {
            name: 'Tolaria_x64.dmg',
            browser_download_url: 'https://example.com/Tolaria-x64.dmg',
          },
          {
            name: 'Tolaria-setup.exe',
            browser_download_url: 'https://example.com/Tolaria-setup.exe',
          },
          {
            name: 'Tolaria.AppImage',
            browser_download_url: 'https://example.com/Tolaria.AppImage',
          },
        ],
      },
    ]

    expect(extractStableDownloadTargetsFromReleases(releasesPayload)).toMatchObject({
      'darwin-x86_64': {
        url: 'https://example.com/Tolaria-x64.dmg',
      },
      'linux-x86_64': {
        url: 'https://example.com/Tolaria.AppImage',
      },
      'windows-x86_64': {
        url: 'https://example.com/Tolaria-setup.exe',
      },
    })
    expect(resolveStableDownloadTargets(latestPayload, releasesPayload)).toMatchObject({
      'darwin-aarch64': {
        url: 'https://example.com/Tolaria-aarch64.dmg',
      },
      'darwin-x86_64': {
        url: 'https://example.com/Tolaria-x64.dmg',
      },
      'linux-x86_64': {
        url: 'https://example.com/Tolaria.AppImage',
      },
      'windows-x86_64': {
        url: 'https://example.com/Tolaria-setup.exe',
      },
    })
  })
})

