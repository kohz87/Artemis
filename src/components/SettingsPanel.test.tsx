import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SettingsPanel } from './SettingsPanel'
import type { Settings } from '../types'
import { THEME_MODE_STORAGE_KEY } from '../lib/themeMode'

const { trackEventMock } = vi.hoisted(() => ({
  trackEventMock: vi.fn(),
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: trackEventMock,
}))

const emptySettings: Settings = {
  auto_pull_interval_minutes: null,
  autogit_enabled: null,
  autogit_idle_threshold_seconds: null,
  autogit_inactive_threshold_seconds: null,
  auto_advance_inbox_after_organize: null,
  telemetry_consent: null,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
  release_channel: null,
  theme_mode: null,
  ui_language: null,
  hide_gitignored_files: null,
  all_notes_show_pdfs: null,
  all_notes_show_images: null,
  all_notes_show_unsupported: null,
}

function installPointerCapturePolyfill() {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => {}
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => {}
  }
}

function createStorageMock(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: vi.fn(() => { values.clear() }),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => { values.delete(key) }),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
  }
}

describe('SettingsPanel', () => {
  const onSave = vi.fn()
  const onClose = vi.fn()
  const localStorageMock = createStorageMock()

  beforeEach(() => {
    vi.clearAllMocks()
    trackEventMock.mockClear()
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
    installPointerCapturePolyfill()
  })

  it('renders nothing when not open', () => {
    const { container } = render(
      <SettingsPanel open={false} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders modal when open', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.queryByText('Sync & Updates')).not.toBeInTheDocument()
    expect(screen.queryByTestId('settings-ui-language')).not.toBeInTheDocument()
    expect(screen.getAllByText('AutoGit').length).toBeGreaterThan(0)
  })

  it('calls onSave with stable defaults on save', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      auto_pull_interval_minutes: null,
      autogit_enabled: false,
      autogit_idle_threshold_seconds: 90,
      autogit_inactive_threshold_seconds: 30,
      release_channel: null,
      theme_mode: 'light',
      hide_gitignored_files: true,
      all_notes_show_pdfs: true,
      all_notes_show_images: false,
      all_notes_show_unsupported: false,
    }))
    expect(onClose).toHaveBeenCalled()
  })

  it('saves Gitignored content visibility immediately for keyboard close', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    fireEvent.click(screen.getByTestId('settings-hide-gitignored-files'))
    fireEvent.keyDown(screen.getByTestId('settings-panel'), { key: 'Escape' })

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      hide_gitignored_files: false,
    }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders All Notes PDF visibility on by default while other file switches stay off', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    expect(screen.getByText('Show PDFs')).toBeInTheDocument()
    expect(within(screen.getByTestId('settings-all-notes-show-pdfs')).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(within(screen.getByTestId('settings-all-notes-show-images')).getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    expect(within(screen.getByTestId('settings-all-notes-show-unsupported')).getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('preserves saved All Notes file visibility switches', () => {
    render(
      <SettingsPanel
        open={true}
        settings={{
          ...emptySettings,
          all_notes_show_pdfs: true,
          all_notes_show_images: true,
          all_notes_show_unsupported: false,
        }}
        onSave={onSave}
        onClose={onClose}
      />
    )

    expect(within(screen.getByTestId('settings-all-notes-show-pdfs')).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(within(screen.getByTestId('settings-all-notes-show-images')).getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(within(screen.getByTestId('settings-all-notes-show-unsupported')).getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('saves All Notes file visibility immediately before Escape close', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    const pdfSwitch = within(screen.getByTestId('settings-all-notes-show-pdfs')).getByRole('switch')
    fireEvent.click(pdfSwitch)
    fireEvent.keyDown(screen.getByTestId('settings-panel'), { key: 'Escape' })

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      all_notes_show_pdfs: false,
      all_notes_show_images: false,
      all_notes_show_unsupported: false,
    }))
    expect(onClose).toHaveBeenCalled()
  })

  it('tracks All Notes visibility toggles with categorical metadata only', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    fireEvent.click(within(screen.getByTestId('settings-all-notes-show-images')).getByRole('switch'))

    expect(trackEventMock).toHaveBeenCalledWith('all_notes_visibility_changed', {
      category: 'images',
      enabled: 1,
    })
    expect(trackEventMock).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ path: expect.any(String) }),
    )
  })

  it('defaults the color mode control to light', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    expect(screen.getByTestId('settings-theme-mode')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'false')
  })

  it('uses the stored color mode mirror when settings have no saved mode', () => {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, 'dark')

    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
  })

  it('saves the selected dark color mode', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      theme_mode: 'dark',
    }))
  })

  it('applies the selected dark color mode immediately while settings stays open', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      theme_mode: 'dark',
    }))
  })

  it('preserves a saved dark color mode until changed', () => {
    render(
      <SettingsPanel
        open={true}
        settings={{ ...emptySettings, theme_mode: 'dark' }}
        onSave={onSave}
        onClose={onClose}
      />
    )

    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      theme_mode: 'dark',
    }))
  })


  it('preserves the stored release channel without showing update settings', () => {
    render(
      <SettingsPanel
        open={true}
        settings={{ ...emptySettings, release_channel: 'beta' }}
        onSave={onSave}
        onClose={onClose}
      />
    )

    expect(screen.queryByText('Release channel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      release_channel: 'beta',
    }))
  })

  it('defaults the organization workflow switch to on', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.getByRole('switch', { name: 'Organize notes explicitly' })).toHaveAttribute('aria-checked', 'true')
  })

  it('defaults auto-advance to the next inbox item to off', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.getByRole('switch', { name: 'Auto-advance to next Inbox item' })).toHaveAttribute('aria-checked', 'false')
  })

  it('defaults the initial H1 auto-rename switch to on', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.getByRole('switch', { name: 'Auto-rename untitled notes from first H1' })).toHaveAttribute('aria-checked', 'true')
  })

  it('saves the word wrap preference when toggled off', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    fireEvent.click(screen.getByTestId('settings-word-wrap-enabled'))
    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      word_wrap_enabled: false,
    }))
  })

  it('preserves a saved word wrap preference', () => {
    render(
      <SettingsPanel
        open={true}
        settings={{ ...emptySettings, word_wrap_enabled: false }}
        onSave={onSave}
        onClose={onClose}
      />
    )

    expect(screen.getByRole('switch', { name: 'Word wrap in raw editor' })).toHaveAttribute('aria-checked', 'false')
  })

  it('defaults AutoGit to off with recommended thresholds', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    expect(screen.getByRole('switch', { name: 'Enable AutoGit' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('settings-autogit-idle-threshold')).toHaveValue(90)
    expect(screen.getByTestId('settings-autogit-inactive-threshold')).toHaveValue(30)
  })

  it('saves AutoGit preferences when toggled and edited', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Enable AutoGit' }))
    fireEvent.change(screen.getByTestId('settings-autogit-idle-threshold'), { target: { value: '120' } })
    fireEvent.change(screen.getByTestId('settings-autogit-inactive-threshold'), { target: { value: '45' } })
    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      autogit_enabled: true,
      autogit_idle_threshold_seconds: 120,
      autogit_inactive_threshold_seconds: 45,
    }))
  })

  it('disables AutoGit controls when the current vault is not git-enabled', () => {
    render(
      <SettingsPanel
        open={true}
        settings={emptySettings}
        isGitVault={false}
        onSave={onSave}
        onClose={onClose}
      />
    )

    expect(screen.getByRole('switch', { name: 'Enable AutoGit' })).toBeDisabled()
    expect(screen.getByTestId('settings-autogit-idle-threshold')).toBeDisabled()
    expect(screen.getByTestId('settings-autogit-inactive-threshold')).toBeDisabled()
  })

  it('saves the initial H1 auto-rename preference when toggled off', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Auto-rename untitled notes from first H1' }))
    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      initial_h1_auto_rename_enabled: false,
    }))
  })

  it('saves the organization workflow preference when toggled off', () => {
    const onSaveExplicitOrganization = vi.fn()
    render(
      <SettingsPanel
        open={true}
        settings={emptySettings}
        onSave={onSave}
        explicitOrganizationEnabled={true}
        onSaveExplicitOrganization={onSaveExplicitOrganization}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Organize notes explicitly' }))
    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSaveExplicitOrganization).toHaveBeenCalledWith(false)
  })

  it('saves the auto-advance inbox preference when toggled on', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Auto-advance to next Inbox item' }))
    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      auto_advance_inbox_after_organize: true,
    }))
  })

  it('calls onClose when Cancel is clicked', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.click(screen.getByTitle('Close settings'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on Escape key', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.keyDown(screen.getByTestId('settings-panel'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('saves on Cmd+Enter', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.keyDown(screen.getByTestId('settings-panel'), { key: 'Enter', metaKey: true })

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      autogit_enabled: false,
    }))
  })

  it('calls onClose when clicking backdrop', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.click(screen.getByTestId('settings-panel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not show a keyboard shortcut hint in the settings footer', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.queryByText(/to open settings/)).not.toBeInTheDocument()
  })
  describe('Privacy & Telemetry section', () => {
    it('renders crash reporting and analytics toggles', () => {
      render(
        <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
      )
      expect(screen.getByTestId('settings-crash-reporting')).toBeInTheDocument()
      expect(screen.getByTestId('settings-analytics')).toBeInTheDocument()
    })

    it('toggles reflect initial settings state', () => {
      const withTelemetry: Settings = {
        ...emptySettings,
        telemetry_consent: true,
        crash_reporting_enabled: true,
        analytics_enabled: false,
        anonymous_id: 'test-uuid',
      }
      render(
        <SettingsPanel open={true} settings={withTelemetry} onSave={onSave} onClose={onClose} />
      )

      const crashCheckbox = within(screen.getByTestId('settings-crash-reporting')).getByRole('checkbox')
      const analyticsCheckbox = within(screen.getByTestId('settings-analytics')).getByRole('checkbox')

      expect(crashCheckbox).toHaveAttribute('aria-checked', 'true')
      expect(analyticsCheckbox).toHaveAttribute('aria-checked', 'false')
    })

    it('saves telemetry settings when toggled and saved', () => {
      render(
        <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
      )

      fireEvent.click(within(screen.getByTestId('settings-crash-reporting')).getByRole('checkbox'))
      fireEvent.click(screen.getByTestId('settings-save'))

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        crash_reporting_enabled: true,
        analytics_enabled: false,
      }))
    })
  })
})

