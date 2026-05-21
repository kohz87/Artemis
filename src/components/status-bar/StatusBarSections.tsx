import { Moon, Package, Settings, Sun } from 'lucide-react'
import type { ThemeMode } from '../../lib/themeMode'
import { translate, type AppLocale } from '../../lib/i18n'
import { useStatusBarAddRemote } from '../../hooks/useStatusBarAddRemote'
import type { GitRemoteStatus, SyncStatus } from '../../types'
import { ActionTooltip } from '@/components/ui/action-tooltip'
import { AddRemoteModal } from '../AddRemoteModal'
import { Button } from '@/components/ui/button'
import {
  CommitButton,
  ConflictBadge,
  ChangesBadge,
  MissingGitBadge,
  NoRemoteBadge,
  OfflineBadge,
  PulseBadge,
  RepositoryBadge,
  SyncBadge,
  VaultReloadingBadge,
} from './StatusBarBadges'
import { ICON_STYLE, SEP_STYLE } from './styles'
import type { VaultOption } from './types'
import { VaultMenu } from './VaultMenu'
import { APP_COMMAND_IDS, getAppCommandShortcutDisplay } from '../../hooks/appCommandCatalog'

function shortcutCopy(commandId: Parameters<typeof getAppCommandShortcutDisplay>[0]): { shortcut?: string } {
  const shortcut = getAppCommandShortcutDisplay(commandId)
  return shortcut ? { shortcut } : {}
}

const SETTINGS_SHORTCUT = shortcutCopy(APP_COMMAND_IDS.appSettings)
const ZOOM_RESET_SHORTCUT = shortcutCopy(APP_COMMAND_IDS.viewZoomReset)

interface StatusBarPrimarySectionProps {
  modifiedCount: number
  vaultPath: string
  vaults: VaultOption[]
  onSwitchVault: (path: string) => void
  onOpenLocalFolder?: () => void
  onCreateEmptyVault?: () => void
  onCloneVault?: () => void
  onCloneGettingStarted?: () => void
  onAddRemote?: () => void
  onClickPending?: () => void
  onClickPulse?: () => void
  onCommitPush?: () => void
  onInitializeGit?: () => void
  isOffline?: boolean
  isVaultReloading?: boolean
  isGitVault?: boolean
  syncStatus: SyncStatus
  lastSyncTime: number | null
  conflictCount: number
  remoteStatus?: GitRemoteStatus | null
  onTriggerSync?: () => void
  onPullAndPush?: () => void
  onOpenConflictResolver?: () => void
  buildNumber?: string
  onRemoveVault?: (path: string) => void
  stacked?: boolean
  compact?: boolean
  locale?: AppLocale
}

interface StatusBarSecondarySectionProps {
  noteCount: number
  zoomLevel: number
  themeMode?: ThemeMode
  onZoomReset?: () => void
  onToggleThemeMode?: () => void
  onOpenSettings?: () => void
  stacked?: boolean
  compact?: boolean
  locale?: AppLocale
}

function BuildNumberButton({
  buildNumber,
  compact,
  locale,
}: {
  buildNumber?: string
  compact: boolean
  locale: AppLocale
}) {
  const className = compact
    ? 'h-6 min-w-0 gap-1 rounded-sm px-1 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'
    : 'h-auto gap-1 rounded-sm px-1 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground'

  return (
    <div className={className} aria-label="Build number" data-testid="status-build-number">
      <span style={ICON_STYLE}>
        <Package size={13} />
        {compact ? null : buildNumber ?? translate(locale, 'status.build.unknown')}
      </span>
    </div>
  )
}

