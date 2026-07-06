import { describe, expect, it } from 'vitest'
import { DEFAULT_WORKSPACE_LAYOUT, loadWorkspaceLayout, saveWorkspaceLayout } from './layoutStorage'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value
    },
    data,
  }
}

describe('loadWorkspaceLayout', () => {
  it('falls back to the default when nothing is stored', () => {
    expect(loadWorkspaceLayout(fakeStorage())).toEqual(DEFAULT_WORKSPACE_LAYOUT)
  })

  it('falls back to the default on malformed JSON', () => {
    expect(loadWorkspaceLayout(fakeStorage({ 'slate.workspace.layout': '{not json' }))).toEqual(
      DEFAULT_WORKSPACE_LAYOUT,
    )
  })

  it('falls back to the default when values are not all numbers', () => {
    const storage = fakeStorage({ 'slate.workspace.layout': JSON.stringify({ sidebar: '22', main: 78 }) })
    expect(loadWorkspaceLayout(storage)).toEqual(DEFAULT_WORKSPACE_LAYOUT)
  })

  it('returns a previously-saved layout', () => {
    const storage = fakeStorage({ 'slate.workspace.layout': JSON.stringify({ sidebar: 30, main: 70 }) })
    expect(loadWorkspaceLayout(storage)).toEqual({ sidebar: 30, main: 70 })
  })

  it('round-trips through saveWorkspaceLayout', () => {
    const storage = fakeStorage()
    saveWorkspaceLayout({ sidebar: 0, main: 100 }, storage)
    expect(loadWorkspaceLayout(storage)).toEqual({ sidebar: 0, main: 100 })
  })
})
