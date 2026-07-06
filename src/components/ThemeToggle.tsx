import type { ReactElement } from 'react'
import { Tooltip } from './ui/Tooltip'
import { useTheme, type ThemeOverride } from '../stores/theme'

const ORDER: ThemeOverride[] = ['system', 'light', 'dark']
const LABEL: Record<ThemeOverride, string> = {
  system: 'Theme: matching system',
  light: 'Theme: light',
  dark: 'Theme: dark',
}

const ICONS: Record<ThemeOverride, ReactElement> = {
  system: (
    <path
      d="M10 3.5v1M10 15.5v1M3.5 10h1M15.5 10h1M5.6 5.6l.7.7M13.7 13.7l.7.7M14.4 5.6l-.7.7M6.3 13.7l-.7.7"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  ),
  light: <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.4" />,
  dark: (
    <path
      d="M15 11.5A5.5 5.5 0 0 1 8.5 5c0-.7.1-1.4.4-2A6 6 0 1 0 17 12.1c-.6.3-1.3.4-2 .4Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  ),
}

/** Cycles system → light → dark → system. Persists via the theme store. */
export function ThemeToggle() {
  const override = useTheme((s) => s.override)
  const setOverride = useTheme((s) => s.setOverride)

  function cycle() {
    const next = ORDER[(ORDER.indexOf(override) + 1) % ORDER.length]
    setOverride(next)
  }

  return (
    <Tooltip content={LABEL[override]}>
      <button
        type="button"
        onClick={cycle}
        aria-label={LABEL[override]}
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition duration-150 ease-out hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          {ICONS[override]}
        </svg>
      </button>
    </Tooltip>
  )
}
