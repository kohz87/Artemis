import { useMemo } from 'react'
import type { AppLocale } from '../lib/i18n'
import type { ThemeMode } from '../lib/themeMode'
import type { NoteWidthMode, SidebarSelection, VaultEntry } from '../types'
import type { NoteListFilter } from '../utils/noteListHelpers'
import type { ViewMode } from './useViewMode'
import { buildNavigationCommands } from './commands/navigationCommands'
import { buildNoteCommands } from './commands/noteCommands'
import { buildGitCommands } from './commands/gitCommands'
import { buildViewCommands } from './commands/viewCommands'
import { buildSettingsCommands } from './commands/settingsCommands'
import { buildMcpCommands } from './commands/mcpCommands'
import { buildTypeCommands } from './commands/typeCommands'
import { buildFilterCommands } from './commands/filterCommands'
import { localizeCommandActions } from './commands/localizeCommands'
import { extractVaultTypes } from '../utils/vaultTypes'

// Re-export types and helpers for backward compatibility
export type { CommandAction, CommandGroup } from './commands/types'
export { groupSortKey } from './commands/types'
export { pluralizeType, buildTypeCommands } from './commands/typeCommands'
export { extractVaultTypes } from '../utils/vaultTypes'
export { buildViewCommands } from './commands/viewCommands'

interface CommandRegistryConfig {
  activeTabPath: string | null
  entries: VaultEntry[]
  modifiedCount: number
  activeNoteHasIcon?: boolean
  mcpStatus?: string
  onInstallMcp?: () => void
  onOpenMcpSetup?: () => void
  onReloadVault?: () => void
  onRepairVault?: () => void
  onSetNoteIcon?: () => void
  onRemoveNoteIcon?: () => void
  locale?: AppLocale
  onSetThemeMode?: (mode: ThemeMode) => void
  onChangeNoteType?: () => void
  onMoveNoteToFolder?: () => void
  canMoveNoteToFolder?: boolean
  onOpenInNewWindow?: () => void
  onCopyActiveFilePath?: (path: string) => void
  onToggleFavorite?: (path: string) => void
  onToggleOrganized?: (path: string) => void
  onCustomizeNoteListColumns?: () => void
  canCustomizeNoteListColumns?: boolean
  noteListColumnsLabel?: string
  onRestoreDeletedNote?: () => void
  canRestoreDeletedNote?: boolean
  onQuickOpen: () => void
  onCreateNote: () => void
  onCreateNoteOfType: (type: string) => void
  onSave: () => void
  onPastePlainText: () => void
  onOpenSettings: () => void
  onOpenVault?: () => void
  onCreateEmptyVault?: () => void
  onAddRemote?: () => void
  canAddRemote?: boolean
  isGitVault?: boolean
  onInitializeGit?: () => void
  onCreateType?: () => void
  onDeleteNote: (path: string) => void
  onArchiveNote: (path: string) => void
  onUnarchiveNote: (path: string) => void
  onCommitPush: () => void
  onPull?: () => void
  onResolveConflicts?: () => void
  onSetViewMode: (mode: ViewMode) => void
  onToggleInspector: () => void
  onToggleDiff?: () => void
  onToggleRawEditor?: () => void
  selectedViewName?: string
  onMoveSelectedViewUp?: () => void
  onMoveSelectedViewDown?: () => void
  canMoveSelectedViewUp?: boolean
  canMoveSelectedViewDown?: boolean
  onFindInNote?: () => void
  onReplaceInNote?: () => void
  noteWidth?: NoteWidthMode
  defaultNoteWidth?: NoteWidthMode
  onSetNoteWidth?: (mode: NoteWidthMode) => void
  onSetDefaultNoteWidth?: (mode: NoteWidthMode) => void
  activeNoteModified: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  zoomLevel: number
  onSelect: (sel: SidebarSelection) => void
  onRenameFolder?: () => void
  onDeleteFolder?: () => void
  onCopySelectedFolderPath?: () => void
  showInbox?: boolean
  onGoBack?: () => void
  onGoForward?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
  onRemoveActiveVault?: () => void
  onRestoreGettingStarted?: () => void
  isGettingStartedHidden?: boolean
  vaultCount?: number
  selection?: SidebarSelection
  noteListFilter?: NoteListFilter
  onSetNoteListFilter?: (filter: NoteListFilter) => void
}

