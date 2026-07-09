import { create } from 'zustand'

export type PaletteMode = 'closed' | 'switcher' | 'commands'

interface PaletteState {
  mode: PaletteMode
  open: (mode: 'switcher' | 'commands') => void
  close: () => void
}

/** Command palette open/closed + which of its two modes (quick switcher vs. command list) is showing. */
export const usePaletteStore = create<PaletteState>((set) => ({
  mode: 'closed',
  open: (mode) => set({ mode }),
  close: () => set({ mode: 'closed' }),
}))
