import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminUser } from '../../lib/api/types'
import { useAuth } from '../../stores/auth'
import { useServer } from '../../stores/servers'
import { UsersPage } from './UsersPage'

function user(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'user-1',
    username: 'alice',
    displayName: 'Alice',
    role: 'User',
    isDisabled: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `Status ${status}`,
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone(): Response {
      return jsonResponse(body, status)
    },
  } as unknown as Response
}

function renderUsersPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useServer.setState({ current: 'https://server.test', remembered: [] })
  useAuth.setState({ accessToken: 'access-1', refreshToken: 'refresh-1', user: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('UsersPage disable/enable confirmation', () => {
  it('does not call the API when the Disable button is clicked, only after the confirm dialog is accepted', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/users') && (!init || init.method === undefined || init.method === 'GET')) {
        return Promise.resolve(jsonResponse([user()]))
      }
      if (url.endsWith('/api/users/user-1') && init?.method === 'PATCH') {
        return Promise.resolve(jsonResponse(user({ isDisabled: true })))
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderUsersPage()

    await screen.findByText('alice')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))

    // The dialog is up, but the mutation hasn't fired yet.
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Disable user?')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/users/user-1'), expect.anything())

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/users/user-1'), expect.anything())
  })

  it('fires the PATCH request only after confirming the Disable dialog', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/users') && (!init || init.method === undefined || init.method === 'GET')) {
        return Promise.resolve(jsonResponse([user()]))
      }
      if (url.endsWith('/api/users/user-1') && init?.method === 'PATCH') {
        return Promise.resolve(jsonResponse(user({ isDisabled: true })))
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderUsersPage()

    await screen.findByText('alice')
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Disable' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'https://server.test/api/users/user-1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ isDisabled: true }) }),
      ),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('re-enabling a disabled user fires the PATCH request directly, with no confirmation dialog', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/users') && (!init || init.method === undefined || init.method === 'GET')) {
        return Promise.resolve(jsonResponse([user({ isDisabled: true })]))
      }
      if (url.endsWith('/api/users/user-1') && init?.method === 'PATCH') {
        return Promise.resolve(jsonResponse(user({ isDisabled: false })))
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderUsersPage()

    await screen.findByText('alice')
    fireEvent.click(screen.getByRole('button', { name: 'Enable' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'https://server.test/api/users/user-1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ isDisabled: false }) }),
      ),
    )
  })
})
