import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteMeta, VaultTree } from '../../lib/api/types'
import { useActiveVault } from '../../stores/activeVault'
import { useAuth } from '../../stores/auth'
import { useServer } from '../../stores/servers'
import { useTheme } from '../../stores/theme'
import { useTabs } from '../tabs/tabs.store'
import { CommandPalette } from './CommandPalette'
import { usePaletteStore } from './palette.store'

function note(overrides: Partial<NoteMeta> = {}): NoteMeta {
  return {
    id: 'note-1',
    path: 'Daily Notes.md',
    title: 'Daily Notes',
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

function renderPalette() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CommandPalette />
    </QueryClientProvider>,
  )
}

const VAULT = 'vault-1'

beforeEach(() => {
  localStorage.clear()
  useServer.setState({ current: 'https://server.test', remembered: [] })
  useAuth.setState({ accessToken: 'access-1', refreshToken: 'refresh-1', user: null })
  useActiveVault.setState({ activeVaultId: VAULT })
  useTabs.setState({ byVault: {} })
  usePaletteStore.setState({ mode: 'closed' })
  useTheme.setState({ override: 'system' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CommandPalette — quick switcher (Ctrl/Cmd+P)', () => {
  it('opens on Ctrl+P, filters notes by fuzzy title, and opens the selected note on Enter', async () => {
    const tree: VaultTree = {
      folders: [],
      notes: [note(), note({ id: 'note-2', path: 'Project Roadmap.md', title: 'Project Roadmap' })],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith(`/api/vaults/${VAULT}/tree`)) return Promise.resolve(jsonResponse(tree))
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )

    renderPalette()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true })

    expect(await screen.findByRole('dialog', { name: 'Quick switcher' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('option', { name: /Daily Notes/ })).toBeInTheDocument())
    expect(screen.getByRole('option', { name: /Project Roadmap/ })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Jump to note' }), { target: { value: 'daily' } })

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Daily Notes/ })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: /Project Roadmap/ })).not.toBeInTheDocument()
    })

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })

    expect(useTabs.getState().byVault[VAULT]?.tabs.map((t) => t.noteId)).toEqual(['note-1'])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on Escape without opening anything', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith(`/api/vaults/${VAULT}/tree`)) return Promise.resolve(jsonResponse({ folders: [], notes: [] }))
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )

    renderPalette()
    fireEvent.keyDown(document, { key: 'p', ctrlKey: true })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useTabs.getState().byVault[VAULT]).toBeUndefined()
  })

  it('ArrowDown moves the active selection before Enter opens it', async () => {
    const tree: VaultTree = {
      folders: [],
      notes: [note(), note({ id: 'note-2', path: 'Project Roadmap.md', title: 'Project Roadmap' })],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith(`/api/vaults/${VAULT}/tree`)) return Promise.resolve(jsonResponse(tree))
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )

    renderPalette()
    fireEvent.keyDown(document, { key: 'p', ctrlKey: true })
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))

    // Empty query — both rows show in tree order; ArrowDown once moves off row 0.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })

    expect(useTabs.getState().byVault[VAULT]?.tabs.map((t) => t.noteId)).toEqual(['note-2'])
  })
})

describe('CommandPalette — command list (Ctrl/Cmd+Shift+P)', () => {
  it('opens on Ctrl+Shift+P, filters commands, and runs the selected one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith(`/api/vaults/${VAULT}/tree`)) return Promise.resolve(jsonResponse({ folders: [], notes: [] }))
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )

    renderPalette()
    fireEvent.keyDown(document, { key: 'p', ctrlKey: true, shiftKey: true })

    expect(await screen.findByRole('dialog', { name: 'Command palette' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /New note/ })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Run a command' }), { target: { value: 'theme' } })

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Toggle theme/ })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: /New note/ })).not.toBeInTheDocument()
    })

    expect(useTheme.getState().override).toBe('system')
    fireEvent.click(screen.getByRole('option', { name: /Toggle theme/ }))

    expect(useTheme.getState().override).toBe('light')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
