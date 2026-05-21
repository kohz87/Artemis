import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { NoteList } from './components/NoteList'
import type { DeletedNoteEntry } from './components/note-list/noteListUtils'
import { Editor } from './components/Editor'
import { ResizeHandle } from './components/ResizeHandle'
import { CreateTypeDialog } from './components/CreateTypeDialog'
import { CreateViewDialog } from './components/CreateViewDialog'
import { QuickOpenPalette } from './components/QuickOpenPalette'
import { CommandPalette } from './components/CommandPalette'
import { SearchPanel } from './components/SearchPanel'
import { Toast } from './components/Toast'
import { CommitDialog } from './components/CommitDialog'
import { PulseView } from './components/PulseView'
import { StatusBar } from './components/StatusBar'
import { VaultMenu } from './components/status-bar/VaultMenu'
import { SettingsPanel } from './components/SettingsPanel'
import { CloneVaultModal } from './components/CloneVaultModal'
import { WelcomeScreen } from './components/WelcomeScreen'
import { TelemetryConsentDialog } from './components/TelemetryConsentDialog'
import { NoteRetargetingDialogs } from './components/note-retargeting/NoteRetargetingDialogs'
import { useTelemetry } from './hooks/useTelemetry'
import { useAutoGit } from './hooks/useAutoGit'
import { useVaultLoader } from './hooks/useVaultLoader'
import { useRecentVaultWrites, useVaultWatcher } from './hooks/useVaultWatcher'
import { useSettings } from './hooks/useSettings'
import { useNoteWidthMode } from './hooks/useNoteWidthMode'
import { useDocumentThemeMode } from './hooks/useDocumentThemeMode'
import { useThemeMode } from './hooks/useThemeMode'
import type { ThemeMode } from './lib/themeMode'
import { useNoteActions } from './hooks/useNoteActions'
import { planNewTypeCreation } from './hooks/useNoteCreation'
import { useCommitFlow } from './hooks/useCommitFlow'
import { useGitRemoteStatus } from './hooks/useGitRemoteStatus'
import { useViewMode, type ViewMode } from './hooks/useViewMode'
import { useEntryActions } from './hooks/useEntryActions'
import { useAppCommands } from './hooks/useAppCommands'
import { triggerCommitEntryAction } from './utils/commitEntryAction'
import { generateCommitMessage } from './utils/commitMessage'
import { useDialogs } from './hooks/useDialogs'
import { useVaultSwitcher } from './hooks/useVaultSwitcher'
import { useGitHistory } from './hooks/useGitHistory'
import { useAutoSync } from './hooks/useAutoSync'
import { useConflictResolver } from './hooks/useConflictResolver'
import { useZoom } from './hooks/useZoom'
import { useVaultConfig } from './hooks/useVaultConfig'
import { useBuildNumber } from './hooks/useBuildNumber'
import { useOnboarding } from './hooks/useOnboarding'
import { useGettingStartedClone } from './hooks/useGettingStartedClone'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { useAppNavigation } from './hooks/useAppNavigation'
import {
  applyMainWindowSizeConstraints,
  getMainWindowMinWidth,
  useMainWindowSizeConstraints,
} from './hooks/useMainWindowSizeConstraints'
import { useBulkActions } from './hooks/useBulkActions'
import { useDeleteActions } from './hooks/useDeleteActions'
import { useGitSetupGate } from './hooks/useGitSetupGate'
import { useRenameDetection } from './hooks/useRenameDetection'
import { useFolderActions } from './hooks/useFolderActions'
import { useFileActions } from './hooks/useFileActions'
import { useLayoutPanels } from './hooks/useLayoutPanels'
import { useConflictFlow } from './hooks/useConflictFlow'
import { useAppSave } from './hooks/useAppSave'
import { useNoteTargetFolder } from './hooks/useNoteTargetFolder'
import { useNoteRetargetingUi } from './hooks/useNoteRetargetingUi'
import { useVaultBridge } from './hooks/useVaultBridge'
import { useSavedViewOrdering } from './hooks/useSavedViewOrdering'
import { createViewFilename } from './utils/viewFilename'
import { nextViewOrder } from './utils/viewOrdering'
import type { CommitDiffRequest } from './hooks/useDiffMode'
import { ConflictResolverModal } from './components/ConflictResolverModal'
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog'
import { DeleteProgressNotice } from './components/DeleteProgressNotice'
import { invoke } from '@tauri-apps/api/core'
import {
  GitBranch,
  GitCommit,
  List,
  ListChecks,
  Menu,
  Moon,
  PanelLeft,
  Plus,
  RefreshCw,
  Search,
  Settings,
  X,
  type LucideIcon,
} from 'lucide-react'
import { isTauri, mockInvoke } from './mock-tauri'
import type { SidebarSelection, InboxPeriod, VaultEntry, ViewDefinition } from './types'
import { initializeNoteProperties } from './utils/initializeNoteProperties'
import { filterInboxEntries, type NoteListFilter } from './utils/noteListHelpers'
import { resolveAllNotesFileVisibility } from './utils/allNotesFileVisibility'
import { openNoteInNewWindow } from './utils/openNoteWindow'
import { refreshPulledVaultState } from './utils/pulledVaultRefresh'
import { isNoteWindow, getNoteWindowParams, getNoteWindowPathCandidates, type NoteWindowParams } from './utils/windowMode'
import { GitSetupDialog } from './components/GitRequiredModal'
import { RenameDetectedBanner } from './components/RenameDetectedBanner';
import { openNoteListPropertiesPicker } from './components/note-list/noteListPropertiesEvents'
import type { NoteListMultiSelectionCommands } from './components/note-list/multiSelectionCommands'
import { focusNoteIconPropertyEditor } from './components/noteIconPropertyEvents'
import { trackEvent } from './lib/telemetry'
import type { AppLocale } from './lib/i18n'
import { extractDeletedContentFromDiff } from './components/note-list/noteListUtils'
import { isActiveVaultUnavailableError } from './utils/vaultErrors'
import { hasNoteIconValue } from './utils/noteIcon'
import { filenameStemToTitle } from './utils/noteTitle'
import {
  focusNoteListContainer,
  isEditableElement,
  isEditorEscapeTarget,
  popNeighborhoodHistory,
  pushNeighborhoodHistory,
  shouldProcessNeighborhoodEscape,
} from './utils/neighborhoodHistory'
import {
  INBOX_SELECTION,
  isExplicitOrganizationEnabled,
  sanitizeSelectionForOrganization,
} from './utils/organizationWorkflow'
import { requestPlainTextPaste } from './utils/plainTextPaste'
import './App.css'

// Type declarations for mock content storage and test overrides
declare global {
  interface Window {
    __mockContent?: Record<string, string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock handler map for Playwright test overrides
    __mockHandlers?: Record<string, (args: any) => any>
  }
}

const DEFAULT_SELECTION: SidebarSelection = INBOX_SELECTION
const MOBILE_LAYOUT_QUERY = '(max-width: 760px)'

function isMobileLayoutViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_LAYOUT_QUERY).matches
}

function getNextVisibleInboxEntry(entries: VaultEntry[], currentPath: string): VaultEntry | null {
  const currentIndex = entries.findIndex((entry) => entry.path === currentPath)
  if (currentIndex < 0) return null
  return entries[currentIndex + 1] ?? null
}

function shouldPreferOnboardingVaultPath(
  onboardingState: { status: string; vaultPath?: string },
  vaults: Array<{ path: string }>,
): onboardingState is { status: 'ready'; vaultPath: string } {
  return onboardingState.status === 'ready'
    && typeof onboardingState.vaultPath === 'string'
    && onboardingState.vaultPath.length > 0
    && !vaults.some((vault) => vault.path === onboardingState.vaultPath)
}

async function resolveNoteWindowEntry(noteWindowParams: NoteWindowParams): Promise<VaultEntry | undefined> {
  for (const path of getNoteWindowPathCandidates(noteWindowParams)) {
    try {
      const request = { path, vaultPath: noteWindowParams.vaultPath }
      const entry = isTauri()
        ? await invoke<VaultEntry | null>('reload_vault_entry', request)
        : await mockInvoke<VaultEntry | null>('reload_vault_entry', request)
      if (entry) return entry
    } catch {
      // Try the next normalized candidate before reporting the note as unavailable.
    }
  }
}

async function loadNoteWindowContent(path: string, vaultPath: string): Promise<string> {
  const request = { path, vaultPath }
  if (!isTauri()) return mockInvoke<string>('get_note_content', request)

  await invoke('sync_vault_asset_scope_for_window', { vaultPath })
  return invoke<string>('get_note_content', request)
}

function createPulseDeletedNoteEntry(fullPath: string, relativePath: string): DeletedNoteEntry {
  const filename = relativePath.split('/').pop() ?? relativePath
  return {
    path: fullPath,
    filename,
    title: filenameStemToTitle(filename),
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: null,
    createdAt: null,
    fileSize: 0,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: null,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: true,
    fileKind: 'markdown',
    __deletedNotePreview: true,
    __deletedRelativePath: relativePath,
    __changeAddedLines: null,
    __changeDeletedLines: null,
    __changeBinary: false,
  }
}

