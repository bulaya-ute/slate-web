import { create } from 'zustand'

interface SidebarControlState {
  /** Set by `AppShell` (the component that owns the sidebar `Panel`'s imperative ref). */
  expandSidebar: (() => void) | null
  setExpandSidebar: (fn: (() => void) | null) => void
}

/**
 * Lets code outside `AppShell` (the command palette's "Open vault
 * switcher" command) ask the sidebar panel to expand without
 * prop-drilling the `react-resizable-panels` ref through the tree —
 * mirrors `activeEditorController`'s "narrow controller registered by
 * the owning component" shape.
 */
export const useSidebarControl = create<SidebarControlState>((set) => ({
  expandSidebar: null,
  setExpandSidebar: (fn) => set({ expandSidebar: fn }),
}))
