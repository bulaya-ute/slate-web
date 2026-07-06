import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeOverride = 'system' | 'light' | 'dark'

interface ThemeState {
  /** 'system' defers to `prefers-color-scheme` (theme.css handles it). */
  override: ThemeOverride
  setOverride: (override: ThemeOverride) => void
}

/**
 * Applies the override to the DOM: `data-theme="light"|"dark"` wins
 * over the media query in theme.css; removing the attribute for
 * 'system' lets the media query take back over.
 */
export function applyThemeToDom(override: ThemeOverride): void {
  const root = document.documentElement
  if (override === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', override)
  }
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      override: 'system',
      setOverride: (override) => {
        set({ override })
        applyThemeToDom(override)
      },
    }),
    {
      name: 'slate.theme',
      onRehydrateStorage: () => (state) => {
        // Runs after localStorage state is read back in, so a stored
        // override is reflected on the very first paint after reload.
        if (state) applyThemeToDom(state.override)
      },
    },
  ),
)

// Apply once synchronously at module load too: zustand's localStorage
// persist is synchronous in browsers, but this covers the case where
// there is nothing stored yet (first-ever visit, still 'system').
applyThemeToDom(useTheme.getState().override)
