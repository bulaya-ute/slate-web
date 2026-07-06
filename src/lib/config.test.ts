import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_CONFIG,
  fetchConfig,
  resolveActiveServer,
  resolveConnectionMode,
  type AppConfig,
} from './config'

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response
}

describe('resolveConnectionMode', () => {
  it('is pinned-locked when a server is pinned and selection is disabled', () => {
    const config: AppConfig = {
      serverUrl: 'https://slate.example.com',
      allowServerSelection: false,
      serverName: 'Acme Slate',
    }
    expect(resolveConnectionMode(config)).toBe('pinned-locked')
  })

  it('is pinned-selectable when a server is pinned but selection is allowed', () => {
    const config: AppConfig = {
      serverUrl: 'https://slate.example.com',
      allowServerSelection: true,
      serverName: null,
    }
    expect(resolveConnectionMode(config)).toBe('pinned-selectable')
  })

  it('is unpinned when there is no server url, regardless of allowServerSelection', () => {
    expect(
      resolveConnectionMode({ serverUrl: null, allowServerSelection: true, serverName: null }),
    ).toBe('unpinned')
    expect(
      resolveConnectionMode({ serverUrl: null, allowServerSelection: false, serverName: null }),
    ).toBe('unpinned')
  })
})

describe('resolveActiveServer', () => {
  const pinnedLocked: AppConfig = {
    serverUrl: 'https://pinned.example.com',
    allowServerSelection: false,
    serverName: 'Pinned Co',
  }
  const pinnedSelectable: AppConfig = {
    serverUrl: 'https://pinned.example.com',
    allowServerSelection: true,
    serverName: 'Pinned Co',
  }
  const unpinned: AppConfig = { serverUrl: null, allowServerSelection: true, serverName: null }

  it('pinned-locked always uses the config server and never requires Connect', () => {
    expect(resolveActiveServer(pinnedLocked, null)).toEqual({
      serverUrl: 'https://pinned.example.com',
      requiresConnect: false,
    })
    // Even if the user had a different remembered server, the lock wins.
    expect(resolveActiveServer(pinnedLocked, 'https://other.example.com')).toEqual({
      serverUrl: 'https://pinned.example.com',
      requiresConnect: false,
    })
  })

  it('pinned-selectable prefers a remembered server but falls back to the pin', () => {
    expect(resolveActiveServer(pinnedSelectable, 'https://chosen.example.com')).toEqual({
      serverUrl: 'https://chosen.example.com',
      requiresConnect: false,
    })
    expect(resolveActiveServer(pinnedSelectable, null)).toEqual({
      serverUrl: 'https://pinned.example.com',
      requiresConnect: false,
    })
  })

  it('unpinned requires Connect until a server has been chosen', () => {
    expect(resolveActiveServer(unpinned, null)).toEqual({
      serverUrl: null,
      requiresConnect: true,
    })
    expect(resolveActiveServer(unpinned, 'https://chosen.example.com')).toEqual({
      serverUrl: 'https://chosen.example.com',
      requiresConnect: false,
    })
  })
})

describe('fetchConfig', () => {
  it('returns the defaults when config.json 404s', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false))
    await expect(fetchConfig(fetchImpl)).resolves.toEqual(DEFAULT_CONFIG)
  })

  it('returns the defaults when the request throws (network error)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))
    await expect(fetchConfig(fetchImpl)).resolves.toEqual(DEFAULT_CONFIG)
  })

  it('merges a partial config over the defaults', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ serverUrl: 'https://slate.example.com/', serverName: 'Acme' }),
    )
    await expect(fetchConfig(fetchImpl)).resolves.toEqual({
      serverUrl: 'https://slate.example.com', // trailing slash normalized away
      allowServerSelection: true,
      serverName: 'Acme',
    })
  })

  it('treats a blank serverUrl string as null', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ serverUrl: '   ' }))
    const config = await fetchConfig(fetchImpl)
    expect(config.serverUrl).toBeNull()
  })
})
