import { describe, expect, it } from 'vitest'
import type { GraphEdge } from '../../lib/api/types'
import { buildAdjacency, nodeRadius } from './forceGraph'

describe('nodeRadius', () => {
  it('grows sublinearly (sqrt) with linkCount, not linearly', () => {
    const r0 = nodeRadius(0)
    const r1 = nodeRadius(1)
    const r4 = nodeRadius(4)
    const r16 = nodeRadius(16)
    expect(r0).toBeLessThan(r1)
    expect(r1).toBeLessThan(r4)
    expect(r4).toBeLessThan(r16)
    // sqrt(16) = 4x sqrt(1), so the r1->r16 gap should be ~4x the r1->r4 gap's ratio (not 16x).
    const growth1to4 = r4 - r1
    const growth4to16 = r16 - r4
    expect(growth4to16).toBeLessThan(growth1to4 * 4)
  })

  it('is clamped within [minRadius, maxRadius] for extreme inputs', () => {
    expect(nodeRadius(-5)).toBe(nodeRadius(0)) // negative treated as 0
    expect(nodeRadius(0)).toBeGreaterThan(0)
    expect(nodeRadius(100000)).toBeLessThanOrEqual(nodeRadius(100000)) // finite
    expect(Number.isFinite(nodeRadius(1_000_000))).toBe(true)
    const maxish = nodeRadius(1_000_000)
    const bigger = nodeRadius(10_000_000)
    expect(bigger).toBe(maxish) // both clamped to the same max
  })
})

describe('buildAdjacency', () => {
  it('is undirected — an edge links both endpoints to each other', () => {
    const edges: GraphEdge[] = [{ source: 'a', target: 'b' }]
    const adjacency = buildAdjacency(edges)
    expect(adjacency.get('a')).toEqual(new Set(['b']))
    expect(adjacency.get('b')).toEqual(new Set(['a']))
  })

  it('accumulates multiple neighbors for a hub node', () => {
    const edges: GraphEdge[] = [
      { source: 'hub', target: 'a' },
      { source: 'hub', target: 'b' },
      { source: 'c', target: 'hub' },
    ]
    const adjacency = buildAdjacency(edges)
    expect(adjacency.get('hub')).toEqual(new Set(['a', 'b', 'c']))
    expect(adjacency.get('a')).toEqual(new Set(['hub']))
  })

  it('de-duplicates a repeated edge into a single neighbor entry', () => {
    const edges: GraphEdge[] = [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'b' },
    ]
    const adjacency = buildAdjacency(edges)
    expect(adjacency.get('a')!.size).toBe(1)
  })

  it('returns an empty map for no edges', () => {
    expect(buildAdjacency([]).size).toBe(0)
  })
})
