import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { Moon, Sun, X } from '@phosphor-icons/react'
import { Copy, Folder, GitBranch, ListChecks, Palette, Plug, ShieldCheck } from 'lucide-react'
import type { Settings } from '../types'
import {
  createTranslator,
  type AppLocale,
} from '../lib/i18n'
import {
  applyThemeModeToDocument,
  DEFAULT_THEME_MODE,
  readStoredThemeMode,
  type ThemeMode,
  writeStoredThemeMode,
} from '../lib/themeMode'
import { shouldHideGitignoredFiles } from '../lib/gitignoredVisibility'
import { trackEvent } from '../lib/telemetry'
import { trackAllNotesVisibilityChanged } from '../lib/productAnalytics'
import { PrivacySettingsSection } from './PrivacySettingsSection'
import {
  NumberInputControl,
  SectionHeading,
  SettingsGroup,
  SettingsRow,
  SettingsSection,
  SettingsSwitchRow,
} from './SettingsControls'
import { SettingsFooter } from './SettingsFooter'
import {
  resolveAllNotesFileVisibility,
  settingsWithAllNotesFileVisibility,
  type AllNotesFileVisibility,
} from '../utils/allNotesFileVisibility'
import { Button } from './ui/button'

interface SettingsPanelProps {
  open: boolean
  settings: Settings
  locale?: AppLocale
  onSave: (settings: Settings) => void
  onCopyMcpConfig?: () => void
  isGitVault?: boolean
  explicitOrganizationEnabled?: boolean
  onSaveExplicitOrganization?: (enabled: boolean) => void
  onClose: () => void
}

interface SettingsDraft {
  autoGitEnabled: boolean
  autoGitIdleThresholdSeconds: number
  autoGitInactiveThresholdSeconds: number
  autoAdvanceInboxAfterOrganize: boolean
  themeMode: ThemeMode
  initialH1AutoRename: boolean
  wordWrapEnabled: boolean
  hideGitignoredFiles: boolean
  allNotesFileVisibility: AllNotesFileVisibility
  crashReporting: boolean
  analytics: boolean
  explicitOrganization: boolean
}

interface SettingsBodyProps {
  t: Translate
  isGitVault: boolean
  autoGitEnabled: boolean
  setAutoGitEnabled: (value: boolean) => void
  autoGitIdleThresholdSeconds: number
  setAutoGitIdleThresholdSeconds: (value: number) => void
  autoGitInactiveThresholdSeconds: number
  setAutoGitInactiveThresholdSeconds: (value: number) => void
  autoAdvanceInboxAfterOrganize: boolean
  setAutoAdvanceInboxAfterOrganize: (value: boolean) => void
  onCopyMcpConfig?: () => void
  themeMode: ThemeMode
  setThemeMode: (value: ThemeMode) => void
  locale: AppLocale
  initialH1AutoRename: boolean
  setInitialH1AutoRename: (value: boolean) => void
  wordWrapEnabled: boolean
  setWordWrapEnabled: (value: boolean) => void
  hideGitignoredFiles: boolean
  setHideGitignoredFiles: (value: boolean) => void
  allNotesFileVisibility: AllNotesFileVisibility
  setAllNotesFileVisibility: (value: AllNotesFileVisibility) => void
  explicitOrganization: boolean
  setExplicitOrganization: (value: boolean) => void
  crashReporting: boolean
  setCrashReporting: (value: boolean) => void
  analytics: boolean
  setAnalytics: (value: boolean) => void
}

const DEFAULT_AUTOGIT_IDLE_THRESHOLD_SECONDS = 90
const DEFAULT_AUTOGIT_INACTIVE_THRESHOLD_SECONDS = 30
const SETTINGS_SECTION_IDS = {
  autogit: 'settings-section-autogit',
  appearance: 'settings-section-appearance',
  content: 'settings-section-content',
  mcp: 'settings-section-mcp',
  workflow: 'settings-section-workflow',
  privacy: 'settings-section-privacy',
} as const
type Translate = ReturnType<typeof createTranslator>

function isSaveShortcut(event: ReactKeyboardEvent): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey)
}

