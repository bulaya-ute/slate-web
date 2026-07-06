import { describe, expect, it } from 'vitest'
import type { ServerCheckResult } from '../lib/api/client'
import type { SystemInfo } from '../lib/api/types'
import { resolveLoginServerState } from './loginServerState'

const info: SystemInfo = {
  name: 'Slate',
  version: '1.0.0',
  apiVersion: 1,
  serverName: 'Acme',
  setupRequired: false,
}

describe('resolveLoginServerState', () => {
  it('surfaces info and no error flags when the server is ok', () => {
    const result = resolveLoginServerState({ status: 'ok', info })
    expect(result).toEqual({ info, incompatibleInfo: null, unreachable: false })
  })

  it('surfaces incompatibleInfo (not unreachable) when the apiVersion mismatches', () => {
    const incompatible: ServerCheckResult = { status: 'incompatible', info: { ...info, apiVersion: 99 } }
    const result = resolveLoginServerState(incompatible)
    expect(result.unreachable).toBe(false)
    expect(result.info).toBeNull()
    expect(result.incompatibleInfo).toEqual({ ...info, apiVersion: 99 })
  })

  it('surfaces unreachable (not incompatible) when the server cannot be reached', () => {
    const result = resolveLoginServerState({ status: 'unreachable' })
    expect(result).toEqual({ info: null, incompatibleInfo: null, unreachable: true })
  })

  it('treats undefined data (query not yet resolved) as unreachable, not incompatible', () => {
    const result = resolveLoginServerState(undefined)
    expect(result).toEqual({ info: null, incompatibleInfo: null, unreachable: true })
  })
})
