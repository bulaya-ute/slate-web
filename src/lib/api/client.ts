import { useAuth } from '../../stores/auth'
import { useServer } from '../../stores/servers'
import { normalizeServerUrl } from '../url'
import { ApiError, type ApiErrorBody, type RefreshResponse, type SystemInfo } from './types'

/** apiVersion this build of the web client speaks. Jellyfin-style gate. */
export const CLIENT_API_VERSION = 1

const SERVER_INFO_TIMEOUT_MS = 8000

export type ParseAs = 'json' | 'text' | 'blob' | 'none'

export interface RequestOptions {
  headers?: Record<string, string>
  signal?: AbortSignal
  parseAs?: ParseAs
  /** Escape hatch for callers that already have a full URL (attachments etc). */
  baseUrlOverride?: string
}

function getBaseUrl(override?: string): string {
  const url = override ?? useServer.getState().current
  if (!url) {
    throw new Error('No server configured — cannot make API requests yet.')
  }
  return normalizeServerUrl(url)
}

async function parseErrorBody(res: Response): Promise<{ code: string; message: string; body?: unknown }> {
  try {
    const body = (await res.clone().json()) as unknown
    const asEnvelope = body as ApiErrorBody
    if (asEnvelope?.error?.code && asEnvelope?.error?.message) {
      return { code: asEnvelope.error.code, message: asEnvelope.error.message, body }
    }
    // Valid JSON, but not the standard error envelope — e.g. PUT
    // .../content's 409 body `{headRevId, conflictRevId}`. Keep it around
    // on ApiError.body so a caller that knows the shape can use it.
    return { code: 'unknown', message: res.statusText || `Request failed (${res.status})`, body }
  } catch {
    // body wasn't JSON at all — fall through
  }
  return { code: 'unknown', message: res.statusText || `Request failed (${res.status})` }
}

async function parseBody<T>(res: Response, parseAs: ParseAs): Promise<T> {
  if (parseAs === 'none' || res.status === 204) return undefined as T
  if (parseAs === 'text') return (await res.text()) as unknown as T
  if (parseAs === 'blob') return (await res.blob()) as unknown as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// ---------------------------------------------------------------------
// 401 → refresh → retry-once
// ---------------------------------------------------------------------

// Single-flight: concurrent 401s share one refresh call instead of each
// firing their own (and racing to update the token store).
let inflightRefresh: Promise<RefreshResponse> | null = null

async function refreshSession(baseUrl: string): Promise<RefreshResponse> {
  if (inflightRefresh) return inflightRefresh

  const { refreshToken } = useAuth.getState()
  if (!refreshToken) {
    throw new ApiError(401, 'no_refresh_token', 'No refresh token available.')
  }

  inflightRefresh = (async () => {
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) {
      const { code, message } = await parseErrorBody(res)
      throw new ApiError(res.status, code, message)
    }
    return (await res.json()) as RefreshResponse
  })()

  try {
    return await inflightRefresh
  } finally {
    inflightRefresh = null
  }
}

// ---------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------

/**
 * Fires the fetch with auth headers attached, transparently handling the
 * 401 → refresh → retry-once dance, and throwing `ApiError` for any
 * non-2xx response. Returns the raw `Response` on success so callers can
 * either parse the body (`request`) or also need response headers
 * (`fetchWithHeaders` — e.g. note content's `X-Rev-Id`).
 */
async function fetchAuthed(
  method: string,
  path: string,
  body: unknown,
  options: RequestOptions = {},
  isRetry = false,
): Promise<Response> {
  const baseUrl = getBaseUrl(options.baseUrlOverride)
  const { accessToken } = useAuth.getState()

  const headers: Record<string, string> = { ...options.headers }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
  const hasJsonBody = body !== undefined && !(body instanceof FormData)
  if (hasJsonBody) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    signal: options.signal,
    body: body === undefined ? undefined : hasJsonBody ? JSON.stringify(body) : (body as BodyInit),
  })

  if (res.status === 401 && !isRetry && useAuth.getState().refreshToken) {
    try {
      const tokens = await refreshSession(baseUrl)
      useAuth.getState().setTokens(tokens)
    } catch (refreshErr) {
      useAuth.getState().clear()
      // Surface the refresh call's own failure (e.g. invalid_refresh), not
      // the original request's 401 — they're frequently different errors.
      if (refreshErr instanceof ApiError) throw refreshErr
      throw new ApiError(
        401,
        'refresh_failed',
        refreshErr instanceof Error ? refreshErr.message : 'Session refresh failed.',
      )
    }
    return fetchAuthed(method, path, body, options, true)
  }

  if (!res.ok) {
    const { code, message, body: errBody } = await parseErrorBody(res)
    throw new ApiError(res.status, code, message, errBody)
  }

  return res
}

async function request<T>(
  method: string,
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const res = await fetchAuthed(method, path, body, options)
  return parseBody<T>(res, options.parseAs ?? 'json')
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),
  del: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, undefined, options),
}

/**
 * Like `api.get`, but also returns the response headers — for the rare
 * endpoint where a header carries data the JSON/text body doesn't (e.g.
 * `GET /notes/{id}/content`'s `X-Rev-Id` / `X-Content-Hash`).
 */
export async function fetchWithHeaders<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; headers: Headers }> {
  const res = await fetchAuthed('GET', path, undefined, options)
  const data = await parseBody<T>(res, options.parseAs ?? 'json')
  return { data, headers: res.headers }
}

// ---------------------------------------------------------------------
// Server compatibility check (Connect screen) — unauthenticated, and
// against a URL that isn't necessarily "current" yet.
// ---------------------------------------------------------------------

export type ServerCheckResult =
  | { status: 'ok'; info: SystemInfo }
  | { status: 'incompatible'; info: SystemInfo }
  | { status: 'unreachable' }

export async function checkServer(url: string): Promise<ServerCheckResult> {
  const baseUrl = normalizeServerUrl(url)
  try {
    const res = await fetch(`${baseUrl}/api/system/info`, {
      signal: AbortSignal.timeout(SERVER_INFO_TIMEOUT_MS),
    })
    if (!res.ok) return { status: 'unreachable' }
    const info = (await res.json()) as SystemInfo
    if (info.apiVersion !== CLIENT_API_VERSION) return { status: 'incompatible', info }
    return { status: 'ok', info }
  } catch {
    return { status: 'unreachable' }
  }
}