function createSettingsDraft(
  settings: Settings,
  explicitOrganizationEnabled: boolean,
): SettingsDraft {
  return {
    autoGitEnabled: settings.autogit_enabled ?? false,
    autoGitIdleThresholdSeconds: sanitizePositiveInteger(
      settings.autogit_idle_threshold_seconds,
      DEFAULT_AUTOGIT_IDLE_THRESHOLD_SECONDS,
    ),
    autoGitInactiveThresholdSeconds: sanitizePositiveInteger(
      settings.autogit_inactive_threshold_seconds,
      DEFAULT_AUTOGIT_INACTIVE_THRESHOLD_SECONDS,
    ),
    autoAdvanceInboxAfterOrganize: settings.auto_advance_inbox_after_organize ?? false,
    themeMode: resolveSettingsDraftThemeMode(settings.theme_mode),
    initialH1AutoRename: settings.initial_h1_auto_rename_enabled ?? true,
    wordWrapEnabled: settings.word_wrap_enabled ?? true,
    hideGitignoredFiles: shouldHideGitignoredFiles(settings),
    allNotesFileVisibility: resolveAllNotesFileVisibility(settings),
    crashReporting: settings.crash_reporting_enabled ?? false,
    analytics: settings.analytics_enabled ?? false,
    explicitOrganization: explicitOrganizationEnabled,
  }
}

function resolveSettingsDraftThemeMode(themeMode: Settings['theme_mode']): ThemeMode {
  if (themeMode) return themeMode
  if (typeof window === 'undefined') return DEFAULT_THEME_MODE
  return readStoredThemeMode(window.localStorage) ?? DEFAULT_THEME_MODE
}

function resolveTelemetryConsent(settings: Settings, draft: SettingsDraft): boolean | null {
  if (draft.crashReporting || draft.analytics) return true
  return settings.telemetry_consent === null ? null : false
}

function resolveAnonymousId(settings: Settings, draft: SettingsDraft): string | null {
  if (draft.crashReporting || draft.analytics) {
    return settings.anonymous_id ?? crypto.randomUUID()
  }

  return settings.anonymous_id
}

function buildSettingsFromDraft(settings: Settings, draft: SettingsDraft): Settings {
  const nextSettings: Settings = {
    ...settings,
    autogit_enabled: draft.autoGitEnabled,
    autogit_idle_threshold_seconds: draft.autoGitIdleThresholdSeconds,
    autogit_inactive_threshold_seconds: draft.autoGitInactiveThresholdSeconds,
    auto_advance_inbox_after_organize: draft.autoAdvanceInboxAfterOrganize,
    telemetry_consent: resolveTelemetryConsent(settings, draft),
    crash_reporting_enabled: draft.crashReporting,
    analytics_enabled: draft.analytics,
    anonymous_id: resolveAnonymousId(settings, draft),
    theme_mode: draft.themeMode,
    ui_language: null,
    initial_h1_auto_rename_enabled: draft.initialH1AutoRename,
    word_wrap_enabled: draft.wordWrapEnabled,
    hide_gitignored_files: draft.hideGitignoredFiles,
  }
  return settingsWithAllNotesFileVisibility(nextSettings, draft.allNotesFileVisibility)
}

function trackTelemetryConsentChange(previousAnalytics: boolean, nextAnalytics: boolean): void {
  if (!previousAnalytics && nextAnalytics) trackEvent('telemetry_opted_in')
  if (previousAnalytics && !nextAnalytics) trackEvent('telemetry_opted_out')
}

function sanitizePositiveInteger(value: number | null | undefined, fallback: number): number {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 1) return fallback
  return Math.round(value)
}

function applyThemeModeSelection(value: ThemeMode): void {
  if (typeof document !== 'undefined') applyThemeModeToDocument(document, value)
  if (typeof window !== 'undefined') writeStoredThemeMode(window.localStorage, value)
}

