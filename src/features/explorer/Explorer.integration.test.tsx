import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteMeta, VaultTree } from '../../lib/api/types'
import { useActiveVault } from '../../stores/activeVault'
import { useAuth } from '../../stores/auth'
import { useServer } from '../../stores/servers'
import { useExplorerStore } from './explorer.store'
import { Explorer } from './Explorer'

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

// Explorer itself no longer renders the vault switcher (it's hoisted to
// `LeftSidebar`, pinned above all three sidebar sub-views — see that
// component's doc comment) or auto-selects a vault (that's the
// switcher's job too, covered by `LeftSidebar.test.tsx`). These tests
// exercise Explorer in isolation, so they seed an active vault directly
// rather than relying on that auto-select side effect.
beforeEach(() => {
  localStorage.clear()
  useServer.setState({ current: 'https://server.test', remembered: [] })
  useAuth.setState({ accessToken: 'access-1', refreshToken: 'refresh-1', user: null })
  useActiveVault.setState({ activeVaultId: 'vault-1' })
  useExplorerStore.setState({ expandedByVault: {} })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Explorer', () => {
  it("renders the active vault's nested tree", async () => {
    const tree: VaultTree = { folders: ['Folder'], notes: [note()] }
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/api/vaults/vault-1/tree')) return Promise.resolve(jsonResponse(tree))
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderExplorer()

    expect(await screen.findByText('Folder')).toBeInTheDocument()
  })

  it('shows the empty-vault state with create actions when the tree has no folders or notes', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/api/vaults/vault-1/tree')) return Promise.resolve(jsonResponse({ folders: [], notes: [] }))
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderExplorer()

    expect(await screen.findByText('This vault is empty')).toBeInTheDocument()
  })
})
