import { useState } from 'react'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { LeftSidebar } from './LeftSidebar'
import { loadWorkspaceLayout, saveWorkspaceLayout } from './layoutStorage'
import { RightSidebar } from './RightSidebar'
import { WorkspaceMain } from './WorkspaceMain'

export interface WorkspaceLayoutProps {
  /** Lets the app header's sidebar-toggle button drive the same panel. */
  sidebarPanelRef: React.Ref<PanelImperativeHandle | null>
}

const SEPARATOR_CLASS =
  'w-px shrink-0 cursor-col-resize bg-border transition-colors duration-150 ease-out hover:bg-accent'

/**
 * The resizable + collapsible three-pane workspace shell: a left
 * sidebar (vault switcher + explorer/search/tags), the main pane (tabs
 * + note view), and a right sidebar (outline + backlinks). Sizes and
 * collapse state persist together via `defaultLayout` /
 * `onLayoutChanged` — a collapsed panel just means its persisted size
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
        <LeftSidebar />
      </Panel>
      <Separator className={SEPARATOR_CLASS} />
      <Panel id="main" minSize={30} defaultSize={initialLayout.main}>
        <WorkspaceMain />
      </Panel>
      <Separator className={SEPARATOR_CLASS} />
      <Panel
        id="right"
        collapsible
        collapsedSize={0}
        minSize={15}
        maxSize={40}
        defaultSize={initialLayout.right ?? 20}
        className="bg-bg-inset"
      >
        <RightSidebar />
      </Panel>
    </Group>
  )
}