function useSettingsPanelAutofocus(panelRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const timer = setTimeout(() => {
      const focusTarget = panelRef.current?.querySelector<HTMLElement>('[data-settings-autofocus="true"]')
      focusTarget?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [panelRef])
}

export function SettingsPanel({
  open,
  settings,
  locale = 'en',
  onSave,
  onCopyMcpConfig,
  isGitVault = true,
  explicitOrganizationEnabled = true,
  onSaveExplicitOrganization,
  onClose,
}: SettingsPanelProps) {
  if (!open) return null

  return (
    <SettingsPanelInner
      settings={settings}
      locale={locale}
      onSave={onSave}
      onCopyMcpConfig={onCopyMcpConfig}
      isGitVault={isGitVault}
      explicitOrganizationEnabled={explicitOrganizationEnabled}
      onSaveExplicitOrganization={onSaveExplicitOrganization}
      onClose={onClose}
    />
  )
}

type SettingsPanelInnerProps = Omit<SettingsPanelProps, 'open' | 'explicitOrganizationEnabled' | 'isGitVault'> & {
  locale: AppLocale
  isGitVault: boolean
  explicitOrganizationEnabled: boolean
}

function SettingsPanelInner({
  settings,
  locale,
  onSave,
  onCopyMcpConfig,
  isGitVault,
  explicitOrganizationEnabled,
  onSaveExplicitOrganization,
  onClose,
}: SettingsPanelInnerProps) {
  const [draft, setDraft] = useState(() => createSettingsDraft(settings, explicitOrganizationEnabled))
  const panelRef = useRef<HTMLDivElement>(null)
  const t = createTranslator(locale)

  useEffect(() => {
    setDraft(createSettingsDraft(settings, explicitOrganizationEnabled))
  }, [explicitOrganizationEnabled, settings])

  useSettingsPanelAutofocus(panelRef)

  const updateDraft = useCallback(
    <Key extends keyof SettingsDraft>(key: Key, value: SettingsDraft[Key]) => {
      setDraft((current) => ({ ...current, [key]: value }))
    },
    [],
  )

  const handleGitignoredVisibilityChange = useCallback((value: boolean) => {
    updateDraft('hideGitignoredFiles', value)
    onSave({ ...settings, hide_gitignored_files: value })
  }, [onSave, settings, updateDraft])

  const handleAllNotesFileVisibilityChange = useCallback((value: AllNotesFileVisibility) => {
    trackAllNotesVisibilityChanged(draft.allNotesFileVisibility, value)
    updateDraft('allNotesFileVisibility', value)
    onSave(settingsWithAllNotesFileVisibility(settings, value))
  }, [draft.allNotesFileVisibility, onSave, settings, updateDraft])

  const handleThemeModeChange = useCallback((value: ThemeMode) => {
    updateDraft('themeMode', value)
    applyThemeModeSelection(value)
    onSave({ ...settings, theme_mode: value })
  }, [onSave, settings, updateDraft])

  const handleSave = useCallback(() => {
    trackTelemetryConsentChange(settings.analytics_enabled === true, draft.analytics)
    onSave(buildSettingsFromDraft(settings, draft))
    onSaveExplicitOrganization?.(draft.explicitOrganization)
    onClose()
  }, [draft, onClose, onSave, onSaveExplicitOrganization, settings])

  const handleBackdropClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }, [onClose])

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (isSaveShortcut(event)) {
        event.preventDefault()
        handleSave()
      }
    },
    [handleSave, onClose],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--shadow-overlay)' }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      data-testid="settings-panel"
    >
      <div
        ref={panelRef}
        className="rounded-lg border border-border bg-background shadow-[0_18px_55px_var(--shadow-dialog)]"
        style={{ width: 'min(960px, calc(100vw - 48px))', maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}
      >
        <SettingsHeader onClose={onClose} t={t} />
        <SettingsBodyFromDraft
          t={t}
          draft={draft}
          locale={locale}
          updateDraft={updateDraft}
          isGitVault={isGitVault}
          onCopyMcpConfig={onCopyMcpConfig}
          setThemeMode={handleThemeModeChange}
          setHideGitignoredFiles={handleGitignoredVisibilityChange}
          setAllNotesFileVisibility={handleAllNotesFileVisibilityChange}
        />
        <SettingsFooter onClose={onClose} onSave={handleSave} t={t} />
      </div>
    </div>
  )
}

function SettingsHeader({ onClose, t }: { onClose: () => void; t: Translate }) {
  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{ height: 56, padding: '0 24px', borderBottom: '1px solid var(--border)' }}
    >
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>{t('settings.title')}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        title={t('settings.close')}
        aria-label={t('settings.close')}
      >
        <X size={16} />
      </Button>
    </div>
  )
}

interface SettingsBodyFromDraftProps {
  t: Translate
  draft: SettingsDraft
  locale: AppLocale
  updateDraft: <Key extends keyof SettingsDraft>(key: Key, value: SettingsDraft[Key]) => void
  isGitVault: boolean
  onCopyMcpConfig?: () => void
  setThemeMode: (value: ThemeMode) => void
  setHideGitignoredFiles: (value: boolean) => void
  setAllNotesFileVisibility: (value: AllNotesFileVisibility) => void
}