function StatusBarPrimaryBadges({
  modifiedCount,
  visibleRemoteStatus,
  onAddRemote,
  onClickPending,
  onCommitPush,
  onInitializeGit,
  syncStatus,
  lastSyncTime,
  onTriggerSync,
  onPullAndPush,
  onOpenConflictResolver,
  conflictCount,
  onClickPulse,
  isGitVault,
  isOffline,
  isVaultReloading,
  compact,
  locale,
}: {
  modifiedCount: number
  visibleRemoteStatus: GitRemoteStatus | null
  onAddRemote: () => void
  onClickPending?: () => void
  onCommitPush?: () => void
  onInitializeGit?: () => void
  syncStatus: SyncStatus
  lastSyncTime: number | null
  onTriggerSync?: () => void
  onPullAndPush?: () => void
  onOpenConflictResolver?: () => void
  conflictCount: number
  onClickPulse?: () => void
  isGitVault: boolean
  isOffline: boolean
  isVaultReloading: boolean
  compact: boolean
  locale: AppLocale
}) {
  return (
    <>
      <OfflineBadge isOffline={isOffline} showSeparator={!compact} compact={compact} locale={locale} />
      <VaultReloadingBadge isReloading={isVaultReloading} showSeparator={!compact} compact={compact} locale={locale} />
      {isGitVault ? (
        <>
          <NoRemoteBadge remoteStatus={visibleRemoteStatus} onAddRemote={onAddRemote} showSeparator={!compact} compact={compact} locale={locale} />
          <RepositoryBadge remoteStatus={visibleRemoteStatus} onClick={onAddRemote} showSeparator={!compact} compact={compact} />
          <ChangesBadge count={modifiedCount} onClick={onClickPending} showSeparator={!compact} compact={compact} locale={locale} />
          <CommitButton onClick={onCommitPush} remoteStatus={visibleRemoteStatus} showSeparator={!compact} compact={compact} locale={locale} />
          <SyncBadge
            status={syncStatus}
            lastSyncTime={lastSyncTime}
            remoteStatus={visibleRemoteStatus}
            onTriggerSync={onTriggerSync}
            onPullAndPush={onPullAndPush}
            onOpenConflictResolver={onOpenConflictResolver}
            compact={compact}
            locale={locale}
          />
          <ConflictBadge count={conflictCount} onClick={onOpenConflictResolver} showSeparator={!compact} compact={compact} locale={locale} />
          <PulseBadge onClick={onClickPulse} showSeparator={!compact} compact={compact} locale={locale} />
        </>
      ) : (
        <MissingGitBadge onClick={onInitializeGit} showSeparator={!compact} compact={compact} locale={locale} />
      )}
    </>
  )
}

function primarySectionStyle(stacked: boolean, compact: boolean) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: compact ? 8 : 12,
    rowGap: stacked ? 4 : 0,
    flex: 1,
    minWidth: 0,
    width: stacked ? '100%' : 'auto',
    flexBasis: stacked ? '100%' : 'auto',
    flexWrap: stacked ? 'wrap' : 'nowrap',
  } as const
}

function PrimarySeparator({ compact }: { compact: boolean }) {
  return compact ? null : <span style={SEP_STYLE}>|</span>
}

