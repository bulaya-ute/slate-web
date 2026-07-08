import { beforeEach, describe, expect, it } from 'vitest'
import { tabsForVault, useTabs } from './tabs.store'

const VAULT_A = 'vault-a'
const VAULT_B = 'vault-b'

beforeEach(() => {
  localStorage.clear()
  useTabs.setState({ byVault: {} })
})

describe('openTab', () => {
  it('opens a new tab and makes it active', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    const vault = tabsForVault(VAULT_A)
    expect(vault.tabs).toEqual([{ noteId: 'n1', path: 'a.md', title: 'a', dirty: false }])
    expect(vault.activeNoteId).toBe('n1')
  })

  it('appends subsequent tabs in open order', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    useTabs.getState().openTab(VAULT_A, { noteId: 'n2', path: 'b.md', title: 'b' })
    expect(tabsForVault(VAULT_A).tabs.map((t) => t.noteId)).toEqual(['n1', 'n2'])
    expect(tabsForVault(VAULT_A).activeNoteId).toBe('n2')
  })

  it('re-opening an already-open note activates it instead of duplicating', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    useTabs.getState().openTab(VAULT_A, { noteId: 'n2', path: 'b.md', title: 'b' })
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    expect(tabsForVault(VAULT_A).tabs).toHaveLength(2)
    expect(tabsForVault(VAULT_A).activeNoteId).toBe('n1')
  })

  it('keeps separate tab sets per vault', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    useTabs.getState().openTab(VAULT_B, { noteId: 'n2', path: 'b.md', title: 'b' })
    expect(tabsForVault(VAULT_A).tabs.map((t) => t.noteId)).toEqual(['n1'])
    expect(tabsForVault(VAULT_B).tabs.map((t) => t.noteId)).toEqual(['n2'])
  })

  it('opts into opening in the background with { activate: false } — added for Ctrl+click wikilinks', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    useTabs.getState().openTab(VAULT_A, { noteId: 'n2', path: 'b.md', title: 'b' }, { activate: false })
    expect(tabsForVault(VAULT_A).tabs.map((t) => t.noteId)).toEqual(['n1', 'n2']) // still opened as a tab
    expect(tabsForVault(VAULT_A).activeNoteId).toBe('n1') // but focus stayed put
  })
})

describe('closeTab', () => {
  it('removes the tab', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    useTabs.getState().closeTab(VAULT_A, 'n1')
    expect(tabsForVault(VAULT_A).tabs).toEqual([])
    expect(tabsForVault(VAULT_A).activeNoteId).toBeNull()
  })

  it('activates the neighbor to the right when closing a non-last active tab', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    useTabs.getState().openTab(VAULT_A, { noteId: 'n2', path: 'b.md', title: 'b' })
    useTabs.getState().openTab(VAULT_A, { noteId: 'n3', path: 'c.md', title: 'c' })
    useTabs.getState().setActive(VAULT_A, 'n2')
    useTabs.getState().closeTab(VAULT_A, 'n2')
    expect(tabsForVault(VAULT_A).tabs.map((t) => t.noteId)).toEqual(['n1', 'n3'])
    expect(tabsForVault(VAULT_A).activeNoteId).toBe('n3')
  })

  it('activates the neighbor to the left when closing the last (active) tab', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    useTabs.getState().openTab(VAULT_A, { noteId: 'n2', path: 'b.md', title: 'b' })
    useTabs.getState().closeTab(VAULT_A, 'n2')
    expect(tabsForVault(VAULT_A).activeNoteId).toBe('n1')
  })

  it('leaves the active tab untouched when closing a different, inactive tab', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    useTabs.getState().openTab(VAULT_A, { noteId: 'n2', path: 'b.md', title: 'b' })
    useTabs.getState().setActive(VAULT_A, 'n2')
    useTabs.getState().closeTab(VAULT_A, 'n1')
    expect(tabsForVault(VAULT_A).activeNoteId).toBe('n2')
    expect(tabsForVault(VAULT_A).tabs.map((t) => t.noteId)).toEqual(['n2'])
  })

  it('is a no-op for a note id that is not open', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    useTabs.getState().closeTab(VAULT_A, 'missing')
    expect(tabsForVault(VAULT_A).tabs).toHaveLength(1)
  })
})

describe('reorder', () => {
  it('moves a tab from one index to another', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    useTabs.getState().openTab(VAULT_A, { noteId: 'n2', path: 'b.md', title: 'b' })
    useTabs.getState().openTab(VAULT_A, { noteId: 'n3', path: 'c.md', title: 'c' })
    useTabs.getState().reorder(VAULT_A, 0, 2)
    expect(tabsForVault(VAULT_A).tabs.map((t) => t.noteId)).toEqual(['n2', 'n3', 'n1'])
  })

  it('ignores out-of-range indices', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    useTabs.getState().reorder(VAULT_A, 0, 5)
    expect(tabsForVault(VAULT_A).tabs.map((t) => t.noteId)).toEqual(['n1'])
  })
})

describe('setDirty', () => {
  it('flips the dirty flag for the targeted tab only', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    useTabs.getState().openTab(VAULT_A, { noteId: 'n2', path: 'b.md', title: 'b' })
    useTabs.getState().setDirty(VAULT_A, 'n1', true)
    const tabs = tabsForVault(VAULT_A).tabs
    expect(tabs.find((t) => t.noteId === 'n1')?.dirty).toBe(true)
    expect(tabs.find((t) => t.noteId === 'n2')?.dirty).toBe(false)
  })
})

describe('renameOpenTab', () => {
  it('updates path and title for an open tab (explorer rename/move sync)', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'old/a.md', title: 'a' })
    useTabs.getState().renameOpenTab(VAULT_A, 'n1', 'new/a.md', 'renamed')
    const tab = tabsForVault(VAULT_A).tabs[0]
    expect(tab.path).toBe('new/a.md')
    expect(tab.title).toBe('renamed')
  })

  it('keeps the existing title when no new title is given', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'old/a.md', title: 'a' })
    useTabs.getState().renameOpenTab(VAULT_A, 'n1', 'new/a.md')
    expect(tabsForVault(VAULT_A).tabs[0].title).toBe('a')
  })
})

describe('persistence shape', () => {
  it('persists byVault to localStorage under the slate.tabs key', () => {
    useTabs.getState().openTab(VAULT_A, { noteId: 'n1', path: 'a.md', title: 'a' })
    const raw = localStorage.getItem('slate.tabs')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string)
    expect(parsed.state.byVault[VAULT_A].tabs).toEqual([
      { noteId: 'n1', path: 'a.md', title: 'a', dirty: false },
    ])
    expect(parsed.state.byVault[VAULT_A].activeNoteId).toBe('n1')
  })
})

describe('tabsForVault', () => {
  it('returns an empty, inactive shape for a null or unknown vault id', () => {
    expect(tabsForVault(null)).toEqual({ tabs: [], activeNoteId: null })
    expect(tabsForVault('never-opened')).toEqual({ tabs: [], activeNoteId: null })
  })
})