function SettingsBodyFromDraft({
  t,
  draft,
  locale,
  updateDraft,
  isGitVault,
  onCopyMcpConfig,
  setThemeMode,
  setHideGitignoredFiles,
  setAllNotesFileVisibility,
}: SettingsBodyFromDraftProps) {
  return (
    <SettingsBody
      t={t}
      locale={locale}
      isGitVault={isGitVault}
      autoGitEnabled={draft.autoGitEnabled}
      setAutoGitEnabled={(value) => updateDraft('autoGitEnabled', value)}
      autoGitIdleThresholdSeconds={draft.autoGitIdleThresholdSeconds}
      setAutoGitIdleThresholdSeconds={(value) => updateDraft('autoGitIdleThresholdSeconds', value)}
      autoGitInactiveThresholdSeconds={draft.autoGitInactiveThresholdSeconds}
      setAutoGitInactiveThresholdSeconds={(value) => updateDraft('autoGitInactiveThresholdSeconds', value)}
      autoAdvanceInboxAfterOrganize={draft.autoAdvanceInboxAfterOrganize}
      setAutoAdvanceInboxAfterOrganize={(value) => updateDraft('autoAdvanceInboxAfterOrganize', value)}
      onCopyMcpConfig={onCopyMcpConfig}
      themeMode={draft.themeMode}
      setThemeMode={setThemeMode}
      initialH1AutoRename={draft.initialH1AutoRename}
      setInitialH1AutoRename={(value) => updateDraft('initialH1AutoRename', value)}
      wordWrapEnabled={draft.wordWrapEnabled}
      setWordWrapEnabled={(value) => updateDraft('wordWrapEnabled', value)}
      hideGitignoredFiles={draft.hideGitignoredFiles}
      setHideGitignoredFiles={setHideGitignoredFiles}
      allNotesFileVisibility={draft.allNotesFileVisibility}
      setAllNotesFileVisibility={setAllNotesFileVisibility}
      explicitOrganization={draft.explicitOrganization}
      setExplicitOrganization={(value) => updateDraft('explicitOrganization', value)}
      crashReporting={draft.crashReporting}
      setCrashReporting={(value) => updateDraft('crashReporting', value)}
      analytics={draft.analytics}
      setAnalytics={(value) => updateDraft('analytics', value)}
    />
  )
}

function SettingsBody(props: SettingsBodyProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <SettingsBodyNav t={props.t} />
      <div className="min-w-0 flex-1 overflow-auto px-6 py-4">
        <SettingsAutoGitAndAppearanceSections {...props} />
        <SettingsContentSections {...props} />
        <SettingsAgentWorkflowSections {...props} />
      </div>
    </div>
  )
}

