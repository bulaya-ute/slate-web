import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SidebarView = 'files' | 'search' | 'tags'

interface SidebarViewState {
  view: SidebarView
  setView: (view: SidebarView) => void
}

/** Which of the left sidebar's three sub-views (explorer/search/tags) is showing — persisted like the rest of the layout. */
export const useSidebarView = create<SidebarViewState>()(
  persist(
    (set) => ({
      view: 'files',
      setView: (view) => set({ view }),
    }),
    { name: 'slate.sidebar-view' },
  ),
)