/** Wraps useEditorSave to also keep outgoingLinks in sync on save and on content change. */
function App() {
  const noteWindowParams = useMemo(() => isNoteWindow() ? getNoteWindowParams() : null, [])
  const [selection, setSelection] = useState<SidebarSelection>(DEFAULT_SELECTION)
  const [noteListFilter, setNoteListFilter] = useState<NoteListFilter>('open')
  const selectionRef = useRef<SidebarSelection>(DEFAULT_SELECTION)
  const neighborhoodHistoryRef = useRef<SidebarSelection[]>([])
  const inboxPeriod: InboxPeriod = 'all'
  const handleSetSelection = useCallback((sel: SidebarSelection, options?: { preserveNeighborhoodHistory?: boolean }) => {
    if (!options?.preserveNeighborhoodHistory && sel.kind !== 'entity') {
      neighborhoodHistoryRef.current = []
    }
    setSelection(sel)
    setNoteListFilter('open')
  }, [])
  const handleEnterNeighborhood = useCallback((entry: VaultEntry) => {
    const nextSelection: SidebarSelection = { kind: 'entity', entry }
    neighborhoodHistoryRef.current = pushNeighborhoodHistory(
      neighborhoodHistoryRef.current,
      selectionRef.current,
      nextSelection,
    )
    handleSetSelection(nextSelection, { preserveNeighborhoodHistory: true })
  }, [handleSetSelection])
  const layout = useLayoutPanels(noteWindowParams ? { initialInspectorCollapsed: true } : undefined)
  const { setInspectorCollapsed } = layout
  const { viewMode, setViewMode, sidebarVisible, noteListVisible } = useViewMode(noteWindowParams ? 'editor-only' : undefined)
  const updateMainWindowConstraints = useCallback((
    nextSidebarVisible: boolean,
    nextNoteListVisible: boolean,
    nextInspectorCollapsed: boolean = layout.inspectorCollapsed,
  ) => {
    if (noteWindowParams || !isTauri()) return

    const minWidth = getMainWindowMinWidth({
      sidebarVisible: nextSidebarVisible,
      noteListVisible: nextNoteListVisible,
      inspectorCollapsed: nextInspectorCollapsed,
      sidebarWidth: layout.sidebarWidth,
      noteListWidth: layout.noteListWidth,
      inspectorWidth: layout.inspectorWidth,
    })

    void applyMainWindowSizeConstraints(minWidth).catch((err) => console.warn('[window] Size constraints failed:', err))
  }, [layout.inspectorCollapsed, layout.inspectorWidth, layout.noteListWidth, layout.sidebarWidth, noteWindowParams])

  const handleSetViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    updateMainWindowConstraints(mode === 'all', mode !== 'editor-only')
  }, [setViewMode, updateMainWindowConstraints])

  const handleCollapseSidebar = useCallback(() => {
    handleSetViewMode('editor-list')
  }, [handleSetViewMode])

  const handleMobileSidebarSelection = useCallback((sel: SidebarSelection) => {
    handleSetSelection(sel)
    if (isMobileLayoutViewport()) handleSetViewMode('editor-list')
  }, [handleSetSelection, handleSetViewMode])
  const visibleNotesRef = useRef<VaultEntry[]>([])
  const multiSelectionCommandRef = useRef<NoteListMultiSelectionCommands | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const dialogs = useDialogs()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const networkStatus = useNetworkStatus()

  // onSwitch closure captures `notes` declared below - safe because it's only
  // called on user interaction, never during render (refs inside the hook
  // guarantee the latest closure is always used).
  const vaultSwitcher = useVaultSwitcher({
    onSwitch: () => {
      if (noteWindowParams) return
      handleSetSelection(DEFAULT_SELECTION)
      notes.closeAllTabs()
    },
    onToast: (msg) => setToastMessage(msg),
  })
  const {
    allVaults,
    registerVaultSelection,
    selectedVaultPath,
    syncVaultSelection,
    switchVault,
  } = vaultSwitcher

  const rememberVaultChoice = useCallback((vaultPath: string) => {
    if (!vaultPath) return

    if (allVaults.some((vault) => vault.path === vaultPath)) {
      switchVault(vaultPath)
      return
    }

    const label = vaultPath.split('/').filter(Boolean).pop() || 'Local Vault'
    syncVaultSelection(vaultPath, label)
  }, [allVaults, switchVault, syncVaultSelection])

  const handleGettingStartedVaultReady = useCallback((vaultPath: string) => {
    rememberVaultChoice(vaultPath)
    setToastMessage(`Getting Started vault cloned and opened at ${vaultPath}`)
  }, [rememberVaultChoice])

  const handleOnboardingVaultReady = useCallback((vaultPath: string, source: 'template' | 'empty' | 'existing') => {
    rememberVaultChoice(vaultPath)
    if (source === 'template') {
      setToastMessage(`Getting Started vault cloned and opened at ${vaultPath}`)
    }
  }, [rememberVaultChoice])
  const cloneGettingStartedVault = useGettingStartedClone({
    onError: (message) => setToastMessage(message),
    onSuccess: handleGettingStartedVaultReady,
  })
  const onboarding = useOnboarding(vaultSwitcher.vaultPath, {
    onVaultReady: handleOnboardingVaultReady,
    registerVault: registerVaultSelection,
  }, vaultSwitcher.loaded)

  // Onboarding can briefly own the vault path for a newly created/opened vault
  // before the persisted switcher catches up, but once the path is already in
  // the switcher list we should trust the explicit switcher state.
  const resolvedPath = noteWindowParams?.vaultPath ?? (
    shouldPreferOnboardingVaultPath(onboarding.state, vaultSwitcher.allVaults)
      ? onboarding.state.vaultPath
      : vaultSwitcher.vaultPath
  )
  const gitSetup = useGitSetupGate({ vaultPath: resolvedPath, noteWindowParams, onToast: setToastMessage })

  const vault = useVaultLoader(noteWindowParams ? '' : resolvedPath)
  const runtimeMissingVaultPath = !noteWindowParams ? vault.unavailableVaultPath : null
  const {
    markInternalWrite: markRecentVaultWrite,
    filterExternalPaths: filterExternalVaultPaths,
  } = useRecentVaultWrites({ vaultPath: noteWindowParams ? '' : resolvedPath })
  const { config: vaultConfig, updateConfig } = useVaultConfig(resolvedPath)
  const explicitOrganizationEnabled = isExplicitOrganizationEnabled(vaultConfig.inbox?.explicitOrganization)
  const effectiveSelection = sanitizeSelectionForOrganization(selection, vaultConfig.inbox?.explicitOrganization)

  useEffect(() => {
    selectionRef.current = effectiveSelection
  }, [effectiveSelection])

  useEffect(() => {
    if (effectiveSelection !== selection) {
      if (effectiveSelection.kind !== 'entity') {
        neighborhoodHistoryRef.current = []
      }
      setSelection(effectiveSelection)
      setNoteListFilter('open')
    }
  }, [effectiveSelection, selection])

  const handleNeighborhoodHistoryBack = useCallback(() => {
    const { previousSelection, nextHistory } = popNeighborhoodHistory(neighborhoodHistoryRef.current)
    if (!previousSelection) return false

    neighborhoodHistoryRef.current = nextHistory
    handleSetSelection(previousSelection, { preserveNeighborhoodHistory: true })
    requestAnimationFrame(() => {
      focusNoteListContainer(document)
    })
    return true
  }, [handleSetSelection])

  const handleSaveExplicitOrganization = useCallback((enabled: boolean) => {
    updateConfig('inbox', {
      noteListProperties: vaultConfig.inbox?.noteListProperties ?? null,
      explicitOrganization: enabled,
    })
  }, [updateConfig, vaultConfig.inbox?.noteListProperties])
  const { settings, loaded: settingsLoaded, saveSettings } = useSettings()
  const appLocale: AppLocale = 'en'
  const allNotesFileVisibility = useMemo(
    () => resolveAllNotesFileVisibility(settings),
    [settings],
  )
  useEffect(() => {
    document.documentElement.lang = appLocale
  }, [appLocale])
  useThemeMode(settings.theme_mode, settingsLoaded)
  const documentThemeMode = useDocumentThemeMode()
  const handleToggleThemeMode = useCallback(() => {
    const theme_mode = documentThemeMode === 'dark' ? 'light' : 'dark'
    void saveSettings({ ...settings, theme_mode })
  }, [documentThemeMode, saveSettings, settings])
  const handleSetThemeMode = useCallback((theme_mode: ThemeMode) => {
    if (!settingsLoaded) return
    void saveSettings({ ...settings, theme_mode })
  }, [saveSettings, settings, settingsLoaded])
  useTelemetry(settings, settingsLoaded)

  const vaultOpenedRef = useRef('')
  useEffect(() => {
    if (vault.entries.length > 0 && gitSetup.gitRepoState !== 'checking' && resolvedPath !== vaultOpenedRef.current) {
      vaultOpenedRef.current = resolvedPath
      trackEvent('vault_opened', { has_git: gitSetup.gitRepoState === 'ready' ? 1 : 0, note_count: vault.entries.length })
    }
  }, [vault.entries.length, gitSetup.gitRepoState, resolvedPath])
  const gitRemoteStatus = useGitRemoteStatus(resolvedPath)
  const loadVaultModifiedFiles = vault.loadModifiedFiles
  const refreshGitRemoteStatus = gitRemoteStatus.refreshRemoteStatus

  useEffect(() => {
    if (gitSetup.gitRepoState !== 'ready') return
    void loadVaultModifiedFiles()
    void refreshGitRemoteStatus()
  }, [gitSetup.gitRepoState, loadVaultModifiedFiles, refreshGitRemoteStatus])







  const renameDetection = useRenameDetection({
    vaultPath: resolvedPath,
    isNoteWindow: !!noteWindowParams,
    onToast: setToastMessage,
    onVaultReload: vault.reloadVault,
  })

  const conflictResolver = useConflictResolver({
    vaultPath: resolvedPath,
    onResolved: () => {
      dialogs.closeConflictResolver()
      autoSync.resumePull()
      vault.reloadVault()
      autoSync.triggerSync()
    },
    onToast: (msg) => setToastMessage(msg),
    onOpenFile: (relativePath) => conflictFlow.openConflictFileRef.current(relativePath),
  })
  const flushPendingEditorContentRef = useRef<((path: string) => void) | null>(null)
  const flushPendingRawContentRef = useRef<((path: string) => void) | null>(null)
  const flushEditorStateBeforeAction = async (path: string) => {
    flushPendingEditorContentRef.current?.(path)
    flushPendingRawContentRef.current?.(path)
    await appSave.flushBeforeAction(path)
  }
  const handleCreatedVaultEntryPersisting = useCallback((path: string) => {
    markRecentVaultWrite(path)
    vault.addPendingSave(path)
  }, [markRecentVaultWrite, vault])
  const handleCreatedVaultEntryPersisted = useCallback((path: string) => {
    markRecentVaultWrite(path)
    vault.loadModifiedFiles()
  }, [markRecentVaultWrite, vault])
  const handleMissingActiveVault = useCallback(() => {
    if (!noteWindowParams && resolvedPath) vault.markVaultUnavailable(resolvedPath)
  }, [noteWindowParams, resolvedPath, vault])
  const noteTargetFolderPath = useNoteTargetFolder({ selection: effectiveSelection, vaultPath: resolvedPath })

  const notes = useNoteActions({
    addEntry: vault.addEntry,
    removeEntry: vault.removeEntry,
    entries: vault.entries,
    flushBeforeNoteSwitch: flushEditorStateBeforeAction,
    flushBeforeNoteMutation: flushEditorStateBeforeAction,
    reloadVault: vault.reloadVault,
    setToastMessage,
    updateEntry: vault.updateEntry,
    vaultPath: resolvedPath,
    targetFolderPath: noteTargetFolderPath,
    addPendingSave: handleCreatedVaultEntryPersisting,
    removePendingSave: vault.removePendingSave,
    trackUnsaved: vault.trackUnsaved,
    clearUnsaved: vault.clearUnsaved,
    unsavedPaths: vault.unsavedPaths,
    markContentPending: (path, content) => appSave.contentChangeRef.current(path, content),
    onNewNotePersisted: handleCreatedVaultEntryPersisted,
    onMissingActiveVault: handleMissingActiveVault,
    onTypeStateChanged: async () => { await vault.reloadVault() },
    replaceEntry: vault.replaceEntry,
    onFrontmatterPersisted: vault.loadModifiedFiles,
    onPathRenamed: (oldPath, newPath) => appSave.trackRenamedPath(oldPath, newPath),
  })
  const {
    handleCreateNoteImmediate,
    handleSelectNote,
    handleReplaceActiveTab,
    closeAllTabs,
    openTabWithContent,
  } = notes
  const handleMobileSelectNote = useCallback((entry: VaultEntry) => {
    handleSelectNote(entry)
    if (isMobileLayoutViewport()) handleSetViewMode('editor-only')
  }, [handleSelectNote, handleSetViewMode])
  const handleMobileCreateNote = useCallback(() => {
    void handleCreateNoteImmediate()
    if (isMobileLayoutViewport()) handleSetViewMode('editor-only')
  }, [handleCreateNoteImmediate, handleSetViewMode])
  const handleMobileOpenChanges = useCallback(() => {
    handleSetSelection({ kind: 'filter', filter: 'changes' })
    if (isMobileLayoutViewport()) handleSetViewMode('editor-list')
  }, [handleSetSelection, handleSetViewMode])
  const handleMobileOpenPulse = useCallback(() => {
    handleSetSelection({ kind: 'filter', filter: 'pulse' })
    if (isMobileLayoutViewport()) handleSetViewMode('editor-list')
  }, [handleSetSelection, handleSetViewMode])
  const noteWindowActionsRef = useRef({ handleSelectNote, openTabWithContent })
  useEffect(() => {
    noteWindowActionsRef.current = { handleSelectNote, openTabWithContent }
  }, [handleSelectNote, openTabWithContent])
  const handlePulledVaultUpdate = useCallback(async (updatedFiles: string[]) => {
    await refreshPulledVaultState({
      activeTabPath: notes.activeTabPath,
      closeAllTabs,
      getActiveTabPath: () => notes.activeTabPathRef.current,
      hasUnsavedChanges: (path) => vault.unsavedPaths.has(path),
      reloadFolders: vault.reloadFolders,
      reloadVault: vault.reloadVault,
      reloadViews: vault.reloadViews,
      replaceActiveTab: handleReplaceActiveTab,
      updatedFiles,
      vaultPath: resolvedPath,
    })
  }, [
      closeAllTabs,
      handleReplaceActiveTab,
      notes.activeTabPath,
      notes.activeTabPathRef,
      resolvedPath,
      vault.reloadFolders,
      vault.reloadVault,
      vault.reloadViews,
      vault.unsavedPaths,
    ])
  useVaultWatcher({
    vaultPath: noteWindowParams ? '' : resolvedPath,
    onVaultChanged: handlePulledVaultUpdate,
    filterChangedPaths: filterExternalVaultPaths,
  })
  const autoSync = useAutoSync({
    enabled: gitSetup.gitRepoState === 'ready',
    vaultPath: resolvedPath,
    intervalMinutes: settings.auto_pull_interval_minutes,
    onVaultUpdated: handlePulledVaultUpdate,
    onConflict: (files) => {
      const names = files.map((f) => f.split('/').pop()).join(', ')
      setToastMessage(`Conflict in ${names} - click to resolve`)
    },
    onToast: (msg) => setToastMessage(msg),
  })
  const pendingDiffRequestIdRef = useRef(0)
  const [pendingDiffRequest, setPendingDiffRequest] = useState<CommitDiffRequest | null>(null)

  // Note window: auto-open the note from URL params without scanning the whole vault.
  const noteWindowOpenedRef = useRef(false)
  const noteWindowMissingPathRef = useRef<string | null>(null)
  useEffect(() => {
    if (!noteWindowParams || noteWindowOpenedRef.current) return

    void resolveNoteWindowEntry(noteWindowParams).then(async (entry) => {
      if (noteWindowOpenedRef.current) return
      if (entry) {
        try {
          const content = await loadNoteWindowContent(entry.path, noteWindowParams.vaultPath)
          if (noteWindowOpenedRef.current) return
          noteWindowOpenedRef.current = true
          noteWindowMissingPathRef.current = null
          noteWindowActionsRef.current.openTabWithContent(entry, content)
        } catch {
          if (noteWindowOpenedRef.current) return
          noteWindowOpenedRef.current = true
          noteWindowMissingPathRef.current = null
          void noteWindowActionsRef.current.handleSelectNote(entry)
        }
        return
      }
      if (noteWindowMissingPathRef.current === noteWindowParams.notePath) return
      noteWindowMissingPathRef.current = noteWindowParams.notePath
      setToastMessage(`Could not open "${noteWindowParams.noteTitle}" in this window`)
    })
  }, [noteWindowParams, setToastMessage])

  // Note window: update window title when active note changes
  useEffect(() => {
    if (!noteWindowParams) return
    const activeEntry = notes.tabs.find(t => t.entry.path === notes.activeTabPath)?.entry
    const title = activeEntry?.title ?? noteWindowParams.noteTitle
    if (!isTauri()) { document.title = title; return }
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().setTitle(title)
    }).catch((err) => console.warn('[window] Failed to update note window title:', err))
  }, [noteWindowParams, notes.tabs, notes.activeTabPath])

  // Keep note entry in sync with vault entries so banners (trash/archive)
  // and read-only state react immediately without reopening the note.
  useEffect(() => {
    notes.setTabs(prev => {
      let changed = false
      const next = prev.map(tab => {
        const fresh = vault.entries.find(e => e.path === tab.entry.path)
        if (fresh && fresh !== tab.entry) {
          changed = true
          return { ...tab, entry: fresh }
        }
        return tab
      })
      return changed ? next : prev
    })
  }, [vault.entries]) // eslint-disable-line react-hooks/exhaustive-deps -- notes.setTabs is stable (useState setter)

  const { handleGoBack, handleGoForward, canGoBack, canGoForward, entriesByPath } = useAppNavigation({
    entries: vault.entries,
    activeTabPath: notes.activeTabPath,
    onSelectNote: handleMobileSelectNote,
  })

  const queuePendingDiff = useCallback((path: string, commitHash?: string) => {
    pendingDiffRequestIdRef.current += 1
    setPendingDiffRequest({
      requestId: pendingDiffRequestIdRef.current,
      path,
      commitHash,
    })
  }, [])

  const handlePendingDiffHandled = useCallback((requestId: number) => {
    setPendingDiffRequest((current) =>
      current?.requestId === requestId ? null : current,
    )
  }, [])

  const handlePulseOpenNote = useCallback((relativePath: string, commitHash?: string) => {
    const fullPath = `${resolvedPath}/${relativePath}`
    const entry = entriesByPath.get(fullPath) ?? entriesByPath.get(relativePath)

    if (commitHash) {
      const targetPath = entry?.path ?? fullPath
      queuePendingDiff(targetPath, commitHash)
      if (entry) {
        void handleSelectNote(entry)
      } else {
        openTabWithContent(createPulseDeletedNoteEntry(fullPath, relativePath), 'Content not available')
      }
      return
    }

    if (entry) {
      void handleSelectNote(entry)
    }
  }, [entriesByPath, resolvedPath, queuePendingDiff, handleSelectNote, openTabWithContent])

  const handleOpenFavorite = useCallback(async (entry: VaultEntry) => {
    await handleReplaceActiveTab(entry)
    handleEnterNeighborhood(entry)
  }, [handleEnterNeighborhood, handleReplaceActiveTab])

  useVaultBridge({
    entriesByPath,
    resolvedPath,
    reloadVault: vault.reloadVault,
    onSelectNote: notes.handleSelectNote,
  })

  const conflictFlow = useConflictFlow({
    resolvedPath, entries: vault.entries,
    conflictFiles: autoSync.conflictFiles,
    pausePull: autoSync.pausePull, resumePull: autoSync.resumePull,
    triggerSync: autoSync.triggerSync, reloadVault: vault.reloadVault,
    initConflictFiles: conflictResolver.initFiles,
    openConflictResolver: dialogs.openConflictResolver,
    closeConflictResolver: dialogs.closeConflictResolver,
    onSelectNote: notes.handleSelectNote,
    activeTabPath: notes.activeTabPath,
    setToastMessage,
  })

  const appSave = useAppSave({
    updateEntry: vault.updateEntry, setTabs: notes.setTabs, handleSwitchTab: notes.handleSwitchTab, setToastMessage,
    loadModifiedFiles: vault.loadModifiedFiles, reloadViews: async () => { await vault.reloadViews() },
    trackUnsaved: vault.trackUnsaved, clearUnsaved: vault.clearUnsaved, unsavedPaths: vault.unsavedPaths,
    tabs: notes.tabs, activeTabPath: notes.activeTabPath,
    handleRenameNote: notes.handleRenameNote, handleRenameFilename: notes.handleRenameFilename,
    replaceEntry: vault.replaceEntry, resolvedPath,
    initialH1AutoRenameEnabled: settings.initial_h1_auto_rename_enabled !== false,
    onInternalVaultWrite: markRecentVaultWrite,
    locale: appLocale,
  })


  const handleInitializeProperties = useCallback(async (path: string) => {
    await initializeNoteProperties(notes.handleUpdateFrontmatter, path)
  }, [notes])

  const handleRemoveNoteIcon = useCallback(async (path: string) => {
    await notes.handleDeleteProperty(path, 'icon')
  }, [notes])

  const handleSetNoteIconCommand = useCallback(() => {
    setInspectorCollapsed(false)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        focusNoteIconPropertyEditor()
      })
    })
  }, [setInspectorCollapsed])

  const handleCustomizeNoteListColumns = useCallback(() => {
    if (effectiveSelection.kind === 'view') {
      openNoteListPropertiesPicker('view')
      return
    }

    if (effectiveSelection.kind !== 'filter') return
    if (effectiveSelection.filter === 'all') {
      openNoteListPropertiesPicker('all')
      return
    }
    if (effectiveSelection.filter === 'inbox') {
      openNoteListPropertiesPicker('inbox')
    }
  }, [effectiveSelection])

  const handleUpdateAllNotesNoteListProperties = useCallback((value: string[] | null) => {
    updateConfig('allNotes', {
      ...(vaultConfig.allNotes ?? { noteListProperties: null }),
      noteListProperties: value && value.length > 0 ? value : null,
    })
  }, [updateConfig, vaultConfig.allNotes])

  const handleUpdateInboxNoteListProperties = useCallback((value: string[] | null) => {
    updateConfig('inbox', {
      ...(vaultConfig.inbox ?? { noteListProperties: null }),
      noteListProperties: value && value.length > 0 ? value : null,
    })
  }, [updateConfig, vaultConfig.inbox])

  const handleCreateFolder = useCallback(async (name: string) => {
    try {
      if (isTauri()) {
        await invoke('create_vault_folder', { vaultPath: resolvedPath, folderName: name })
      } else {
        await mockInvoke('create_vault_folder', { vaultPath: resolvedPath, folderName: name })
      }
      await vault.reloadFolders()
      setToastMessage(`Created folder "${name}"`)
      return true
    } catch (e) {
      setToastMessage(`Failed to create folder: ${e}`)
      return false
    }
  }, [resolvedPath, vault, setToastMessage])

  const folderActions = useFolderActions({
    vaultPath: resolvedPath,
    selection: effectiveSelection,
    setSelection: handleSetSelection,
    setTabs: notes.setTabs,
    activeTabPathRef: notes.activeTabPathRef,
    handleSwitchTab: notes.handleSwitchTab,
    closeAllTabs: notes.closeAllTabs,
    reloadVault: vault.reloadVault,
    reloadFolders: vault.reloadFolders,
    setToastMessage,
  })
  const fileActions = useFileActions({
    selection: effectiveSelection,
    setToastMessage,
    vaultPath: resolvedPath,
  })

  const handleRemoveNoteIconCommand = useCallback(() => {
    if (notes.activeTabPath) handleRemoveNoteIcon(notes.activeTabPath)
  }, [notes.activeTabPath, handleRemoveNoteIcon])

  const handleOpenInNewWindow = useCallback(() => {
    const activeTab = notes.tabs.find(t => t.entry.path === notes.activeTabPath)
    if (activeTab) openNoteInNewWindow(activeTab.entry.path, resolvedPath, activeTab.entry.title)
  }, [notes.tabs, notes.activeTabPath, resolvedPath])

  const handleOpenEntryInNewWindow = useCallback((entry: { path: string; title: string }) => {
    openNoteInNewWindow(entry.path, resolvedPath, entry.title)
  }, [resolvedPath])

  const handleDiscardFile = useCallback(async (relativePath: string) => {
    const targetFile = vault.modifiedFiles.find((file) => file.relativePath === relativePath)
    const activePathBefore = notes.activeTabPath
    try {
      if (isTauri()) {
        await invoke('git_discard_file', { vaultPath: resolvedPath, relativePath })
      } else {
        await mockInvoke('git_discard_file', { vaultPath: resolvedPath, relativePath })
      }
      const reloadedEntries = await vault.reloadVault()
      const affectedActiveTab = !!activePathBefore
        && (activePathBefore === targetFile?.path || activePathBefore.endsWith('/' + relativePath))
      if (!affectedActiveTab) return
      const refreshedEntry = reloadedEntries.find((entry) =>
        entry.path === targetFile?.path || entry.path.endsWith('/' + relativePath),
      )
      if (refreshedEntry) {
        await notes.handleReplaceActiveTab(refreshedEntry)
      } else {
        notes.closeAllTabs()
      }
    } catch (err) {
      setToastMessage(typeof err === 'string' ? err : 'Failed to discard changes')
    }
  }, [resolvedPath, vault, notes, setToastMessage])

  const handleOpenDeletedNote = useCallback(async (entry: DeletedNoteEntry) => {
    let previewContent = 'Content not available (untracked)'
    let hasDiff = false
    try {
      const diff = await vault.loadDiff(entry.path)
      hasDiff = diff.length > 0
      previewContent = extractDeletedContentFromDiff(diff) ?? previewContent
    } catch (err) {
      console.warn('Failed to load deleted note preview:', err)
    }
    notes.openTabWithContent(entry, previewContent)
    if (hasDiff) {
      queuePendingDiff(entry.path)
    } else {
      setToastMessage('Content not available (untracked)')
    }
  }, [vault, notes, queuePendingDiff, setToastMessage])

  const handleReplaceActiveTabWithQueuedDiff = useCallback((entry: VaultEntry) => {
    notes.handleReplaceActiveTab(entry)
    if (effectiveSelection.kind === 'filter' && effectiveSelection.filter === 'changes') {
      queuePendingDiff(entry.path)
    }
  }, [effectiveSelection, notes, queuePendingDiff])

  const commitFlow = useCommitFlow({
    savePending: appSave.savePending,
    loadModifiedFiles: vault.loadModifiedFiles,
    resolveRemoteStatus: gitRemoteStatus.refreshRemoteStatus,
    setToastMessage,
    onPushRejected: autoSync.handlePushRejected,
    vaultPath: resolvedPath,
  })
  const suggestedCommitMessage = useMemo(() => generateCommitMessage(vault.modifiedFiles), [vault.modifiedFiles])
  const isGitVault = gitSetup.gitRepoState !== 'missing'
  const shouldShowGitSetupDialog = !noteWindowParams && gitSetup.gitRepoState === 'missing' && gitSetup.showGitSetupDialog
  const modifiedFilesSignature = useMemo(
    () => vault.modifiedFiles.map((file) => `${file.relativePath}:${file.status}`).sort().join('|'),
    [vault.modifiedFiles],
  )
  const autoGit = useAutoGit({
    enabled: settings.autogit_enabled === true,
    idleThresholdSeconds: settings.autogit_idle_threshold_seconds ?? 90,
    inactiveThresholdSeconds: settings.autogit_inactive_threshold_seconds ?? 30,
    isGitVault,
    hasPendingChanges: vault.modifiedFiles.length > 0
      || ((autoSync.remoteStatus?.hasRemote ?? false) && (autoSync.remoteStatus?.ahead ?? 0) > 0),
    hasUnsavedChanges: vault.unsavedPaths.size > 0,
    onCheckpoint: () => commitFlow.runAutomaticCheckpoint(),
  })
  const recordAutoGitActivity = autoGit.recordActivity
  const openCommitDialog = commitFlow.openCommitDialog
  const runAutomaticCheckpoint = commitFlow.runAutomaticCheckpoint
  const handleAppContentChange = appSave.handleContentChange
  const handleAppSave = appSave.handleSave
  const loadModifiedFiles = vault.loadModifiedFiles

  useEffect(() => {
    if (modifiedFilesSignature.length === 0) return
    recordAutoGitActivity()
  }, [modifiedFilesSignature, recordAutoGitActivity])

  const handleCommitPush = useCallback(() => {
    triggerCommitEntryAction({
      autoGitEnabled: settings.autogit_enabled === true,
      openCommitDialog,
      runAutomaticCheckpoint,
    })
  }, [openCommitDialog, runAutomaticCheckpoint, settings.autogit_enabled])

  const handleTrackedContentChange = useCallback((path: string, content: string) => {
    recordAutoGitActivity()
    handleAppContentChange(path, content)
  }, [handleAppContentChange, recordAutoGitActivity])

  const handleTrackedSave = useCallback(async (...args: Parameters<typeof handleAppSave>) => {
    if (notes.activeTabPath) {
      flushPendingEditorContentRef.current?.(notes.activeTabPath)
      flushPendingRawContentRef.current?.(notes.activeTabPath)
    }
    const result = await handleAppSave(...args)
    recordAutoGitActivity()
    return result
  }, [handleAppSave, notes.activeTabPath, recordAutoGitActivity])

  const seedAutoGitSavedChange = useCallback(async () => {
    if (isTauri()) {
      throw new Error('seedAutoGitSavedChange is only available in browser smoke tests')
    }

    const activePath = notes.activeTabPath
    const activeTab = activePath
      ? notes.tabs.find((tab) => tab.entry.path === activePath)
      : null

    if (!activePath || !activeTab) {
      throw new Error('No active note is available for the AutoGit test bridge')
    }

    const saveNoteContent = window.__mockHandlers?.save_note_content
    if (typeof saveNoteContent === 'function') {
      await Promise.resolve(saveNoteContent({ path: activePath, content: activeTab.content }))
    } else {
      await mockInvoke('save_note_content', { path: activePath, content: activeTab.content })
    }

    await loadModifiedFiles()
    recordAutoGitActivity()
  }, [loadModifiedFiles, notes.activeTabPath, notes.tabs, recordAutoGitActivity])

  useEffect(() => {
    window.__laputaTest = {
      ...window.__laputaTest,
      activeTabPath: notes.activeTabPath,
      seedAutoGitSavedChange,
    }

    return () => {
      if (window.__laputaTest?.seedAutoGitSavedChange === seedAutoGitSavedChange) {
        delete window.__laputaTest.seedAutoGitSavedChange
      }
    }
  }, [notes.activeTabPath, seedAutoGitSavedChange])

  const entryActions = useEntryActions({
    entries: vault.entries, updateEntry: vault.updateEntry,
    handleUpdateFrontmatter: notes.handleUpdateFrontmatter,
    handleDeleteProperty: notes.handleDeleteProperty, setToastMessage,
    createTypeEntry: notes.createTypeEntrySilent,
    onBeforeAction: flushEditorStateBeforeAction,
  })

  const deleteActions = useDeleteActions({
    onDeselectNote: (path: string) => { if (notes.activeTabPath === path) notes.closeAllTabs() },
    removeEntry: vault.removeEntry,
    removeEntries: vault.removeEntries,
    refreshModifiedFiles: vault.loadModifiedFiles,
    reloadVault: vault.reloadVault,
    setToastMessage,
  })

  const handleDeleteType = useCallback((typeName: string) => {
    const typeEntry = vault.entries.find((entry) => entry.isA === 'Type' && entry.title === typeName)
    if (!typeEntry) return

    trackEvent('sidebar_type_delete_requested')
    deleteActions.handleDeleteNote(typeEntry.path)
  }, [deleteActions, vault.entries])

  const shouldLoadGitHistory = !layout.inspectorCollapsed
  const gitHistory = useGitHistory(notes.activeTabPath, vault.loadGitHistory, shouldLoadGitHistory)

  const handleCreateType = useCallback(async (name: string) => {
    const created = await notes.handleCreateType(name)
    if (created) setToastMessage(`Type "${name}" created`)
    return created
  }, [notes, setToastMessage])

  const handleCreateMissingType = useCallback(async (path: string, missingType: string, nextTypeName: string) => {
    const trimmed = nextTypeName.trim()
    if (!trimmed) return false

    const plan = planNewTypeCreation({ entries: vault.entries, typeName: trimmed, vaultPath: resolvedPath })
    if (plan.status === 'blocked') {
      setToastMessage(plan.message)
      return false
    }

    let resolvedTypeName = plan.status === 'existing' ? plan.entry.title : trimmed

    if (plan.status === 'create') {
      try {
        resolvedTypeName = (await notes.createTypeEntrySilent(trimmed)).title
      } catch {
        return false
      }
    }

    await notes.handleUpdateFrontmatter(path, 'type', resolvedTypeName)
    setToastMessage(
      plan.status === 'create' && resolvedTypeName === missingType
        ? `Type "${resolvedTypeName}" created`
        : `Type set to "${resolvedTypeName}"`,
    )
    return true
  }, [notes, resolvedPath, setToastMessage, vault.entries])

  const handleCreateOrUpdateView = useCallback(async (definition: ViewDefinition) => {
    const editing = dialogs.editingView
    const filename = editing
      ? editing.filename
      : createViewFilename(definition.name, vault.views.map((view) => view.filename))
    const nextDefinition = editing
      ? { ...editing.definition, ...definition }
      : { ...definition, order: nextViewOrder(vault.views) }
    const target = isTauri() ? invoke : mockInvoke
    try {
      await target('save_view_cmd', { vaultPath: resolvedPath, filename, definition: nextDefinition })
      trackEvent(editing ? 'view_updated' : 'view_created')
      await vault.reloadViews()
      await vault.reloadVault()
      vault.reloadFolders()
      setToastMessage(editing ? `View "${nextDefinition.name}" updated` : `View "${nextDefinition.name}" created`)
      handleSetSelection({ kind: 'view', filename })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setToastMessage(`Could not save view: ${message}`)
      return false
    }
  }, [resolvedPath, vault, handleSetSelection, dialogs.editingView, setToastMessage])

  const handleUpdateViewDefinition = useCallback(async (filename: string, patch: Partial<ViewDefinition>) => {
    const existing = vault.views.find((view) => view.filename === filename)
    if (!existing) return

    const target = isTauri() ? invoke : mockInvoke
    await target('save_view_cmd', {
      vaultPath: resolvedPath,
      filename,
      definition: { ...existing.definition, ...patch },
    })
    await vault.reloadViews()
  }, [resolvedPath, vault])

  const handleSidebarUpdateViewDefinition = useCallback((filename: string, patch: Partial<ViewDefinition>) => {
    void handleUpdateViewDefinition(filename, patch)
      .then(() => {
        trackEvent('view_updated', { source: 'sidebar_view_actions' })
        if (typeof patch.name === 'string') setToastMessage(`View "${patch.name}" renamed`)
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err)
        setToastMessage(`Could not save view: ${message}`)
      })
  }, [handleUpdateViewDefinition, setToastMessage])

  const handleEditView = useCallback((filename: string) => {
    const view = vault.views.find((v) => v.filename === filename)
    if (view) dialogs.openEditView(filename, view.definition)
  }, [vault.views, dialogs])

  const handleDeleteView = useCallback(async (filename: string) => {
    const target = isTauri() ? invoke : mockInvoke
    try {
      await target('delete_view_cmd', { vaultPath: resolvedPath, filename })
    } catch (err) {
      if (isActiveVaultUnavailableError(err)) {
        vault.markVaultUnavailable(resolvedPath)
        return
      }
      throw err
    }
    await vault.reloadViews()
    await vault.reloadVault()
    vault.reloadFolders()
    if (selection.kind === 'view' && selection.filename === filename) {
      handleSetSelection({ kind: 'filter', filter: 'all' })
    }
    setToastMessage('View deleted')
  }, [resolvedPath, vault, selection, handleSetSelection])

  const availableFields = useMemo(() => {
    const builtIn = ['type', 'status', 'title', 'favorite', 'body']
    if (!vault.entries?.length) return builtIn
    const customFields = new Set<string>()
    for (const e of vault.entries) {
      if (e.properties) {
        for (const key of Object.keys(e.properties)) customFields.add(key)
      }
      if (e.relationships) {
        for (const key of Object.keys(e.relationships)) customFields.add(key)
      }
    }
    return [...builtIn, ...Array.from(customFields).sort()]
  }, [vault.entries])

  const bulkActions = useBulkActions(entryActions, vault.entries, setToastMessage)

  // Raw-toggle ref: Editor registers its handleToggleRaw here so the command palette can call it
  const rawToggleRef = useRef<() => void>(() => {})
  // Diff-toggle ref: Editor registers its handleToggleDiff here so the command palette can call it
  const diffToggleRef = useRef<() => void>(() => {})
  const findInNoteRef = useRef<((options?: { replace?: boolean }) => void) | null>(null)

  const zoom = useZoom()
  const buildNumber = useBuildNumber()

  const handleMobileOpenFavorite = useCallback((entry: VaultEntry) => {
    void handleOpenFavorite(entry)
    if (isMobileLayoutViewport()) handleSetViewMode('editor-only')
  }, [handleOpenFavorite, handleSetViewMode])

  const handleMobileReplaceActiveTab = useCallback((entry: VaultEntry) => {
    handleReplaceActiveTabWithQueuedDiff(entry)
    if (isMobileLayoutViewport()) handleSetViewMode('editor-only')
  }, [handleReplaceActiveTabWithQueuedDiff, handleSetViewMode])

  const handleMobilePulseOpenNote = useCallback((relativePath: string, commitHash?: string) => {
    handlePulseOpenNote(relativePath, commitHash)
    if (isMobileLayoutViewport()) handleSetViewMode('editor-only')
  }, [handlePulseOpenNote, handleSetViewMode])

  const handleToggleInspector = useCallback(() => {
    const nextInspectorCollapsed = !layout.inspectorCollapsed
    layout.setInspectorCollapsed(nextInspectorCollapsed)
    updateMainWindowConstraints(sidebarVisible, noteListVisible, nextInspectorCollapsed)
  }, [
    layout,
    noteListVisible,
    sidebarVisible,
    updateMainWindowConstraints,
  ])

  useMainWindowSizeConstraints({
    enabled: !noteWindowParams,
    sidebarVisible,
    noteListVisible,
    inspectorCollapsed: layout.inspectorCollapsed,
    sidebarWidth: layout.sidebarWidth,
    noteListWidth: layout.noteListWidth,
    inspectorWidth: layout.inspectorWidth,
  })

  const handleRepairVault = useCallback(async () => {
    if (!resolvedPath) return
    try {
      const tauriInvoke = isTauri() ? invoke : mockInvoke
      const msg = await tauriInvoke<string>('repair_vault', { vaultPath: resolvedPath })
      await vault.reloadVault()
      setToastMessage(msg)
    } catch (err) {
      setToastMessage(`Failed to repair vault: ${err}`)
    }
  }, [resolvedPath, vault, setToastMessage])

  const activeDeletedFile = useMemo(() => {
    const activeTabPath = notes.activeTabPath
    if (!activeTabPath) return null
    return vault.modifiedFiles.find((file) =>
      file.status === 'deleted'
      && (file.path === activeTabPath || activeTabPath.endsWith('/' + file.relativePath)),
    ) ?? null
  }, [notes.activeTabPath, vault.modifiedFiles])

  const activeCommandEntry = useMemo(() => {
    if (!notes.activeTabPath) return null
    return notes.tabs.find((tab) => tab.entry.path === notes.activeTabPath)?.entry
      ?? vault.entries.find((entry) => entry.path === notes.activeTabPath)
      ?? null
  }, [notes.activeTabPath, notes.tabs, vault.entries])
  const noteRetargetingUi = useNoteRetargetingUi({
    activeEntry: activeCommandEntry,
    activeNoteBlocked: !!activeDeletedFile,
    entries: vault.entries,
    folders: vault.folders,
    selection: effectiveSelection,
    setSelection: handleSetSelection,
    setToastMessage,
    vaultPath: resolvedPath,
    updateFrontmatter: notes.handleUpdateFrontmatter,
    moveNoteToFolder: notes.handleMoveNoteToFolder,
  })

  const canToggleRichEditor = !!activeCommandEntry
    && activeCommandEntry.filename.toLowerCase().endsWith('.md')
    && !activeDeletedFile
  const shouldBlockNeighborhoodEscape = (
    dialogs.showCreateTypeDialog
    || dialogs.showQuickOpen
    || dialogs.showCommandPalette
    || dialogs.showSettings
    || dialogs.showCloneVault
    || dialogs.showSearch
    || dialogs.showConflictResolver
    || dialogs.showCreateViewDialog
    || noteRetargetingUi.isDialogOpen
  )

  useEffect(() => {
    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!shouldProcessNeighborhoodEscape(event, selectionRef.current, shouldBlockNeighborhoodEscape)) return

      const activeElement = document.activeElement
      if (isEditorEscapeTarget(activeElement)) {
        event.preventDefault()
        activeElement.blur()
        requestAnimationFrame(() => {
          focusNoteListContainer(document)
        })
        return
      }

      if (isEditableElement(activeElement)) return

      if (handleNeighborhoodHistoryBack()) {
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [handleNeighborhoodHistoryBack, shouldBlockNeighborhoodEscape])

  const noteListColumnsLabel = useMemo(() => {
    if (effectiveSelection.kind === 'view') {
      const selectedView = vault.views.find((view) => view.filename === effectiveSelection.filename)
      return selectedView ? `Customize ${selectedView.definition.name} columns` : 'Customize View columns'
    }

    return effectiveSelection.kind === 'filter' && effectiveSelection.filter === 'all'
      ? 'Customize All Notes columns'
      : 'Customize Inbox columns'
  }, [effectiveSelection, vault.views])
  const viewOrdering = useSavedViewOrdering({
    views: vault.views,
    selection: effectiveSelection,
    vaultPath: resolvedPath,
    reloadViews: vault.reloadViews,
    loadModifiedFiles: vault.loadModifiedFiles,
    onToast: setToastMessage,
    locale: appLocale,
  })
  const activeNoteModified = useMemo(
    () => vault.modifiedFiles.some((file) => file.path === notes.activeTabPath),
    [notes.activeTabPath, vault.modifiedFiles],
  )
  const toggleDiffCommand = useCallback(() => diffToggleRef.current(), [])
  const toggleRawEditorCommand = useMemo(
    () => canToggleRichEditor ? () => rawToggleRef.current() : undefined,
    [canToggleRichEditor],
  )
  const findInNoteCommand = useCallback(() => {
    findInNoteRef.current?.({ replace: false })
  }, [])
  const replaceInNoteCommand = useCallback(() => {
    findInNoteRef.current?.({ replace: true })
  }, [])
  const pastePlainTextCommand = useCallback(() => {
    void requestPlainTextPaste().catch((error) => {
      console.warn('[paste] Failed to paste plain text:', error)
    })
  }, [])
  const removeActiveVaultCommand = useCallback(() => {
    vaultSwitcher.removeVault(vaultSwitcher.vaultPath)
  }, [vaultSwitcher])
  const changeNoteTypeCommand = useMemo(
    () => noteRetargetingUi.canChangeActiveNoteType ? noteRetargetingUi.openChangeNoteTypeDialog : undefined,
    [noteRetargetingUi.canChangeActiveNoteType, noteRetargetingUi.openChangeNoteTypeDialog],
  )
  const moveNoteToFolderCommand = useMemo(
    () => noteRetargetingUi.canMoveActiveNoteToFolder ? noteRetargetingUi.openMoveNoteToFolderDialog : undefined,
    [noteRetargetingUi.canMoveActiveNoteToFolder, noteRetargetingUi.openMoveNoteToFolderDialog],
  )
  const activeNoteHasIcon = useMemo(() => {
    const entry = vault.entries.find((candidate) => candidate.path === notes.activeTabPath)
    return hasNoteIconValue(entry?.icon)
  }, [notes.activeTabPath, vault.entries])
  const handleToggleOrganizedWithInboxAdvance = useCallback(async (path: string) => {
    const entry = vault.entries.find((candidate) => candidate.path === path)
    if (!entry) return

    const shouldAutoAdvance = settings.auto_advance_inbox_after_organize === true
      && !entry.organized
      && notes.activeTabPath === path
      && effectiveSelection.kind === 'filter'
      && effectiveSelection.filter === 'inbox'
    const nextVisibleInboxEntry = shouldAutoAdvance
      ? getNextVisibleInboxEntry(visibleNotesRef.current, path)
      : null

    const organized = await entryActions.handleToggleOrganized(path)

    if (
      organized
      && nextVisibleInboxEntry
      && notes.activeTabPathRef.current === path
      && notes.requestedActiveTabPathRef.current === path
    ) {
      void notes.handleSelectNote(nextVisibleInboxEntry)
    }
  }, [effectiveSelection, entryActions, notes, settings.auto_advance_inbox_after_organize, vault.entries])
  const toggleOrganizedCommand = explicitOrganizationEnabled ? handleToggleOrganizedWithInboxAdvance : undefined
  const canCustomizeNoteListColumns = useMemo(() => (
    effectiveSelection.kind === 'view'
      || (
        effectiveSelection.kind === 'filter'
        && (effectiveSelection.filter === 'all' || (explicitOrganizationEnabled && effectiveSelection.filter === 'inbox'))
      )
  ), [effectiveSelection, explicitOrganizationEnabled])
  const restoreDeletedNoteCommand = useMemo(
    () => activeDeletedFile ? () => { void handleDiscardFile(activeDeletedFile.relativePath) } : undefined,
    [activeDeletedFile, handleDiscardFile],
  )
  const reloadVaultForCommand = vault.reloadVault
  const handleManualVaultReload = useCallback(async () => {
    const entries = await reloadVaultForCommand()
    setToastMessage(`Vault reloaded (${entries.length} ${entries.length === 1 ? 'entry' : 'entries'})`)
    return entries
  }, [reloadVaultForCommand, setToastMessage])

  const {
    activeTab,
    defaultNoteWidth,
    noteWidth: activeNoteWidth,
    setDefaultNoteWidth: handleSetDefaultNoteWidth,
    setNoteWidth: handleSetActiveNoteWidth,
    toggleNoteWidth: handleToggleNoteWidth,
  } = useNoteWidthMode({
    tabs: notes.tabs,
    activeTabPath: notes.activeTabPath,
    settings,
    saveSettings,
    updateFrontmatter: notes.handleUpdateFrontmatter,
    setToastMessage,
  })
  const hasActiveNote = activeTab !== null

  useEffect(() => {
    if (noteWindowParams || hasActiveNote || viewMode !== 'editor-only') return
    if (isMobileLayoutViewport()) handleSetViewMode('editor-list')
  }, [handleSetViewMode, hasActiveNote, noteWindowParams, viewMode])

  const commands = useAppCommands({
    activeTabPath: notes.activeTabPath, activeTabPathRef: notes.activeTabPathRef,
    entries: vault.entries,
    visibleNotesRef,
    multiSelectionCommandRef,
    modifiedCount: vault.modifiedFiles.length,
    activeNoteModified,
    selection: effectiveSelection,
    onQuickOpen: dialogs.openQuickOpen, onCommandPalette: dialogs.openCommandPalette,
    onSearch: dialogs.openSearch,
    onFindInNote: findInNoteCommand,
    onReplaceInNote: activeDeletedFile ? undefined : replaceInNoteCommand,
    onPastePlainText: pastePlainTextCommand,
    onCreateNote: notes.handleCreateNoteImmediate,
    onCreateNoteOfType: notes.handleCreateNoteImmediate,
    onSave: appSave.handleSave,
    onOpenSettings: dialogs.openSettings,
    onDeleteNote: deleteActions.handleDeleteNote,
    onArchiveNote: entryActions.handleArchiveNote, onUnarchiveNote: entryActions.handleUnarchiveNote,
    onCommitPush: handleCommitPush,
    isGitVault,
    onInitializeGit: gitSetup.openGitSetupDialog,
    onPull: autoSync.triggerSync,
    onResolveConflicts: conflictFlow.handleOpenConflictResolver,
    onSetViewMode: handleSetViewMode,
    onToggleInspector: handleToggleInspector,
    onToggleDiff: toggleDiffCommand,
    onToggleRawEditor: toggleRawEditorCommand,
    noteWidth: activeNoteWidth,
    defaultNoteWidth,
    onSetNoteWidth: handleSetActiveNoteWidth,
    onSetDefaultNoteWidth: handleSetDefaultNoteWidth,
    selectedViewName: viewOrdering.selectedViewName,
    onMoveSelectedViewUp: viewOrdering.onMoveSelectedViewUp,
    onMoveSelectedViewDown: viewOrdering.onMoveSelectedViewDown,
    canMoveSelectedViewUp: viewOrdering.canMoveSelectedViewUp,
    canMoveSelectedViewDown: viewOrdering.canMoveSelectedViewDown,
    onZoomIn: zoom.zoomIn, onZoomOut: zoom.zoomOut, onZoomReset: zoom.zoomReset,
    zoomLevel: zoom.zoomLevel,
    onSelect: handleMobileSidebarSelection,
    onRenameFolder: folderActions.renameSelectedFolder,
    onDeleteFolder: folderActions.deleteSelectedFolder,
    onCopySelectedFolderPath: fileActions.copySelectedFolderPath,
    showInbox: explicitOrganizationEnabled,
    onReplaceActiveTab: notes.handleReplaceActiveTab,
    onSelectNote: notes.handleSelectNote,
    onGoBack: handleGoBack, onGoForward: handleGoForward,
    canGoBack: canGoBack, canGoForward: canGoForward,
    onOpenVault: vaultSwitcher.handleOpenLocalFolder,
    onCreateEmptyVault: vaultSwitcher.handleCreateEmptyVault,
    onCreateType: dialogs.openCreateType,
    onRemoveActiveVault: removeActiveVaultCommand,
    onRestoreGettingStarted: cloneGettingStartedVault,
    isGettingStartedHidden: vaultSwitcher.isGettingStartedHidden,
    vaultCount: vaultSwitcher.allVaults.length,
    locale: appLocale,
    onSetThemeMode: handleSetThemeMode,
    onReloadVault: handleManualVaultReload,
    onRepairVault: handleRepairVault,
    onSetNoteIcon: handleSetNoteIconCommand,
    onRemoveNoteIcon: handleRemoveNoteIconCommand,
    onChangeNoteType: changeNoteTypeCommand,
    onMoveNoteToFolder: moveNoteToFolderCommand,
    canMoveNoteToFolder: noteRetargetingUi.canMoveActiveNoteToFolder,
    activeNoteHasIcon,
    noteListFilter,
    onSetNoteListFilter: setNoteListFilter,
    onOpenInNewWindow: isTauri() ? handleOpenInNewWindow : undefined,
    onCopyActiveFilePath: fileActions.copyFilePath,
    onToggleFavorite: entryActions.handleToggleFavorite,
    onToggleOrganized: toggleOrganizedCommand,
    onCustomizeNoteListColumns: handleCustomizeNoteListColumns,
    canCustomizeNoteListColumns,
    noteListColumnsLabel,
    onRestoreDeletedNote: restoreDeletedNoteCommand,
    canRestoreDeletedNote: !!activeDeletedFile,
  })

  const inboxCount = useMemo(() => filterInboxEntries(vault.entries, inboxPeriod).length, [vault.entries, inboxPeriod])

  const shouldResumeFreshStartOnboarding = useMemo(() => {
    if (onboarding.state.status !== 'ready' || !vaultSwitcher.loaded) return false
    const remembersOnlyImplicitDefaultVault = selectedVaultPath === null

    return remembersOnlyImplicitDefaultVault
      && vaultSwitcher.allVaults.length === 1
      && vaultSwitcher.allVaults[0]?.path === vaultSwitcher.vaultPath
      && onboarding.state.vaultPath === vaultSwitcher.vaultPath
  }, [onboarding.state, selectedVaultPath, vaultSwitcher.allVaults, vaultSwitcher.loaded, vaultSwitcher.vaultPath])

  const isStartupLoading = !noteWindowParams && onboarding.state.status === 'loading'

  // Show telemetry consent dialog on first launch (skip for note windows).
  // After the user answers, the next render can continue into onboarding.
  if (!noteWindowParams && !isStartupLoading && settingsLoaded && settings.telemetry_consent === null) {
    return (
      <TelemetryConsentDialog
        onAccept={() => {
          const id = crypto.randomUUID()
          saveSettings({ ...settings, telemetry_consent: true, crash_reporting_enabled: true, analytics_enabled: true, anonymous_id: id })
        }}
        onDecline={() => {
          saveSettings({ ...settings, telemetry_consent: false, crash_reporting_enabled: false, analytics_enabled: false, anonymous_id: null })
        }}
      />
    )
  }

  // Show welcome/onboarding screen when vault doesn't exist (skip for note windows - vault path is known)
  if (!noteWindowParams && (runtimeMissingVaultPath || onboarding.state.status === 'welcome' || onboarding.state.status === 'vault-missing' || shouldResumeFreshStartOnboarding)) {
    const welcomeOnboarding = runtimeMissingVaultPath
      ? {
          ...onboarding,
          state: {
            status: 'vault-missing' as const,
            vaultPath: runtimeMissingVaultPath,
            defaultPath: vaultSwitcher.defaultPath || runtimeMissingVaultPath,
          },
        }
      : shouldResumeFreshStartOnboarding
      ? { ...onboarding, state: { status: 'welcome' as const, defaultPath: vaultSwitcher.vaultPath } }
      : onboarding
    return <WelcomeView onboarding={welcomeOnboarding} isOffline={networkStatus.isOffline} />
  }

  const isVaultContentLoading = !noteWindowParams && (isStartupLoading || (onboarding.state.status === 'ready' && vault.isLoading))
  const shouldShowNotesInsteadOfEmptyEditor = !noteWindowParams
    && !hasActiveNote
    && viewMode === 'editor-only'
    && isMobileLayoutViewport()
  const renderedViewMode = shouldShowNotesInsteadOfEmptyEditor ? 'editor-list' : viewMode
  const renderedSidebarVisible = shouldShowNotesInsteadOfEmptyEditor ? false : sidebarVisible
  const renderedNoteListVisible = shouldShowNotesInsteadOfEmptyEditor ? true : noteListVisible
  const mobileMenuActions: MobileMenuAction[] = [
    { label: 'Search', description: 'Find notes across this vault', Icon: Search, onSelect: dialogs.openSearch },
    { label: 'Quick open', description: 'Jump directly to a note', Icon: ListChecks, onSelect: dialogs.openQuickOpen },
    { label: 'Commands', description: 'Open every available app command', Icon: ListChecks, onSelect: dialogs.openCommandPalette },
    { label: 'Changes', description: vault.modifiedFiles.length === 1 ? '1 changed file' : `${vault.modifiedFiles.length} changed files`, Icon: GitBranch, onSelect: handleMobileOpenChanges },
    { label: 'Pulse', description: 'Review recent vault activity', Icon: RefreshCw, onSelect: handleMobileOpenPulse },
    {
      label: isGitVault ? 'Commit' : 'Set up Git',
      description: isGitVault ? 'Save current changes locally' : 'Initialize Git for this vault',
      Icon: GitCommit,
      onSelect: isGitVault ? handleCommitPush : gitSetup.openGitSetupDialog,
    },
    {
      label: 'Pull and push',
      description: networkStatus.isOffline ? 'Unavailable while offline' : 'Exchange changes with the remote',
      Icon: RefreshCw,
      onSelect: autoSync.pullAndPush,
      disabled: !isGitVault || networkStatus.isOffline,
    },
    {
      label: 'Resolve conflicts',
      description: autoSync.conflictFiles.length === 1 ? '1 conflict needs attention' : `${autoSync.conflictFiles.length} conflicts need attention`,
      Icon: GitBranch,
      onSelect: conflictFlow.handleOpenConflictResolver,
      disabled: autoSync.conflictFiles.length === 0,
    },
    { label: 'Theme', description: 'Toggle light and dark mode', Icon: Moon, onSelect: settingsLoaded ? handleToggleThemeMode : undefined, disabled: !settingsLoaded },
    { label: 'Settings', description: 'Open app settings', Icon: Settings, onSelect: dialogs.openSettings },
  ]

  return (
    <div className="app-shell" data-view-mode={renderedViewMode} data-has-active-note={hasActiveNote ? 'true' : 'false'}>
        {!noteWindowParams && (
          <MobileVaultBar
            vaultPath={resolvedPath}
            vaults={vaultSwitcher.allVaults}
            onSwitchVault={vaultSwitcher.switchVault}
            onOpenLocalFolder={vaultSwitcher.handleOpenLocalFolder}
            onCreateEmptyVault={vaultSwitcher.handleCreateEmptyVault}
            onCloneVault={dialogs.openCloneVault}
            onCloneGettingStarted={cloneGettingStartedVault}
            onRemoveVault={vaultSwitcher.removeVault}
            onOpenMenu={() => setMobileMenuOpen(true)}
            locale={appLocale}
          />
        )}
        <div className="app">
          {!noteWindowParams && !renderedSidebarVisible && (
            <button
              type="button"
              className="navigation-reopen-button"
              onClick={() => handleSetViewMode('all')}
              aria-label="Open navigation"
              title="Open navigation"
            >
              <PanelLeft aria-hidden="true" />
              <span>Navigation</span>
            </button>
          )}
          {renderedSidebarVisible && (
            <>
              <div className="app__sidebar" style={{ width: layout.sidebarWidth }}>
                <Sidebar entries={vault.entries} folders={vault.folders} views={vault.views} selection={effectiveSelection} onSelect={handleMobileSidebarSelection} onSelectNote={handleMobileSelectNote} onSelectFavorite={handleMobileOpenFavorite} onReorderFavorites={entryActions.handleReorderFavorites} onCreateType={notes.handleCreateNoteImmediate} onCreateNewType={dialogs.openCreateType} onCustomizeType={entryActions.handleCustomizeType} onUpdateTypeTemplate={entryActions.handleUpdateTypeTemplate} onReorderSections={entryActions.handleReorderSections} onRenameSection={entryActions.handleRenameSection} onDeleteType={handleDeleteType} onToggleTypeVisibility={entryActions.handleToggleTypeVisibility} onCreateFolder={handleCreateFolder} onRenameFolder={folderActions.renameFolder} onDeleteFolder={folderActions.requestDeleteFolder} folderFileActions={fileActions.folderActions} renamingFolderPath={folderActions.renamingFolderPath} onStartRenameFolder={folderActions.startFolderRename} onCancelRenameFolder={folderActions.cancelFolderRename} onCreateView={dialogs.openCreateView} onEditView={handleEditView} onDeleteView={handleDeleteView} onUpdateViewDefinition={handleSidebarUpdateViewDefinition} onReorderViews={viewOrdering.onReorderViews} showInbox={explicitOrganizationEnabled} inboxCount={inboxCount} allNotesFileVisibility={allNotesFileVisibility} onCollapse={handleCollapseSidebar} onGoBack={handleGoBack} onGoForward={handleGoForward} canGoBack={canGoBack} canGoForward={canGoForward} locale={appLocale} loading={isVaultContentLoading} vaultRootPath={resolvedPath} />
              </div>
              <ResizeHandle onResize={layout.handleSidebarResize} />
            </>
          )}
          {renderedNoteListVisible && (
            <>
              <div className="app__note-list" style={{ width: layout.noteListWidth }}>
                {effectiveSelection.kind === 'filter' && effectiveSelection.filter === 'pulse' ? (
                  <PulseView vaultPath={resolvedPath} onOpenNote={handleMobilePulseOpenNote} sidebarCollapsed={!renderedSidebarVisible} onExpandSidebar={() => handleSetViewMode('all')} locale={appLocale} />
                ) : (
                  <NoteList entries={vault.entries} selection={effectiveSelection} selectedNote={activeTab?.entry ?? null} loading={isVaultContentLoading} noteListFilter={noteListFilter} onNoteListFilterChange={setNoteListFilter} inboxPeriod={inboxPeriod} modifiedFiles={vault.modifiedFiles} modifiedFilesError={vault.modifiedFilesError} getNoteStatus={vault.getNoteStatus} sidebarCollapsed={!renderedSidebarVisible} onSelectNote={handleMobileSelectNote} onReplaceActiveTab={handleMobileReplaceActiveTab} onEnterNeighborhood={handleEnterNeighborhood} onCreateNote={notes.handleCreateNoteImmediate} onBulkOrganize={explicitOrganizationEnabled ? bulkActions.handleBulkOrganize : undefined} onBulkArchive={bulkActions.handleBulkArchive} onBulkDeletePermanently={deleteActions.handleBulkDeletePermanently} onUpdateTypeSort={notes.handleUpdateFrontmatter} onUpdateViewDefinition={handleUpdateViewDefinition} updateEntry={vault.updateEntry} onOpenInNewWindow={isTauri() ? handleOpenEntryInNewWindow : undefined} onDiscardFile={handleDiscardFile} onOpenDeletedNote={handleOpenDeletedNote} allNotesNoteListProperties={vaultConfig.allNotes?.noteListProperties ?? null} onUpdateAllNotesNoteListProperties={handleUpdateAllNotesNoteListProperties} inboxNoteListProperties={vaultConfig.inbox?.noteListProperties ?? null} onUpdateInboxNoteListProperties={handleUpdateInboxNoteListProperties} views={vault.views} visibleNotesRef={visibleNotesRef} allNotesFileVisibility={allNotesFileVisibility} multiSelectionCommandRef={multiSelectionCommandRef} locale={appLocale} />
                )}
              </div>
              <ResizeHandle onResize={layout.handleNoteListResize} />
            </>
          )}
          <div className="app__editor">
            <Editor
              tabs={notes.tabs}
              activeTabPath={notes.activeTabPath}
              isVaultLoading={isVaultContentLoading}
              entries={noteWindowParams && activeTab ? [activeTab.entry] : vault.entries}
              onNavigateWikilink={notes.handleNavigateWikilink}
              onLoadDiff={vault.loadDiff}
              onLoadDiffAtCommit={vault.loadDiffAtCommit}
              pendingCommitDiffRequest={pendingDiffRequest}
              onPendingCommitDiffHandled={handlePendingDiffHandled}
              getNoteStatus={vault.getNoteStatus}
              onCreateNote={notes.handleCreateNoteImmediate}
              inspectorCollapsed={layout.inspectorCollapsed}
              onToggleInspector={handleToggleInspector}
              inspectorWidth={layout.inspectorWidth}
              onInspectorResize={layout.handleInspectorResize}
              inspectorEntry={activeTab?.entry ?? null}
              inspectorContent={activeTab?.content ?? null}
              gitHistory={gitHistory}
              onUpdateFrontmatter={notes.handleUpdateFrontmatter}
              onDeleteProperty={notes.handleDeleteProperty}
              onAddProperty={notes.handleAddProperty}
              onCreateMissingType={handleCreateMissingType}
              onCreateAndOpenNote={notes.handleCreateNoteForRelationship}
              onInitializeProperties={handleInitializeProperties}
              vaultPath={resolvedPath}
              onToggleFavorite={activeDeletedFile ? undefined : entryActions.handleToggleFavorite}
              onToggleOrganized={activeDeletedFile || !explicitOrganizationEnabled ? undefined : toggleOrganizedCommand}
              onCopyFilePath={fileActions.copyFilePath}
              onDeleteNote={activeDeletedFile ? undefined : deleteActions.handleDeleteNote}
              onArchiveNote={activeDeletedFile ? undefined : entryActions.handleArchiveNote}
              onUnarchiveNote={activeDeletedFile ? undefined : entryActions.handleUnarchiveNote}
              onContentChange={handleTrackedContentChange}
              onSave={handleTrackedSave}
              onRenameFilename={activeDeletedFile ? undefined : appSave.handleFilenameRename}
              noteWidth={activeNoteWidth}
              onToggleNoteWidth={handleToggleNoteWidth}
              wordWrap={settings.word_wrap_enabled ?? true}
              rawToggleRef={rawToggleRef}
              findInNoteRef={findInNoteRef}
              diffToggleRef={diffToggleRef}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              onGoBack={handleGoBack}
              onGoForward={handleGoForward}
              leftPanelsCollapsed={!renderedSidebarVisible && !renderedNoteListVisible}
              isConflicted={conflictFlow.isConflicted}
              onKeepMine={conflictFlow.handleKeepMine}
              onKeepTheirs={conflictFlow.handleKeepTheirs}
              flushPendingEditorContentRef={flushPendingEditorContentRef}
              flushPendingRawContentRef={flushPendingRawContentRef}
              locale={appLocale}
            />
          </div>
        </div>
        {!noteWindowParams && (
          <MobileViewNav
            viewMode={renderedViewMode}
            onSetViewMode={handleSetViewMode}
            onCreateNote={handleMobileCreateNote}
          />
        )}
        <MobileActionSheet open={mobileMenuOpen} actions={mobileMenuActions} onClose={() => setMobileMenuOpen(false)} />
        <RenameDetectedBanner renames={renameDetection.detectedRenames} onUpdate={renameDetection.handleUpdateWikilinks} onDismiss={renameDetection.handleDismissRenames} />
        <StatusBar noteCount={vault.entries.length} modifiedCount={vault.modifiedFiles.length} vaultPath={resolvedPath} vaults={vaultSwitcher.allVaults} onSwitchVault={vaultSwitcher.switchVault} onOpenSettings={dialogs.openSettings} onOpenLocalFolder={vaultSwitcher.handleOpenLocalFolder} onCreateEmptyVault={vaultSwitcher.handleCreateEmptyVault} onCloneVault={dialogs.openCloneVault} onCloneGettingStarted={cloneGettingStartedVault} onClickPending={() => handleSetSelection({ kind: 'filter', filter: 'changes' })} onClickPulse={() => handleSetSelection({ kind: 'filter', filter: 'pulse' })} onCommitPush={handleCommitPush} onInitializeGit={gitSetup.openGitSetupDialog} isOffline={networkStatus.isOffline} isGitVault={isGitVault} isVaultReloading={vault.isReloading || isVaultContentLoading} syncStatus={autoSync.syncStatus} lastSyncTime={autoSync.lastSyncTime} conflictCount={autoSync.conflictFiles.length} remoteStatus={autoSync.remoteStatus} onTriggerSync={autoSync.triggerSync} onPullAndPush={autoSync.pullAndPush} onOpenConflictResolver={conflictFlow.handleOpenConflictResolver} zoomLevel={zoom.zoomLevel} themeMode={documentThemeMode} onZoomReset={zoom.zoomReset} onToggleThemeMode={settingsLoaded ? handleToggleThemeMode : undefined} buildNumber={buildNumber} onRemoveVault={vaultSwitcher.removeVault} locale={appLocale} />
        <GitSetupDialog open={shouldShowGitSetupDialog} onInitGit={gitSetup.handleInitGitRepo} onDismiss={gitSetup.dismissGitSetupDialog} />
        <DeleteProgressNotice count={deleteActions.pendingDeleteCount} />
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
        <QuickOpenPalette open={dialogs.showQuickOpen} entries={vault.entries} isLoading={vault.isLoading} onSelect={handleMobileSelectNote} onClose={dialogs.closeQuickOpen} locale={appLocale} />
        <CommandPalette
          open={dialogs.showCommandPalette}
          commands={commands}
          entries={vault.entries}
          locale={appLocale}
          onClose={dialogs.closeCommandPalette}
        />
        <SearchPanel open={dialogs.showSearch} vaultPath={resolvedPath} entries={vault.entries} onSelectNote={handleMobileSelectNote} onClose={dialogs.closeSearch} />
        <CreateTypeDialog open={dialogs.showCreateTypeDialog} onClose={dialogs.closeCreateType} onCreate={handleCreateType} />
        <NoteRetargetingDialogs
          dialogState={noteRetargetingUi.dialogState}
          dialogEntry={noteRetargetingUi.dialogEntry}
          typeOptions={noteRetargetingUi.typeOptions}
          folderOptions={noteRetargetingUi.folderOptions}
          onClose={noteRetargetingUi.closeDialog}
          onSelectType={noteRetargetingUi.selectType}
          onSelectFolder={noteRetargetingUi.selectFolder}
        />
        <CreateViewDialog open={dialogs.showCreateViewDialog} onClose={dialogs.closeCreateView} onCreate={handleCreateOrUpdateView} availableFields={availableFields} locale={appLocale} editingView={dialogs.editingView?.definition ?? null} />
        <CommitDialog
          open={commitFlow.showCommitDialog}
          modifiedCount={vault.modifiedFiles.length}
          commitMode={commitFlow.commitMode}
          suggestedMessage={suggestedCommitMessage}
          onCommit={commitFlow.handleCommitPush}
          onClose={commitFlow.closeCommitDialog}
        />
        <ConflictResolverModal
          open={dialogs.showConflictResolver}
          fileStates={conflictResolver.fileStates}
          allResolved={conflictResolver.allResolved}
          committing={conflictResolver.committing}
          error={conflictResolver.error}
          onResolveFile={conflictResolver.resolveFile}
          onOpenInEditor={conflictResolver.openInEditor}
          onCommit={conflictResolver.commitResolution}
          onClose={conflictFlow.handleCloseConflictResolver}
        />
        <SettingsPanel open={dialogs.showSettings} settings={settings} locale={appLocale} isGitVault={isGitVault} onSave={saveSettings} explicitOrganizationEnabled={explicitOrganizationEnabled} onSaveExplicitOrganization={handleSaveExplicitOrganization} onClose={dialogs.closeSettings} />
        <CloneVaultModal key={dialogs.showCloneVault ? 'clone-open' : 'clone-closed'} open={dialogs.showCloneVault} onClose={dialogs.closeCloneVault} onVaultCloned={vaultSwitcher.handleVaultCloned} />
        {deleteActions.confirmDelete && (
          <ConfirmDeleteDialog
            open={true}
            title={deleteActions.confirmDelete.title}
            message={deleteActions.confirmDelete.message}
            confirmLabel={deleteActions.confirmDelete.confirmLabel}
            onConfirm={deleteActions.confirmDelete.onConfirm}
            onCancel={() => deleteActions.setConfirmDelete(null)}
          />
        )}
        {folderActions.confirmDeleteFolder && (
          <ConfirmDeleteDialog
            open={true}
            title={folderActions.confirmDeleteFolder.title}
            message={folderActions.confirmDeleteFolder.message}
            confirmLabel={folderActions.confirmDeleteFolder.confirmLabel}
            onConfirm={folderActions.confirmDeleteSelectedFolder}
            onCancel={folderActions.cancelDeleteFolder}
          />
        )}
    </div>
  )
}

