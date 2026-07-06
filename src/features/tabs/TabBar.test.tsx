import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { TabBar } from './TabBar'
import { useTabs } from './tabs.store'

const VAULT = 'vault-1'

beforeEach(() => {
  localStorage.clear()
  useTabs.setState({ byVault: {} })
})

describe('TabBar', () => {
  it('renders nothing visible (an empty strip) when there are no open tabs', () => {
    render(<TabBar vaultId={VAULT} />)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('renders each open tab and marks the active one selected', () => {
    useTabs.getState().openTab(VAULT, { noteId: 'n1', path: 'a.md', title: 'Alpha' })
    useTabs.getState().openTab(VAULT, { noteId: 'n2', path: 'b.md', title: 'Beta' })

    render(<TabBar vaultId={VAULT} />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent?.replace('×', '').trim())).toEqual(['Alpha', 'Beta'])
    expect(screen.getByRole('tab', { name: /Beta/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Alpha/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('clicking a tab makes it active', () => {
    useTabs.getState().openTab(VAULT, { noteId: 'n1', path: 'a.md', title: 'Alpha' })
    useTabs.getState().openTab(VAULT, { noteId: 'n2', path: 'b.md', title: 'Beta' })

    render(<TabBar vaultId={VAULT} />)
    fireEvent.click(screen.getByRole('tab', { name: /Alpha/ }))

    expect(useTabs.getState().byVault[VAULT].activeNoteId).toBe('n1')
  })

  it('clicking the close button removes the tab', () => {
    useTabs.getState().openTab(VAULT, { noteId: 'n1', path: 'a.md', title: 'Alpha' })

    render(<TabBar vaultId={VAULT} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close Alpha' }))

    expect(useTabs.getState().byVault[VAULT].tabs).toEqual([])
  })

  it('shows a dirty dot only for dirty tabs', () => {
    useTabs.getState().openTab(VAULT, { noteId: 'n1', path: 'a.md', title: 'Alpha' })
    useTabs.getState().setDirty(VAULT, 'n1', true)

    render(<TabBar vaultId={VAULT} />)

    expect(screen.getByRole('img', { name: 'Unsaved changes' })).toBeInTheDocument()
  })
})
