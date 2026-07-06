import { useState } from 'react'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Explorer } from '../explorer/Explorer'
import { loadWorkspaceLayout, saveWorkspaceLayout } from './layoutStorage'
import { WorkspaceMain } from './WorkspaceMain'

export interface WorkspaceLayoutProps {
  /** Lets the app header's sidebar-toggle button drive the same panel. */
  sidebarPanelRef: React.Ref<PanelImperativeHandle | null>
}

/**
 * The resizable + collapsible two-pane workspace shell: a sidebar (vault
 * switcher + file explorer) and the main pane (tabs + note view). Sizes
 * and collapse state persist together via `defaultLayout` /
 * `onLayoutChanged` — a collapsed sidebar just means its persisted size
 * is 0, so it stays collapsed across reloads with no separate flag.
 */
export function WorkspaceLayout({ sidebarPanelRef }: WorkspaceLayoutProps) {
  const [initialLayout] = useState(() => loadWorkspaceLayout())

  return (
    <Group
      orientation="horizontal"
      defaultLayout={initialLayout}
      onLayoutChanged={(layout) => saveWorkspaceLayout(layout)}
      style={{ height: '100%' }}
    >
      <Panel
        id="sidebar"
        panelRef={sidebarPanelRef}
        collapsible
        collapsedSize={0}
        minSize={15}
        maxSize={40}
        defaultSize={initialLayout.sidebar}
        className="bg-bg-inset"
      >
        <Explorer />
      </Panel>
      <Separator className="w-px shrink-0 cursor-col-resize bg-border transition-colors duration-150 ease-out hover:bg-accent" />
      <Panel id="main" minSize={40} defaultSize={initialLayout.main}>
        <WorkspaceMain />
      </Panel>
    </Group>
  )
}
