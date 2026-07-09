import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import type { GraphEdge, GraphNode } from '../../lib/api/types'

export interface SimNode extends GraphNode, SimulationNodeDatum {}
export interface SimLink extends SimulationLinkDatum<SimNode> {}

const MIN_RADIUS = 5
const MAX_RADIUS = 26
const RADIUS_SCALE = 3.2

/**
 * Node visual radius, scaled by `sqrt(linkCount)` (not linear) so a
 * heavily-linked hub grows sublinearly rather than swallowing the
 * canvas — matches the design spec's "node size ~ link count" without
 * letting one popular note dwarf everything else.
 */
export function nodeRadius(linkCount: number): number {
  const r = MIN_RADIUS + Math.sqrt(Math.max(linkCount, 0)) * RADIUS_SCALE
  return Math.min(Math.max(r, MIN_RADIUS), MAX_RADIUS)
}

/** Undirected adjacency (id -> directly-linked neighbor ids) — the hover-highlight lookup. */
export function buildAdjacency(edges: GraphEdge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()
  function link(a: string, b: string) {
    let set = adjacency.get(a)
    if (!set) {
      set = new Set()
      adjacency.set(a, set)
    }
    set.add(b)
  }
  for (const edge of edges) {
    link(edge.source, edge.target)
    link(edge.target, edge.source)
  }
  return adjacency
}

export interface GraphSimulation {
  simulation: Simulation<SimNode, SimLink>
  /**
   * The link objects `forceLink` mutates in place — once the link force
   * is attached, `.source`/`.target` on each of these become direct
   * `SimNode` references (no longer the original string ids), which is
   * what the canvas draw loop reads every frame.
   */
  links: SimLink[]
}

/**
 * Builds the d3-force simulation for the vault graph: link (spring,
 * pulls linked notes together), many-body (repels every node from every
 * other so the graph spreads out), center (keeps the whole cluster near
 * the canvas middle), and collide (keeps node circles from overlapping,
 * radius-aware so hubs get proportionally more clearance).
 */
export function createGraphSimulation(nodes: SimNode[], edges: GraphEdge[], width: number, height: number): GraphSimulation {
  const links: SimLink[] = edges.map((e) => ({ source: e.source, target: e.target }))

  const simulation = forceSimulation(nodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance(70)
        .strength(0.4),
    )
    .force('charge', forceManyBody<SimNode>().strength(-160))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide<SimNode>((d) => nodeRadius(d.linkCount) + 6))
    .alphaDecay(0.02)

  return { simulation, links }
}
