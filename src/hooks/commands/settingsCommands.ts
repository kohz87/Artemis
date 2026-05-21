import { APP_COMMAND_IDS, getAppCommandShortcutDisplay } from '../appCommandCatalog'
import type { CommandAction } from './types'
import { requestGitignoredVisibilityToggle } from '../../lib/gitignoredVisibilityEvents'
import { createTranslator, type AppLocale } from '../../lib/i18n'
import type { ThemeMode } from '../../lib/themeMode'

interface SettingsCommandsConfig {
  vaultCount?: number
  isGettingStartedHidden?: boolean
  onOpenSettings: () => void
  onOpenVault?: () => void
  onCreateEmptyVault?: () => void
  onRemoveActiveVault?: () => void
  onRestoreGettingStarted?: () => void
  onReloadVault?: () => void
  onRepairVault?: () => void
  onToggleGitignoredFilesVisibility?: () => void
  locale?: AppLocale
  onSetThemeMode?: (mode: ThemeMode) => void
}

function commandKeywords(raw: string): string[] {
  return raw.split(/\s+/).filter(Boolean)
}

function buildPrimarySettingsCommands({
  locale = 'en',
  onOpenSettings,
}: Pick<SettingsCommandsConfig, 'locale' | 'onOpenSettings'>): CommandAction[] {
  const t = createTranslator(locale)
  return [
    {
      id: 'open-settings',
      label: t('command.openSettings'),
      group: 'Settings',
      shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.appSettings),
      keywords: commandKeywords(t('command.openSettings.keywords')),
      enabled: true,
      execute: onOpenSettings,
    },
    {
      id: 'open-h1-auto-rename-setting',
      label: t('command.openH1Setting'),
      group: 'Settings',
      keywords: ['h1', 'title', 'filename', 'rename', 'auto', 'untitled', 'sync', 'preference'],
      enabled: true,
      execute: onOpenSettings,
    },
  ]
}

function buildThemeCommands({
  locale = 'en',
  onSetThemeMode,
}: Pick<SettingsCommandsConfig, 'locale' | 'onSetThemeMode'>): CommandAction[] {
  const t = createTranslator(locale)
  const canSetThemeMode = !!onSetThemeMode

  return [
    {
      id: 'use-light-mode',
      label: t('command.settings.useLightMode'),
      group: 'Settings',
      keywords: ['theme', 'appearance', 'light', 'light mode', 'day'],
      enabled: canSetThemeMode,
      execute: () => onSetThemeMode?.('light'),
    },
    {
      id: 'use-dark-mode',
      label: t('command.settings.useDarkMode'),
      group: 'Settings',
      keywords: ['theme', 'appearance', 'dark', 'dark mode', 'night'],
      enabled: canSetThemeMode,
      execute: () => onSetThemeMode?.('dark'),
    },
  ]
}

function buildVaultSettingsCommands({
  vaultCount,
  isGettingStartedHidden,
  onOpenVault,
  onCreateEmptyVault,
  onRemoveActiveVault,
  onRestoreGettingStarted,
}: Pick<SettingsCommandsConfig, 'vaultCount' | 'isGettingStartedHidden' | 'onOpenVault' | 'onCreateEmptyVault' | 'onRemoveActiveVault' | 'onRestoreGettingStarted'>): CommandAction[] {
  return [
    { id: 'create-empty-vault', label: 'Create Empty Vault...', group: 'Settings', keywords: ['vault', 'create', 'new', 'empty', 'folder'], enabled: !!onCreateEmptyVault, execute: () => onCreateEmptyVault?.() },
    { id: 'open-vault', label: 'Open Vault...', group: 'Settings', keywords: ['vault', 'folder', 'switch', 'open', 'workspace'], enabled: true, execute: () => onOpenVault?.() },
    { id: 'remove-vault', label: 'Remove Vault from List', group: 'Settings', keywords: ['vault', 'remove', 'disconnect', 'hide'], enabled: (vaultCount ?? 0) > 1 && !!onRemoveActiveVault, execute: () => onRemoveActiveVault?.() },
    { id: 'restore-getting-started', label: 'Restore Getting Started Vault', group: 'Settings', keywords: ['vault', 'restore', 'demo', 'getting started', 'reset'], enabled: !!isGettingStartedHidden && !!onRestoreGettingStarted, execute: () => onRestoreGettingStarted?.() },
  ]
}

function buildMaintenanceCommands({
  onReloadVault,
  onRepairVault,
  onToggleGitignoredFilesVisibility,
}: Pick<SettingsCommandsConfig, 'onReloadVault' | 'onRepairVault' | 'onToggleGitignoredFilesVisibility'>): CommandAction[] {
  return [
    {
      id: 'toggle-gitignored-files-visibility',
      label: 'Toggle Gitignored Files Visibility',
      group: 'Settings',
      keywords: ['gitignore', 'ignored', 'files', 'folders', 'visibility', 'hide', 'show', 'generated', 'local'],
      enabled: true,
      execute: onToggleGitignoredFilesVisibility ?? requestGitignoredVisibilityToggle,
    },
    { id: 'reload-vault', label: 'Reload Vault', group: 'Settings', keywords: ['reload', 'refresh', 'rescan', 'sync', 'filesystem', 'cache'], enabled: !!onReloadVault, execute: () => onReloadVault?.() },
    { id: 'repair-vault', label: 'Repair Vault', group: 'Settings', keywords: ['repair', 'fix', 'restore', 'config', 'themes', 'missing', 'reset', 'flatten', 'structure'], enabled: !!onRepairVault, execute: () => onRepairVault?.() },
  ]
}

export function buildSettingsCommands(config: SettingsCommandsConfig): CommandAction[] {
  const {
    vaultCount, isGettingStartedHidden,
    onOpenSettings, onOpenVault, onCreateEmptyVault, onRemoveActiveVault, onRestoreGettingStarted,
    onReloadVault, onRepairVault, onToggleGitignoredFilesVisibility,
    locale = 'en', onSetThemeMode,
  } = config

  return [
    ...buildPrimarySettingsCommands({ locale, onOpenSettings }),
    ...buildThemeCommands({ locale, onSetThemeMode }),
    ...buildVaultSettingsCommands({
      vaultCount,
      isGettingStartedHidden,
      onOpenVault,
      onCreateEmptyVault,
      onRemoveActiveVault,
      onRestoreGettingStarted,
    }),
    ...buildMaintenanceCommands({
      onReloadVault,
      onRepairVault,
      onToggleGitignoredFilesVisibility,
    }),
  ]
}
