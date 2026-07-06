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

async function parseErrorBody(res: Response): Promise<{ code: string; message: string }> {
  try {
    const body = (await res.clone().json()) as ApiErrorBody
    if (body?.error?.code && body?.error?.message) {
      return { code: body.error.code, message: body.error.message }
    }
  } catch {
    // body wasn't JSON (or wasn't the error envelope) — fall through
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

async function request<T>(
  method: string,
  path: string,
  body: unknown,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const baseUrl = getBaseUrl(options.baseUrlOverride)
  const { accessToken } = useAuth.getState()
  const parseAs = options.parseAs ?? 'json'

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
    } catch {
      useAuth.getState().clear()
      const { code, message } = await parseErrorBody(res)
      throw new ApiError(401, code, message)
    }
    return request<T>(method, path, body, options, true)
  }

  if (!res.ok) {
    const { code, message } = await parseErrorBody(res)
    throw new ApiError(res.status, code, message)
  }

  return parseBody<T>(res, parseAs)
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
