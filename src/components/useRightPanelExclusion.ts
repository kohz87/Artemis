import { useCallback, useState } from 'react'
import { trackEvent } from '../lib/telemetry'

interface RightPanelExclusionOptions {
  inspectorCollapsed: boolean
  onToggleInspector: () => void
}

interface RightPanelToggleOptions extends RightPanelExclusionOptions {
  closeTableOfContents: () => void
  openTableOfContents?: () => void
  showTableOfContents?: boolean
}

function prepareRightPanelOpen(
  panel: 'properties',
  {
    closeTableOfContents,
    inspectorCollapsed,
  }: RightPanelToggleOptions,
) {
  if (panel === 'properties' && !inspectorCollapsed) return

  closeTableOfContents()
}

function toggleTableOfContentsPanel({
  closeTableOfContents,
  inspectorCollapsed,
  onToggleInspector,
  openTableOfContents,
  showTableOfContents,
}: RightPanelToggleOptions) {
  if (showTableOfContents) {
    closeTableOfContents()
    return
  }

  if (!inspectorCollapsed) onToggleInspector()
  openTableOfContents?.()
}

export function useRightPanelExclusion({
  inspectorCollapsed,
  onToggleInspector,
}: RightPanelExclusionOptions) {
  const [showTableOfContents, setShowTableOfContents] = useState(false)
  const closeTableOfContents = useCallback(() => setShowTableOfContents(false), [])

  const handleToggleInspectorPanel = useCallback(() => {
    prepareRightPanelOpen('properties', {
      closeTableOfContents,
      inspectorCollapsed,
      onToggleInspector,
    })
    onToggleInspector()
  }, [closeTableOfContents, inspectorCollapsed, onToggleInspector])

  const handleToggleTableOfContents = useCallback(() => {
    trackEvent('table_of_contents_toggled', { open: showTableOfContents ? 0 : 1 })
    toggleTableOfContentsPanel({
      closeTableOfContents,
      inspectorCollapsed,
      onToggleInspector,
      openTableOfContents: () => setShowTableOfContents(true),
      showTableOfContents,
    })
  }, [closeTableOfContents, inspectorCollapsed, onToggleInspector, showTableOfContents])

  return {
    handleToggleInspectorPanel,
    handleToggleTableOfContents,
    showTableOfContents,
  }
}
