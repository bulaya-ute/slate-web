import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteMeta, Vault, VaultTree } from '../lib/api/types'
import { useActiveVault } from '../stores/activeVault'
import { useAuth } from '../stores/auth'
import { useServer } from '../stores/servers'
import { useTabs } from '../features/tabs/tabs.store'
import { AppShell } from './AppShell'

const VAULT: Vault = {
  id: 'vault-1',
  name: 'Demo Vault',
  role: 'owner',
  noteCount: 1,
  sizeBytes: 100,
  createdAt: '2026-01-01T00:00:00Z',
}

const NOTE: NoteMeta = {
  id: 'note-1',
  path: 'Welcome.md',
  title: 'Welcome',
  hasConflict: false,
  sizeBytes: 20,
  updatedAt: '2026-01-01T00:00:00Z',
}

function textResponse(body: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(body),
    text: async () => body,
    clone() {
      return textResponse(body)
    },
  } as unknown as Response
}

function jsonResponse(body: unknown): Response {
  return textResponse(JSON.stringify(body))
}

function renderAppShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  useServer.setState({ current: 'https://server.test', remembered: [] })
  useAuth.setState({
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    user: { id: 'u1', username: 'ada', displayName: 'Ada', role: 'User', isDisabled: false },
  })
  useActiveVault.setState({ activeVaultId: null })
  useTabs.setState({ byVault: {} })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * End-to-end (within jsdom) sanity check for the whole workspace wiring:
 * header, the resizable panel shell (react-resizable-panels needs the
 * ResizeObserver stub from src/test/setup.ts to mount at all under
 * jsdom), the vault switcher, the explorer, and the tab/note-view flow
 * all assembled together — the seam most likely to hide an integration
 * bug that unit-level tests on individual stores/components would miss.
 */
describe('AppShell (workspace integration)', () => {
  it('renders the header and the no-vaults empty state end to end', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/api/vaults')) return Promise.resolve(jsonResponse([]))
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )

    renderAppShell()

    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(await screen.findByText('No vaults yet')).toBeInTheDocument()
  })

  it('opening a note from the explorer shows it in the tab bar and loads its content', async () => {
    const tree: VaultTree = { folders: [], notes: [NOTE] }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/api/vaults')) return Promise.resolve(jsonResponse([VAULT]))
        if (url.endsWith('/api/vaults/vault-1/tree')) return Promise.resolve(jsonResponse(tree))
        if (url.endsWith('/api/notes/note-1/content')) return Promise.resolve(textResponse('# Welcome\n\nHello.'))
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )

    renderAppShell()

    const noteRow = await screen.findByText('Welcome')
    noteRow.click()

    // Opened as a tab...
    expect(await screen.findByRole('tab', { name: /Welcome/ })).toBeInTheDocument()
    // ...and its raw content loads in the placeholder note view. (RTL's
    // text matcher collapses whitespace/newlines, so match a substring.)
    expect(await screen.findByText(/Hello\./)).toBeInTheDocument()
  })
})