export function useCommandRegistry(config: CommandRegistryConfig): import('./commands/types').CommandAction[] {
  const {
    activeTabPath, entries, modifiedCount,
    onQuickOpen, onCreateNote, onCreateNoteOfType, onSave, onPastePlainText, onOpenSettings,
    onDeleteNote, onArchiveNote, onUnarchiveNote,
    onCommitPush, onPull, onResolveConflicts, onSetViewMode, onToggleInspector, onToggleDiff, onToggleRawEditor, onFindInNote, onReplaceInNote,
    noteWidth, defaultNoteWidth, onSetNoteWidth, onSetDefaultNoteWidth, onOpenVault, onCreateEmptyVault,
    selectedViewName, onMoveSelectedViewUp, onMoveSelectedViewDown, canMoveSelectedViewUp, canMoveSelectedViewDown,
    activeNoteModified,
    onZoomIn, onZoomOut, onZoomReset, zoomLevel,
    onSelect, onRenameFolder, onDeleteFolder, onCopySelectedFolderPath,
    showInbox,
    onGoBack, onGoForward, canGoBack, canGoForward,
    onCreateType,
    onRemoveActiveVault, onRestoreGettingStarted, isGettingStartedHidden, vaultCount,
    mcpStatus, onInstallMcp, onOpenMcpSetup,
    onReloadVault, onRepairVault,
    locale, onSetThemeMode,
    onSetNoteIcon, onRemoveNoteIcon, activeNoteHasIcon, onChangeNoteType, onMoveNoteToFolder, canMoveNoteToFolder,
    onOpenInNewWindow, onCopyActiveFilePath, onToggleFavorite, onToggleOrganized,
    onCustomizeNoteListColumns, canCustomizeNoteListColumns,
    onRestoreDeletedNote, canRestoreDeletedNote,
    selection, noteListFilter, onSetNoteListFilter,
    isGitVault, onInitializeGit,
  } = config

  const hasActiveNote = activeTabPath !== null

  const activeEntry = useMemo(
    () => (hasActiveNote ? entries.find(e => e.path === activeTabPath) : undefined),
    [entries, activeTabPath, hasActiveNote],
  )
  const isArchived = activeEntry?.archived ?? false
  const isFavorite = activeEntry?.favorite ?? false
  const isSectionGroup = selection?.kind === 'sectionGroup'
  const noteListColumnsLabel = config.noteListColumnsLabel ?? (
    selection?.kind === 'filter' && selection.filter === 'all'
      ? 'Customize All Notes columns'
      : 'Customize Inbox columns'
  )

  const vaultTypes = useMemo(() => extractVaultTypes(entries), [entries])

  const navigationCommands = useMemo(() => buildNavigationCommands({
    onQuickOpen,
    onSelect,
    selection,
    onRenameFolder,
    onDeleteFolder,
    onCopySelectedFolderPath,
    showInbox,
    onGoBack,
    onGoForward,
    canGoBack,
    canGoForward,
  }), [
    onQuickOpen, onSelect, selection, onRenameFolder, onDeleteFolder,
    onCopySelectedFolderPath, showInbox,
    onGoBack, onGoForward, canGoBack, canGoForward,
  ])

  const noteCommands = useMemo(() => buildNoteCommands({
    hasActiveNote, activeTabPath, activeFileKind: activeEntry?.fileKind ?? 'markdown', isArchived,
    onCreateNote, onCreateType, onSave,
    onFindInNote, onReplaceInNote, onPastePlainText,
    onDeleteNote, onArchiveNote, onUnarchiveNote,
    onChangeNoteType, onMoveNoteToFolder, canMoveNoteToFolder,
    onSetNoteIcon, onRemoveNoteIcon, activeNoteHasIcon, onOpenInNewWindow,
    onCopyActiveFilePath,
    onToggleFavorite, isFavorite,
    onToggleOrganized, isOrganized: activeEntry?.organized ?? false,
    onRestoreDeletedNote, canRestoreDeletedNote,
  }), [
    hasActiveNote, activeTabPath, activeEntry?.fileKind, isArchived,
    onCreateNote, onCreateType, onSave, onFindInNote, onReplaceInNote, onPastePlainText, onDeleteNote, onArchiveNote, onUnarchiveNote,
    onChangeNoteType, onMoveNoteToFolder, canMoveNoteToFolder,
    onSetNoteIcon, onRemoveNoteIcon, activeNoteHasIcon, onOpenInNewWindow,
    onCopyActiveFilePath,
    onToggleFavorite, isFavorite,
    onToggleOrganized, activeEntry?.organized, onRestoreDeletedNote, canRestoreDeletedNote,
  ])

  const gitCommands = useMemo(() => buildGitCommands({
    modifiedCount,
    isGitVault,
    canAddRemote: config.canAddRemote ?? false,
    onAddRemote: config.onAddRemote,
    onCommitPush,
    onInitializeGit,
    onPull,
    onResolveConflicts,
    onSelect,
  }), [
    modifiedCount, isGitVault, config.canAddRemote, config.onAddRemote,
    onCommitPush, onInitializeGit, onPull, onResolveConflicts, onSelect,
  ])

  const viewCommands = useMemo(() => buildViewCommands({
    hasActiveNote, activeNoteModified, onSetViewMode, onToggleInspector,
    onToggleDiff, onToggleRawEditor, noteWidth, defaultNoteWidth, onSetNoteWidth, onSetDefaultNoteWidth, zoomLevel, onZoomIn, onZoomOut, onZoomReset,
    onCustomizeNoteListColumns, canCustomizeNoteListColumns, noteListColumnsLabel,
    selectedViewName, onMoveSelectedViewUp, onMoveSelectedViewDown, canMoveSelectedViewUp, canMoveSelectedViewDown,
  }), [
    hasActiveNote, activeNoteModified, onSetViewMode, onToggleInspector,
    onToggleDiff, onToggleRawEditor, noteWidth, defaultNoteWidth, onSetNoteWidth, onSetDefaultNoteWidth,
    zoomLevel, onZoomIn, onZoomOut, onZoomReset,
    onCustomizeNoteListColumns, canCustomizeNoteListColumns, noteListColumnsLabel,
    selectedViewName, onMoveSelectedViewUp, onMoveSelectedViewDown, canMoveSelectedViewUp, canMoveSelectedViewDown,
  ])

  const settingsCommands = useMemo(() => buildSettingsCommands({
    mcpStatus, vaultCount, isGettingStartedHidden,
    onOpenSettings, onOpenVault, onCreateEmptyVault, onRemoveActiveVault, onRestoreGettingStarted,
    onInstallMcp, onReloadVault, onRepairVault,
    locale, onSetThemeMode,
  }), [
    mcpStatus, vaultCount, isGettingStartedHidden, onOpenSettings,
    onOpenVault, onCreateEmptyVault, onRemoveActiveVault, onRestoreGettingStarted,
    onInstallMcp, onReloadVault, onRepairVault,
    locale, onSetThemeMode,
  ])

  const mcpCommands = useMemo(() => buildMcpCommands({
    onOpenMcpSetup,
  }), [onOpenMcpSetup])

  const typeCommands = useMemo(
    () => buildTypeCommands(vaultTypes, onCreateNoteOfType, onSelect),
    [vaultTypes, onCreateNoteOfType, onSelect],
  )
  const filterCommands = useMemo(
    () => buildFilterCommands({ isSectionGroup, noteListFilter, onSetNoteListFilter }),
    [isSectionGroup, noteListFilter, onSetNoteListFilter],
  )
  const commands = useMemo(() => [
    ...navigationCommands,
    ...noteCommands,
    ...gitCommands,
    ...viewCommands,
    ...settingsCommands,
    ...mcpCommands,
    ...typeCommands,
    ...filterCommands,
  ], [
    navigationCommands, noteCommands, gitCommands, viewCommands,
    settingsCommands, mcpCommands, typeCommands, filterCommands,
  ])

  return useMemo(() => localizeCommandActions(commands, locale), [commands, locale])
}