function SettingsBodyNav({ t }: { t: Translate }) {
  const items = [
    { id: SETTINGS_SECTION_IDS.autogit, label: t('settings.autogit.title'), Icon: GitBranch },
    { id: SETTINGS_SECTION_IDS.appearance, label: t('settings.appearance.title'), Icon: Palette },
    { id: SETTINGS_SECTION_IDS.content, label: t('settings.vaultContent.title'), Icon: Folder },
    { id: SETTINGS_SECTION_IDS.mcp, label: t('settings.aiAgents.title'), Icon: Plug },
    { id: SETTINGS_SECTION_IDS.workflow, label: t('settings.workflow.title'), Icon: ListChecks },
    { id: SETTINGS_SECTION_IDS.privacy, label: t('settings.privacy.title'), Icon: ShieldCheck },
  ]

  return (
    <div className="hidden w-48 shrink-0 border-r border-border px-3 py-4 md:block">
      <div className="sticky top-0 space-y-1.5">
        {items.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 w-full justify-start gap-2.5 px-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={() => document.getElementById(item.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}
          >
            <item.Icon size={16} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

function SettingsAutoGitAndAppearanceSections({
  t,
  isGitVault,
  autoGitEnabled,
  setAutoGitEnabled,
  autoGitIdleThresholdSeconds,
  setAutoGitIdleThresholdSeconds,
  autoGitInactiveThresholdSeconds,
  setAutoGitInactiveThresholdSeconds,
  themeMode,
  setThemeMode,
}: SettingsBodyProps) {
  return (
    <>
      <SettingsSection id={SETTINGS_SECTION_IDS.autogit} showDivider={false}>
        <AutoGitSettingsSection
          t={t}
          isGitVault={isGitVault}
          autoGitEnabled={autoGitEnabled}
          setAutoGitEnabled={setAutoGitEnabled}
          autoGitIdleThresholdSeconds={autoGitIdleThresholdSeconds}
          setAutoGitIdleThresholdSeconds={setAutoGitIdleThresholdSeconds}
          autoGitInactiveThresholdSeconds={autoGitInactiveThresholdSeconds}
          setAutoGitInactiveThresholdSeconds={setAutoGitInactiveThresholdSeconds}
        />
      </SettingsSection>

      <SettingsSection id={SETTINGS_SECTION_IDS.appearance}>
        <SectionHeading title={t('settings.appearance.title')} />
        <SettingsGroup>
          <AppearanceSettingsSection
            t={t}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
          />
        </SettingsGroup>
      </SettingsSection>
    </>
  )
}

function SettingsContentSections({
  t,
  initialH1AutoRename,
  setInitialH1AutoRename,
  wordWrapEnabled,
  setWordWrapEnabled,
  hideGitignoredFiles,
  setHideGitignoredFiles,
  allNotesFileVisibility,
  setAllNotesFileVisibility,
}: SettingsBodyProps) {
  return (
    <SettingsSection id={SETTINGS_SECTION_IDS.content}>
      <VaultContentSettingsSection
        t={t}
        initialH1AutoRename={initialH1AutoRename}
        setInitialH1AutoRename={setInitialH1AutoRename}
        wordWrapEnabled={wordWrapEnabled}
        setWordWrapEnabled={setWordWrapEnabled}
        hideGitignoredFiles={hideGitignoredFiles}
        setHideGitignoredFiles={setHideGitignoredFiles}
        allNotesFileVisibility={allNotesFileVisibility}
        setAllNotesFileVisibility={setAllNotesFileVisibility}
      />
    </SettingsSection>
  )
}

function SettingsAgentWorkflowSections({
  t,
  autoAdvanceInboxAfterOrganize,
  setAutoAdvanceInboxAfterOrganize,
  onCopyMcpConfig,
  explicitOrganization,
  setExplicitOrganization,
  crashReporting,
  setCrashReporting,
  analytics,
  setAnalytics,
}: SettingsBodyProps) {
  return (
    <>
      <SettingsSection id={SETTINGS_SECTION_IDS.mcp}>
        <McpSettingsSection
          t={t}
          onCopyMcpConfig={onCopyMcpConfig}
        />
      </SettingsSection>

      <SettingsSection id={SETTINGS_SECTION_IDS.workflow}>
        <OrganizationWorkflowSection
          t={t}
          checked={explicitOrganization}
          onChange={setExplicitOrganization}
          autoAdvanceInboxAfterOrganize={autoAdvanceInboxAfterOrganize}
          onChangeAutoAdvanceInboxAfterOrganize={setAutoAdvanceInboxAfterOrganize}
        />
      </SettingsSection>

      <SettingsSection id={SETTINGS_SECTION_IDS.privacy}>
        <PrivacySettingsSection
          t={t}
          crashReporting={crashReporting}
          setCrashReporting={setCrashReporting}
          analytics={analytics}
          setAnalytics={setAnalytics}
        />
      </SettingsSection>
    </>
  )
}

function AppearanceSettingsSection({
  t,
  themeMode,
  setThemeMode,
}: Pick<SettingsBodyProps, 't' | 'themeMode' | 'setThemeMode'>) {
  return (
    <SettingsRow label={t('settings.theme.label')} description={t('settings.appearance.description')}>
      <ThemeModeControl value={themeMode} onChange={setThemeMode} t={t} />
    </SettingsRow>
  )
}

function ThemeModeControl({
  value,
  onChange,
  t,
}: {
  value: ThemeMode
  onChange: (value: ThemeMode) => void
  t: Translate
}) {
  return (
    <div
      className="inline-flex w-full rounded-md border border-border bg-muted p-1"
      role="radiogroup"
      aria-label={t('settings.theme.label')}
      data-testid="settings-theme-mode"
    >
      <ThemeModeButton label={t('settings.theme.light')} selected={value === 'light'} value="light" onSelect={onChange}>
        <Sun size={14} />
      </ThemeModeButton>
      <ThemeModeButton label={t('settings.theme.dark')} selected={value === 'dark'} value="dark" onSelect={onChange}>
        <Moon size={14} />
      </ThemeModeButton>
    </div>
  )
}

function ThemeModeButton({
  children,
  label,
  selected,
  value,
  onSelect,
}: {
  children: ReactNode
  label: string
  selected: boolean
  value: ThemeMode
  onSelect: (value: ThemeMode) => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      data-testid={`settings-theme-${value}`}
      className={
        selected
          ? 'h-7 flex-1 border border-border bg-background text-foreground shadow-xs hover:bg-background'
          : 'h-7 flex-1 text-muted-foreground hover:text-foreground'
      }
      onClick={() => onSelect(value)}
    >
      {children}
      {label}
    </Button>
  )
}

function autoGitSectionDescription(isGitVault: boolean, t: Translate): string {
  return isGitVault
    ? t('settings.autogit.description.enabled')
    : t('settings.autogit.description.disabled')
}

function AutoGitSettingsSection({
  t,
  isGitVault,
  autoGitEnabled,
  setAutoGitEnabled,
  autoGitIdleThresholdSeconds,
  setAutoGitIdleThresholdSeconds,
  autoGitInactiveThresholdSeconds,
  setAutoGitInactiveThresholdSeconds,
}: Pick<
  SettingsBodyProps,
  | 't'
  | 'isGitVault'
  | 'autoGitEnabled'
  | 'setAutoGitEnabled'
  | 'autoGitIdleThresholdSeconds'
  | 'setAutoGitIdleThresholdSeconds'
  | 'autoGitInactiveThresholdSeconds'
  | 'setAutoGitInactiveThresholdSeconds'
>) {
  return (
    <>
      <SectionHeading
        title={t('settings.autogit.title')}
      />

      <SettingsGroup>
        <SettingsSwitchRow
          label={t('settings.autogit.enable')}
          description={isGitVault ? t('settings.autogit.enableDescription') : autoGitSectionDescription(isGitVault, t)}
          checked={autoGitEnabled}
          onChange={setAutoGitEnabled}
          disabled={!isGitVault}
          testId="settings-autogit-enabled"
        />

        <SettingsRow
          label={t('settings.autogit.idleThreshold')}
          description={t('settings.autogit.idleThresholdDescription')}
          controlWidth="compact"
        >
          <NumberInputControl
            ariaLabel={t('settings.autogit.idleThreshold')}
            value={autoGitIdleThresholdSeconds}
            onValueChange={setAutoGitIdleThresholdSeconds}
            testId="settings-autogit-idle-threshold"
            disabled={!isGitVault}
          />
        </SettingsRow>

        <SettingsRow
          label={t('settings.autogit.inactiveThreshold')}
          description={t('settings.autogit.inactiveThresholdDescription')}
          controlWidth="compact"
        >
          <NumberInputControl
            ariaLabel={t('settings.autogit.inactiveThreshold')}
            value={autoGitInactiveThresholdSeconds}
            onValueChange={setAutoGitInactiveThresholdSeconds}
            testId="settings-autogit-inactive-threshold"
            disabled={!isGitVault}
          />
        </SettingsRow>
      </SettingsGroup>
    </>
  )
}

function VaultContentSettingsSection({
  t,
  initialH1AutoRename,
  setInitialH1AutoRename,
  wordWrapEnabled,
  setWordWrapEnabled,
  hideGitignoredFiles,
  setHideGitignoredFiles,
  allNotesFileVisibility,
  setAllNotesFileVisibility,
}: Pick<
  SettingsBodyProps,
  | 't'
  | 'initialH1AutoRename'
  | 'setInitialH1AutoRename'
  | 'wordWrapEnabled'
  | 'setWordWrapEnabled'
  | 'hideGitignoredFiles'
  | 'setHideGitignoredFiles'
  | 'allNotesFileVisibility'
  | 'setAllNotesFileVisibility'
>) {
  const updateAllNotesFileVisibility = (patch: Partial<AllNotesFileVisibility>) => {
    setAllNotesFileVisibility({ ...allNotesFileVisibility, ...patch })
  }

  return (
    <>
      <SectionHeading
        title={t('settings.vaultContent.title')}
      />

      <SettingsGroup>
        <SettingsSwitchRow
          label={t('settings.titles.autoRename')}
          description={t('settings.titles.autoRenameDescription')}
          checked={initialH1AutoRename}
          onChange={setInitialH1AutoRename}
          testId="settings-initial-h1-auto-rename"
        />

        <SettingsSwitchRow
          label={t('settings.editor.wordWrap')}
          description={t('settings.editor.wordWrapDescription')}
          checked={wordWrapEnabled}
          onChange={setWordWrapEnabled}
          testId="settings-word-wrap-enabled"
        />

        <SettingsSwitchRow
          label={t('settings.vaultContent.hideGitignored')}
          description={t('settings.vaultContent.hideGitignoredDescription')}
          checked={hideGitignoredFiles}
          onChange={setHideGitignoredFiles}
          testId="settings-hide-gitignored-files"
        />

        <SettingsSwitchRow
          label={t('settings.allNotesVisibility.pdfs')}
          description={t('settings.allNotesVisibility.pdfsDescription')}
          checked={allNotesFileVisibility.pdfs}
          onChange={(checked) => updateAllNotesFileVisibility({ pdfs: checked })}
          testId="settings-all-notes-show-pdfs"
        />

        <SettingsSwitchRow
          label={t('settings.allNotesVisibility.images')}
          description={t('settings.allNotesVisibility.imagesDescription')}
          checked={allNotesFileVisibility.images}
          onChange={(checked) => updateAllNotesFileVisibility({ images: checked })}
          testId="settings-all-notes-show-images"
        />

        <SettingsSwitchRow
          label={t('settings.allNotesVisibility.unsupported')}
          description={t('settings.allNotesVisibility.unsupportedDescription')}
          checked={allNotesFileVisibility.unsupported}
          onChange={(checked) => updateAllNotesFileVisibility({ unsupported: checked })}
          testId="settings-all-notes-show-unsupported"
        />
      </SettingsGroup>
    </>
  )
}

function McpSettingsSection({
  t,
  onCopyMcpConfig,
}: Pick<
  SettingsBodyProps,
  | 't'
  | 'onCopyMcpConfig'
>) {
  return (
    <>
      <SectionHeading
        title={t('settings.aiAgents.title')}
      />

      <SettingsGroup>
        <SettingsRow
          label="Artemis Agent MCP"
          description="Connect Artemis through Artemis's MCP server. Copy the config snippet, then add it to Artemis as an MCP server for this vault."
          controlWidth="wide"
        >
          <CopyMcpConfigButton t={t} onCopyMcpConfig={onCopyMcpConfig} />
        </SettingsRow>
      </SettingsGroup>
    </>
  )
}

function CopyMcpConfigButton({
  t,
  onCopyMcpConfig,
}: {
  t: Translate
  onCopyMcpConfig?: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onCopyMcpConfig}
      disabled={!onCopyMcpConfig}
      className="w-fit gap-2"
      aria-label={t('ai.panel.copyMcpConfig')}
      data-testid="settings-copy-mcp-config"
    >
      <Copy size={15} />
      {t('ai.panel.copyMcpConfig')}
    </Button>
  )
}

function OrganizationWorkflowSection({
  t,
  checked,
  onChange,
  autoAdvanceInboxAfterOrganize,
  onChangeAutoAdvanceInboxAfterOrganize,
}: {
  t: Translate
  checked: boolean
  onChange: (value: boolean) => void
  autoAdvanceInboxAfterOrganize: boolean
  onChangeAutoAdvanceInboxAfterOrganize: (value: boolean) => void
}) {
  return (
    <>
      <SectionHeading
        title={t('settings.workflow.title')}
      />

      <SettingsGroup>
        <SettingsSwitchRow
          label={t('settings.workflow.explicit')}
          description={t('settings.workflow.explicitDescription')}
          checked={checked}
          onChange={onChange}
          testId="settings-explicit-organization"
        />

        <SettingsSwitchRow
          label={t('settings.workflow.autoAdvance')}
          description={t('settings.workflow.autoAdvanceDescription')}
          checked={autoAdvanceInboxAfterOrganize}
          onChange={onChangeAutoAdvanceInboxAfterOrganize}
          testId="settings-auto-advance-inbox-after-organize"
        />
      </SettingsGroup>
    </>
  )
}
