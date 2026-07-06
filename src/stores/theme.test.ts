import { beforeEach, describe, expect, it } from 'vitest'
import { applyThemeToDom, useTheme } from './theme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  useTheme.setState({ override: 'system' })
})

describe('applyThemeToDom', () => {
  it('sets data-theme="dark" for an explicit dark override', () => {
    applyThemeToDom('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('sets data-theme="light" for an explicit light override', () => {
    applyThemeToDom('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('removes data-theme for "system" so the prefers-color-scheme media query governs', () => {
    applyThemeToDom('dark')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(true)
    applyThemeToDom('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})

describe('useTheme store', () => {
  it('defaults to "system" with no DOM override applied', () => {
    expect(useTheme.getState().override).toBe('system')
  })

  it('setOverride updates state and reflects immediately onto <html>', () => {
    useTheme.getState().setOverride('dark')
    expect(useTheme.getState().override).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    useTheme.getState().setOverride('light')
    expect(useTheme.getState().override).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    useTheme.getState().setOverride('system')
    expect(useTheme.getState().override).toBe('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('persists the override to localStorage under the slate.theme key', () => {
    useTheme.getState().setOverride('dark')
    const raw = localStorage.getItem('slate.theme')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string)
    expect(parsed.state.override).toBe('dark')
  })
})
