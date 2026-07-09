import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '../../components/ui/Toast'
import type { AdminUser, Invite } from '../../lib/api/types'
import { useAuth } from '../../stores/auth'
import { useServer } from '../../stores/servers'
import {
  INVITES_QUERY_KEY,
  USERS_QUERY_KEY,
  useCreateInviteMutation,
  useCreateUserMutation,
  useDeleteInviteMutation,
  useDeleteUserMutation,
  useInvitesQuery,
  useUsersQuery,
} from './useAdmin'

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

function invite(overrides: Partial<Invite> = {}): Invite {
  return { token: 'tok-1', expiresAt: '2026-02-01T00:00:00Z', role: 'User', ...overrides }
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

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status)
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

beforeEach(() => {
  useServer.setState({ current: 'https://server.test', remembered: [] })
  useAuth.setState({ accessToken: 'access-1', refreshToken: 'refresh-1', user: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useUsersQuery', () => {
  it('fetches the user list from GET /api/users', async () => {
    const users = [user(), user({ id: 'user-2', username: 'bob', role: 'Admin' })]
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(users))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useUsersQuery(), { wrapper: createWrapper(newClient()) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(users)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://server.test/api/users',
      expect.objectContaining({ method: 'GET' }),
    )
  })
})

describe('useCreateUserMutation', () => {
  it('appends the created user to the cache and shows a success toast', async () => {
    const queryClient = newClient()
    queryClient.setQueryData(USERS_QUERY_KEY, [user()])
    const created = user({ id: 'user-2', username: 'carol' })
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(created, 201))
    vi.stubGlobal('fetch', fetchMock)
    const successSpy = vi.spyOn(toast, 'success')

    const { result } = renderHook(() => useCreateUserMutation(), { wrapper: createWrapper(queryClient) })

    act(() => {
      result.current.mutate({ username: 'carol', password: 'hunter2', displayName: 'Carol', role: 'User' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData<AdminUser[]>(USERS_QUERY_KEY)).toEqual([user(), created])
    expect(successSpy).toHaveBeenCalledWith('User "carol" created')
  })

  it('surfaces the server error message on failure without touching the cache', async () => {
    const queryClient = newClient()
    queryClient.setQueryData(USERS_QUERY_KEY, [user()])
    const fetchMock = vi.fn().mockResolvedValueOnce(errorResponse(409, 'conflict', 'Username already taken'))
    vi.stubGlobal('fetch', fetchMock)
    const dangerSpy = vi.spyOn(toast, 'danger')

    const { result } = renderHook(() => useCreateUserMutation(), { wrapper: createWrapper(queryClient) })

    act(() => {
      result.current.mutate({ username: 'alice', password: 'hunter2', displayName: 'Alice', role: 'User' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(dangerSpy).toHaveBeenCalledWith('Could not create user', 'Username already taken')
    expect(queryClient.getQueryData<AdminUser[]>(USERS_QUERY_KEY)).toEqual([user()])
  })
})

describe('useDeleteUserMutation', () => {
  it('removes the user from the cache on success', async () => {
    const queryClient = newClient()
    queryClient.setQueryData(USERS_QUERY_KEY, [user(), user({ id: 'user-2', username: 'bob' })])
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(undefined, 204))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDeleteUserMutation(), { wrapper: createWrapper(queryClient) })

    act(() => {
      result.current.mutate('user-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData<AdminUser[]>(USERS_QUERY_KEY)).toEqual([
      user({ id: 'user-2', username: 'bob' }),
    ])
  })

  it('surfaces S3\'s 409 ("owns vaults") message cleanly and leaves the user in the cache', async () => {
    const queryClient = newClient()
    queryClient.setQueryData(USERS_QUERY_KEY, [user()])
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(409, 'user_owns_vaults', 'Cannot delete a user who owns vaults'))
    vi.stubGlobal('fetch', fetchMock)
    const dangerSpy = vi.spyOn(toast, 'danger')

    const { result } = renderHook(() => useDeleteUserMutation(), { wrapper: createWrapper(queryClient) })

    act(() => {
      result.current.mutate('user-1')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(dangerSpy).toHaveBeenCalledWith('Could not delete user', 'Cannot delete a user who owns vaults')
    expect(queryClient.getQueryData<AdminUser[]>(USERS_QUERY_KEY)).toEqual([user()])
  })
})

describe('useInvitesQuery / useCreateInviteMutation / useDeleteInviteMutation', () => {
  it('fetches the invite list', async () => {
    const invites = [invite()]
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(invites))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useInvitesQuery(), { wrapper: createWrapper(newClient()) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(invites)
  })

  it('prepends a newly created invite to the cache', async () => {
    const queryClient = newClient()
    queryClient.setQueryData(INVITES_QUERY_KEY, [invite({ token: 'old' })])
    const created = invite({ token: 'new', role: 'Admin' })
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(created, 201))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useCreateInviteMutation(), { wrapper: createWrapper(queryClient) })

    act(() => {
      result.current.mutate('Admin')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData<Invite[]>(INVITES_QUERY_KEY)).toEqual([created, invite({ token: 'old' })])
  })

  it('revokes an invite by token and removes it from the cache', async () => {
    const queryClient = newClient()
    queryClient.setQueryData(INVITES_QUERY_KEY, [invite({ token: 'keep' }), invite({ token: 'revoke-me' })])
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(undefined, 204))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDeleteInviteMutation(), { wrapper: createWrapper(queryClient) })

    act(() => {
      result.current.mutate('revoke-me')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData<Invite[]>(INVITES_QUERY_KEY)).toEqual([invite({ token: 'keep' })])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://server.test/api/invites/revoke-me',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
