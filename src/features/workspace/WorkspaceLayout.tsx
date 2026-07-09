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
 *
 * `minSize`/`maxSize`/`defaultSize` are passed as `"NN%"` strings, not
 * bare numbers — found and fixed during Task W5's verification pass.
 * react-resizable-panels v4 treats a bare number as *pixels*, not
 * percent (only unitless strings/`"NN%"` are percentages); every value
 * here and in `layoutStorage.ts`'s `WorkspaceLayout` (a percentage-of-
 * group map, per that file's own doc comment) was written assuming the
 * old percentage-by-default convention. With bare numbers the sidebar
 * and right panels were silently clamped to a 40px `maxSize`
 * (~2-3% of a typical viewport) — collapsed-looking and too narrow for
 * any label text to render, even though the panels themselves reported
 * as "not collapsed". Pre-existing bug, unrelated to this task's own
 * feature work; fixed here because it made the sidebar unusable enough
 * to block manually verifying anything that lives in it (explorer,
 * search, tags — including this task's conflict badge → resolve flow).
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
        minSize="15%"
        maxSize="40%"
        defaultSize={`${initialLayout.sidebar}%`}
        className="bg-bg-inset"
      >
        <LeftSidebar />
      </Panel>
      <Separator className={SEPARATOR_CLASS} />
      <Panel id="main" minSize="30%" defaultSize={`${initialLayout.main}%`}>
        <WorkspaceMain />
      </Panel>
      <Separator className={SEPARATOR_CLASS} />
      <Panel
        id="right"
        collapsible
        collapsedSize={0}
        minSize="15%"
        maxSize="40%"
        defaultSize={`${initialLayout.right ?? 20}%`}
        className="bg-bg-inset"
      >
        <RightSidebar />
      </Panel>
    </Group>
  )
}
