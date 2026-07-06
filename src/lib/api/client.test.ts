import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../stores/auth'
import { useServer } from '../../stores/servers'
import { api, checkServer, CLIENT_API_VERSION } from './client'
import { ApiError } from './types'

function makeResponse(status: number, body?: unknown): Response {
  const bodyText = body === undefined ? '' : JSON.stringify(body)
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText: `Status ${status}`,
    json: async () => (bodyText ? JSON.parse(bodyText) : null),
    text: async () => bodyText,
    blob: async () => new Blob([bodyText]),
    clone(): Response {
      return makeResponse(status, body)
    },
  }
  return response as unknown as Response
}

beforeEach(() => {
  useServer.setState({ current: 'https://server.test', remembered: [] })
  useAuth.setState({ accessToken: 'access-1', refreshToken: 'refresh-1', user: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api requests', () => {
  it('attaches the bearer token and resolves parsed JSON on success', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse(200, { hello: 'world' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.get<{ hello: string }>('/api/vaults')

    expect(result).toEqual({ hello: 'world' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://server.test/api/vaults')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-1')
  })

  it('throws an ApiError carrying the server error code/message for non-401 failures', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(404, { error: { code: 'not_found', message: 'Vault not found' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/api/vaults/missing')).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'Vault not found',
    })
  })
})

describe('401 → refresh → retry-once', () => {
  it('refreshes once and retries the original request on 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(401, { error: { code: 'expired', message: 'Token expired' } })) // original
      .mockResolvedValueOnce(makeResponse(200, { accessToken: 'access-2', refreshToken: 'refresh-2' })) // refresh
      .mockResolvedValueOnce(makeResponse(200, { ok: true })) // retried
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.get<{ ok: boolean }>('/api/vaults')

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toBe('https://server.test/api/auth/refresh')
    expect((fetchMock.mock.calls[2][1].headers as Record<string, string>).Authorization).toBe(
      'Bearer access-2',
    )
    expect(useAuth.getState().accessToken).toBe('access-2')
    expect(useAuth.getState().refreshToken).toBe('refresh-2')
  })

  it('clears the session and throws the REFRESH call\'s error, not the original request\'s', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(401, { error: { code: 'expired', message: 'Token expired' } })) // original
      .mockResolvedValueOnce(
        makeResponse(401, { error: { code: 'invalid_refresh', message: 'Refresh token invalid' } }), // refresh
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/api/vaults')).rejects.toMatchObject({
      status: 401,
      code: 'invalid_refresh',
      message: 'Refresh token invalid',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(useAuth.getState().accessToken).toBeNull()
    expect(useAuth.getState().refreshToken).toBeNull()
  })

  it('does not attempt a second refresh if the retried request also 401s', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(401, { error: { code: 'expired', message: 'Token expired' } }))
      .mockResolvedValueOnce(makeResponse(200, { accessToken: 'access-2', refreshToken: 'refresh-2' }))
      .mockResolvedValueOnce(makeResponse(401, { error: { code: 'still_bad', message: 'Still unauthorized' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/api/vaults')).rejects.toThrow(ApiError)
    // original + refresh + one retry — never a second refresh/retry round.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws immediately on 401 when there is no refresh token available', async () => {
    useAuth.setState({ accessToken: 'access-1', refreshToken: null, user: null })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(401, { error: { code: 'expired', message: 'Token expired' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/api/vaults')).rejects.toThrow(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('single-flights concurrent refreshes triggered by parallel 401s', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(401, { error: { code: 'expired', message: 'x' } })) // request A
      .mockResolvedValueOnce(makeResponse(401, { error: { code: 'expired', message: 'x' } })) // request B
      .mockResolvedValueOnce(makeResponse(200, { accessToken: 'access-2', refreshToken: 'refresh-2' })) // shared refresh
      .mockResolvedValueOnce(makeResponse(200, { a: true })) // retried A
      .mockResolvedValueOnce(makeResponse(200, { b: true })) // retried B
    vi.stubGlobal('fetch', fetchMock)

    const [a, b] = await Promise.all([
      api.get<{ a: boolean }>('/api/a'),
      api.get<{ b: boolean }>('/api/b'),
    ])

    expect(a).toEqual({ a: true })
    expect(b).toEqual({ b: true })
    expect(fetchMock).toHaveBeenCalledTimes(5)
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/auth/refresh'))
    expect(refreshCalls).toHaveLength(1)
  })
})

describe('checkServer (Connect screen validation states)', () => {
  it('returns ok when the server is reachable and apiVersion matches', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, {
        name: 'Slate',
        version: '1.0.0',
        apiVersion: CLIENT_API_VERSION,
        serverName: 'Acme',
        setupRequired: false,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await checkServer('https://server.test')
    expect(result.status).toBe('ok')
  })

  it('returns incompatible when apiVersion does not match', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, {
        name: 'Slate',
        version: '2.0.0',
        apiVersion: CLIENT_API_VERSION + 1,
        serverName: null,
        setupRequired: false,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await checkServer('https://server.test')
    expect(result.status).toBe('incompatible')
  })

  it('returns unreachable on network failure', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await checkServer('https://server.test')
    expect(result.status).toBe('unreachable')
  })

  it('returns unreachable on a non-2xx response', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse(500, {}))
    vi.stubGlobal('fetch', fetchMock)

    const result = await checkServer('https://server.test')
    expect(result.status).toBe('unreachable')
  })
})
