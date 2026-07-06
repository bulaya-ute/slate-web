import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteMeta, Vault, VaultTree } from '../../lib/api/types'
import { useActiveVault } from '../../stores/activeVault'
import { useAuth } from '../../stores/auth'
import { useServer } from '../../stores/servers'
import { useExplorerStore } from './explorer.store'
import { Explorer } from './Explorer'

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

function renderExplorer() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Explorer />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  useServer.setState({ current: 'https://server.test', remembered: [] })
  useAuth.setState({ accessToken: 'access-1', refreshToken: 'refresh-1', user: null })
  useActiveVault.setState({ activeVaultId: null })
  useExplorerStore.setState({ expandedByVault: {} })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Explorer', () => {
  it('auto-selects the first vault and renders its nested tree', async () => {
    const tree: VaultTree = { folders: ['Folder'], notes: [note()] }
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/api/vaults')) return Promise.resolve(jsonResponse([VAULT]))
      if (url.endsWith('/api/vaults/vault-1/tree')) return Promise.resolve(jsonResponse(tree))
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderExplorer()

    expect(await screen.findByText('Demo Vault')).toBeInTheDocument()
    expect(await screen.findByText('Folder')).toBeInTheDocument()
    await waitFor(() => expect(useActiveVault.getState().activeVaultId).toBe('vault-1'))
  })

  it('shows the empty-vault state with create actions when the tree has no folders or notes', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/api/vaults')) return Promise.resolve(jsonResponse([VAULT]))
      if (url.endsWith('/api/vaults/vault-1/tree')) return Promise.resolve(jsonResponse({ folders: [], notes: [] }))
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderExplorer()

    expect(await screen.findByText('This vault is empty')).toBeInTheDocument()
  })

  it('shows a no-vaults empty state with a create-vault CTA when there are no vaults', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/api/vaults')) return Promise.resolve(jsonResponse([]))
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderExplorer()

    expect(await screen.findByText('No vaults yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create vault' })).toBeInTheDocument()
  })
})