export function StatusBarPrimarySection({
  modifiedCount,
  vaultPath,
  vaults,
  onSwitchVault,
  onOpenLocalFolder,
  onCreateEmptyVault,
  onCloneVault,
  onCloneGettingStarted,
  onAddRemote,
  onClickPending,
  onClickPulse,
  onCommitPush,
  onInitializeGit,
  isOffline = false,
  isVaultReloading = false,
  isGitVault = true,
  syncStatus,
  lastSyncTime,
  conflictCount,
  remoteStatus,
  onTriggerSync,
  onPullAndPush,
  onOpenConflictResolver,
  buildNumber,
  onRemoveVault,
  locale = 'en',
  stacked = false,
  compact = false,
}: StatusBarPrimarySectionProps) {
  const {
    openAddRemote,
    closeAddRemote,
    showAddRemote,
    visibleRemoteStatus,
    handleRemoteConnected,
  } = useStatusBarAddRemote({
    vaultPath,
    isGitVault,
    remoteStatus,
    onAddRemote,
  })

  return (
    <div
      style={primarySectionStyle(stacked, compact)}
    >
      <VaultMenu
        vaults={vaults}
        vaultPath={vaultPath}
        onSwitchVault={onSwitchVault}
        onOpenLocalFolder={onOpenLocalFolder}
        onCreateEmptyVault={onCreateEmptyVault}
        onCloneVault={onCloneVault}
        onCloneGettingStarted={onCloneGettingStarted}
        onRemoveVault={onRemoveVault}
        compact={compact}
        locale={locale}
      />
      <PrimarySeparator compact={compact} />
      <BuildNumberButton buildNumber={buildNumber} compact={compact} locale={locale} />
      <StatusBarPrimaryBadges
        modifiedCount={modifiedCount}
        visibleRemoteStatus={visibleRemoteStatus}
        onAddRemote={() => {
          void openAddRemote()
        }}
        onClickPending={onClickPending}
        onCommitPush={onCommitPush}
        onInitializeGit={onInitializeGit}
        syncStatus={syncStatus}
        lastSyncTime={lastSyncTime}
        onTriggerSync={onTriggerSync}
        onPullAndPush={onPullAndPush}
        onOpenConflictResolver={onOpenConflictResolver}
        conflictCount={conflictCount}
        onClickPulse={onClickPulse}
        isGitVault={isGitVault}
        isOffline={isOffline} isVaultReloading={isVaultReloading}
        compact={compact}
        locale={locale}
      />
      <AddRemoteModal
        open={showAddRemote}
        vaultPath={vaultPath}
        remoteStatus={visibleRemoteStatus}
        onOpenLocalFolder={onOpenLocalFolder}
        onCloneVault={onCloneVault}
        onClose={closeAddRemote}
        onRemoteConnected={handleRemoteConnected}
      />
    </div>
  )
}

export function StatusBarSecondarySection({
  noteCount,
  zoomLevel,
  themeMode = 'light',
  onZoomReset,
  onToggleThemeMode,
  onOpenSettings,
  locale = 'en',
  stacked = false,
  compact = false,
}: StatusBarSecondarySectionProps) {
  void noteCount
  const ThemeIcon = themeMode === 'dark' ? Sun : Moon
  const themeTooltip = {
    label: translate(locale, themeMode === 'dark' ? 'status.theme.light' : 'status.theme.dark'),
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: stacked ? 'flex-end' : 'flex-start',
        gap: compact ? 8 : 12,
        flexShrink: 0,
        width: stacked ? '100%' : 'auto',
      }}
    >
      {zoomLevel === 100 ? null : (
        <ActionTooltip copy={{ label: translate(locale, 'status.zoom.reset'), ...ZOOM_RESET_SHORTCUT }} side="top">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-auto rounded-sm px-1 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
            onClick={onZoomReset}
            aria-label={translate(locale, 'status.zoom.reset')}
            data-testid="status-zoom"
          >
            <span style={ICON_STYLE}>{zoomLevel}%</span>
          </Button>
        </ActionTooltip>
      )}
      <ActionTooltip copy={themeTooltip} side="top" align="end" contentTestId="status-theme-mode-tooltip">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
          onClick={onToggleThemeMode}
          disabled={!onToggleThemeMode}
          aria-label={themeTooltip.label}
          data-testid="status-theme-mode"
        >
          <ThemeIcon size={14} />
        </Button>
      </ActionTooltip>
      <ActionTooltip copy={{ label: translate(locale, 'status.settings.open'), ...SETTINGS_SHORTCUT }} side="top" align="end">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
          onClick={onOpenSettings}
          aria-label={translate(locale, 'status.settings.open')}
          data-testid="status-settings"
        >
          <Settings size={14} />
        </Button>
      </ActionTooltip>
    </div>
  )
}
