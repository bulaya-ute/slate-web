import { create } from 'zustand'

export type OverlayKind = 'none' | 'graph' | 'settings'

interface OverlayState {
  active: OverlayKind
  openGraph: () => void
  openSettings: () => void
  close: () => void
}

/**
 * Which app-wide full-screen overlay (graph view / settings) is
 * currently shown, mounted once at `AppShell` — like `CommandPalette`,
 * neither of these needs to live anywhere in the component tree closer
 * to what opens them (a header button, a command-palette entry, an
 * explorer action all just call these actions directly). Deliberately
 * not persisted — an overlay reappearing after a reload would be
 * surprising.
 */
export const useOverlay = create<OverlayState>((set) => ({
  active: 'none',
  openGraph: () => set({ active: 'graph' }),
  openSettings: () => set({ active: 'settings' }),
  close: () => set({ active: 'none' }),
}))
