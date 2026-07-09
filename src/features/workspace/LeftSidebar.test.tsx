import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteMeta, TagCount, Vault, VaultTree } from '../../lib/api/types'
import { useActiveVault } from '../../stores/activeVault'
import { useAuth } from '../../stores/auth'
import { useServer } from '../../stores/servers'
import { useExplorerStore } from '../explorer/explorer.store'
import { LeftSidebar } from './LeftSidebar'
import { useSidebarView } from './sidebarView.store'

const VAULT: Vault = {
  id: 'vault-1',
  name: 'Demo Vault',
  role: 'owner',
  noteCount: 1,
  sizeBytes: 100,
  createdAt: '2026-01-01T00:00:00Z',
}

function note(overrides: Partial<NoteMeta> = {}): NoteMeta {
  return {
    id: 'note-1',
    path: 'Folder/Note.md',
    title: 'Note',
    hasConflict: false,
    sizeBytes: 10,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
      return jsonResponse(body)
    },
  } as unknown as Response
}

function renderLeftSidebar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <LeftSidebar />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  useServer.setState({ current: 'https://server.test', remembered: [] })
  useAuth.setState({ accessToken: 'access-1', refreshToken: 'refresh-1', user: null })
  useActiveVault.setState({ activeVaultId: null })
  useExplorerStore.setState({ expandedByVault: {} })
  useSidebarView.setState({ view: 'files' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LeftSidebar', () => {
  it('auto-selects the first vault (via the pinned vault switcher) and shows its tree by default', async () => {
    const tree: VaultTree = { folders: ['Folder'], notes: [note()] }
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/api/vaults')) return Promise.resolve(jsonResponse([VAULT]))
      if (url.endsWith('/api/vaults/vault-1/tree')) return Promise.resolve(jsonResponse(tree))
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderLeftSidebar()

    expect(await screen.findByText('Demo Vault')).toBeInTheDocument()
    expect(await screen.findByText('Folder')).toBeInTheDocument()
  })

  it('shows a no-vaults empty state with a create-vault CTA when there are no vaults', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/api/vaults')) return Promise.resolve(jsonResponse([]))
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderLeftSidebar()

    expect(await screen.findByText('No vaults yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create vault' })).toBeInTheDocument()
    // No active vault yet, so the view switcher and sub-views don't render at all.
    expect(screen.queryByRole('tablist', { name: 'Sidebar view' })).not.toBeInTheDocument()
  })

  it('switches to the Search sub-view and keeps the vault switcher visible', async () => {
    const tree: VaultTree = { folders: [], notes: [note()] }
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/api/vaults')) return Promise.resolve(jsonResponse([VAULT]))
      if (url.endsWith('/api/vaults/vault-1/tree')) return Promise.resolve(jsonResponse(tree))
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderLeftSidebar()
    expect(await screen.findByText('Demo Vault')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Search' }))

    expect(await screen.findByPlaceholderText('Search notes…')).toBeInTheDocument()
    expect(screen.getByText('Demo Vault')).toBeInTheDocument()
  })

  it('switches to the Tags sub-view and fetches vault tags', async () => {
    const tree: VaultTree = { folders: [], notes: [] }
    const tags: TagCount[] = []
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/api/vaults')) return Promise.resolve(jsonResponse([VAULT]))
      if (url.endsWith('/api/vaults/vault-1/tree')) return Promise.resolve(jsonResponse(tree))
      if (url.endsWith('/api/vaults/vault-1/tags')) return Promise.resolve(jsonResponse(tags))
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderLeftSidebar()
    expect(await screen.findByText('Demo Vault')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Tags' }))

    expect(await screen.findByText('No tags yet')).toBeInTheDocument()
  })
})