type OnboardingState = ReturnType<typeof useOnboarding>

function MobileVaultBar({
  vaultPath,
  vaults,
  onSwitchVault,
  onOpenLocalFolder,
  onCreateEmptyVault,
  onCloneVault,
  onCloneGettingStarted,
  onRemoveVault,
  onOpenMenu,
  locale,
}: {
  vaultPath: string
  vaults: Array<{ label: string; path: string; available?: boolean }>
  onSwitchVault: (path: string) => void
  onOpenLocalFolder?: () => void
  onCreateEmptyVault?: () => void
  onCloneVault?: () => void
  onCloneGettingStarted?: () => void
  onRemoveVault?: (path: string) => void
  onOpenMenu: () => void
  locale: AppLocale
}) {
  return (
    <div className="mobile-vault-bar">
      <button type="button" className="mobile-vault-bar__menu-button" onClick={onOpenMenu} aria-label="Open menu">
        <Menu aria-hidden="true" />
      </button>
      <div className="mobile-vault-bar__vault-menu">
        <VaultMenu
          vaults={vaults}
          vaultPath={vaultPath}
          onSwitchVault={onSwitchVault}
          onOpenLocalFolder={onOpenLocalFolder}
          onCreateEmptyVault={onCreateEmptyVault}
          onCloneVault={onCloneVault}
          onCloneGettingStarted={onCloneGettingStarted}
          onRemoveVault={onRemoveVault}
          menuPlacement="below"
          locale={locale}
          triggerTestId="mobile-status-vault-trigger"
        />
      </div>
    </div>
  )
}

