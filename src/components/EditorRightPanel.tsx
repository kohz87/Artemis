import type { useCreateBlockNote } from '@blocknote/react'
import type { AppLocale } from '../lib/i18n'
import type { VaultEntry, GitCommit } from '../types'
import { Inspector, type FrontmatterValue } from './Inspector'
import { TableOfContentsPanel } from './TableOfContentsPanel'

interface EditorRightPanelProps {
  showTableOfContents?: boolean
  inspectorCollapsed: boolean
  inspectorWidth: number
  editor: ReturnType<typeof useCreateBlockNote>
  inspectorEntry: VaultEntry | null
  inspectorContent: string | null
  entries: VaultEntry[]
  gitHistory: GitCommit[]
  vaultPath: string
  onToggleInspector: () => void
  onToggleTableOfContents?: () => void
  onNavigateWikilink: (target: string) => void
  onViewCommitDiff: (commitHash: string) => Promise<void>
  onUpdateFrontmatter?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onDeleteProperty?: (path: string, key: string) => Promise<void>
  onAddProperty?: (path: string, key: string, value: FrontmatterValue) => Promise<void>
  onCreateMissingType?: (path: string, missingType: string, nextTypeName: string) => Promise<boolean | void>
  onCreateAndOpenNote?: (title: string) => Promise<boolean>
  onInitializeProperties?: (path: string) => void
  onToggleRawEditor?: () => void
  locale?: AppLocale
}

export function EditorRightPanel({
  showTableOfContents, inspectorCollapsed, inspectorWidth,
  editor,
  inspectorEntry, inspectorContent, entries, gitHistory, vaultPath,
  onToggleInspector, onToggleTableOfContents, onNavigateWikilink, onViewCommitDiff,
  onUpdateFrontmatter, onDeleteProperty, onAddProperty, onCreateMissingType, onCreateAndOpenNote, onInitializeProperties, onToggleRawEditor,
  locale,
}: EditorRightPanelProps) {
  if (!inspectorCollapsed) {
    return (
      <div
        className="editor-right-panel shrink-0 flex flex-col min-h-0"
        style={{ width: inspectorWidth, height: '100%' }}
      >
        <Inspector
          collapsed={inspectorCollapsed}
          onToggle={onToggleInspector}
          entry={inspectorEntry}
          content={inspectorContent}
          entries={entries}
          gitHistory={gitHistory}
          vaultPath={vaultPath}
          onNavigate={onNavigateWikilink}
          onViewCommitDiff={onViewCommitDiff}
          onUpdateFrontmatter={onUpdateFrontmatter}
          onDeleteProperty={onDeleteProperty}
          onAddProperty={onAddProperty}
          onCreateMissingType={onCreateMissingType}
          onCreateAndOpenNote={onCreateAndOpenNote}
          onInitializeProperties={onInitializeProperties}
          onToggleRawEditor={onToggleRawEditor}
          locale={locale}
        />
      </div>
    )
  }

  if (showTableOfContents) {
    return (
      <div
        className="editor-right-panel shrink-0 flex flex-col min-h-0"
        style={{ width: inspectorWidth, minWidth: 240, height: '100%' }}
      >
        <TableOfContentsPanel
          editor={editor}
          entry={inspectorEntry}
          locale={locale}
          onClose={() => onToggleTableOfContents?.()}
          sourceContent={inspectorContent}
        />
      </div>
    )
  }

  return null
}