function MobileViewNav({
  viewMode,
  onSetViewMode,
  onCreateNote,
}: {
  viewMode: ViewMode
  onSetViewMode: (mode: ViewMode) => void
  onCreateNote: () => void
}) {
  const viewItems = [
    { mode: 'all' as const, label: 'Vault', Icon: PanelLeft },
    { mode: 'editor-list' as const, label: 'Notes', Icon: List },
  ]

  return (
    <nav className="mobile-view-nav" aria-label="Mobile workspace views">
      {viewItems.map(({ mode, label, Icon }) => (
        <MobileViewButton
          key={mode}
          active={viewMode === mode}
          Icon={Icon}
          label={label}
          onClick={() => onSetViewMode(mode)}
        />
      ))}
      <button
        type="button"
        className="mobile-view-nav__item mobile-view-nav__create"
        onClick={onCreateNote}
        aria-label="Create note"
      >
        <Plus aria-hidden="true" />
        <span>New</span>
      </button>
    </nav>
  )
}

function MobileViewButton({
  active,
  Icon,
  label,
  onClick,
}: {
  active: boolean
  Icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="mobile-view-nav__item"
      data-active={active || undefined}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

interface MobileMenuAction {
  label: string
  description: string
  Icon: LucideIcon
  onSelect?: () => void
  disabled?: boolean
}

function MobileActionSheet({
  actions,
  onClose,
  open,
}: {
  actions: MobileMenuAction[]
  onClose: () => void
  open: boolean
}) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="mobile-action-sheet" role="presentation" onMouseDown={onClose}>
      <div
        className="mobile-action-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile menu"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mobile-action-sheet__header">
          <div>
            <h2>Menu</h2>
            <p>Common vault actions</p>
          </div>
          <button type="button" className="mobile-action-sheet__close" onClick={onClose} aria-label="Close menu">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="mobile-action-sheet__actions">
          {actions.map(({ description, disabled, Icon, label, onSelect }) => (
            <button
              key={label}
              type="button"
              className="mobile-action-sheet__action"
              disabled={disabled}
              onClick={() => {
                if (disabled || !onSelect) return
                onSelect()
                onClose()
              }}
            >
              <Icon aria-hidden="true" />
              <span className="mobile-action-sheet__action-copy">
                <span>{label}</span>
                <small>{description}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Welcome screen view - extracted from main App component */
function WelcomeView({ onboarding, isOffline }: { onboarding: OnboardingState; isOffline: boolean }) {
  const state = onboarding.state as { status: 'welcome' | 'vault-missing'; defaultPath: string; vaultPath?: string }
  return (
    <div className="app-shell">
      <WelcomeScreen
        mode={state.status === 'welcome' ? 'welcome' : 'vault-missing'}
        missingPath={state.status === 'vault-missing' ? state.vaultPath : undefined}
        defaultVaultPath={state.defaultPath}
        onCreateVault={onboarding.handleCreateVault}
        onRetryCreateVault={onboarding.retryCreateVault}
        onCreateEmptyVault={onboarding.handleCreateEmptyVault}
        onOpenFolder={onboarding.handleOpenFolder}
        isOffline={isOffline}
        creatingAction={onboarding.creatingAction}
        error={onboarding.error}
        canRetryTemplate={onboarding.canRetryTemplate}
      />
    </div>
  )
}

export default App
