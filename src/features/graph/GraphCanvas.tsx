import { drag as d3drag } from 'd3-drag'
import { forceCenter } from 'd3-force'
import { pointer, select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom'
import { useEffect, useRef } from 'react'
import type { GraphEdge, GraphNode } from '../../lib/api/types'
import { buildAdjacency, createGraphSimulation, nodeRadius, type SimNode } from './forceGraph'

export interface GraphCanvasProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onOpenNote: (node: GraphNode) => void
}

const LABEL_ZOOM_THRESHOLD = 1.1
const HOVER_HIT_PADDING = 3

interface ThemeColors {
  accent: string
  accentHover: string
  edge: string
  text: string
  fontFamily: string
}

function readThemeColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement)
  const bodyFont = getComputedStyle(document.body).fontFamily
  return {
    accent: style.getPropertyValue('--color-accent').trim() || '#dda039',
    accentHover: style.getPropertyValue('--color-accent-hover').trim() || '#e8ae4c',
    edge: style.getPropertyValue('--color-border-strong').trim() || '#3a4553',
    text: style.getPropertyValue('--color-text').trim() || '#eef2f6',
    fontFamily: bodyFont || 'sans-serif',
  }
}

/**
 * The actual canvas render + interaction surface: d3-force simulation
 * driving node positions, d3-zoom for pan/zoom, d3-drag for repositioning
 * a node (both attached to the same canvas element — see the inline
 * comment on `dragBehavior` for how they coexist without one eating the
 * other's gestures), plain canvas 2D drawing (no SVG — this is the
 * "canvas-based d3-force" the brief calls for, since a vault's worth of
 * notes can be large enough that per-node DOM nodes would get janky).
 *
 * One big effect owns the whole imperative lifecycle (simulation,
 * listeners, RAF loop) and tears all of it down on unmount/re-run —
 * mirrors `EditorHost`'s CM6 mount effect for the same reason: this is
 * fundamentally an imperative canvas, not something React's diffing has
 * a useful angle on.
 */
export function GraphCanvas({ nodes, edges, onOpenNote }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onOpenNoteRef = useRef(onOpenNote)
  onOpenNoteRef.current = onOpenNote

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const colors = readThemeColors()
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }))
    const adjacency = buildAdjacency(edges)

    let transform: ZoomTransform = zoomIdentity
    let hoveredId: string | null = null
    let rafId: number | null = null
    const dpr = window.devicePixelRatio || 1

    function measure() {
      const rect = container!.getBoundingClientRect()
      return { width: rect.width || 1, height: rect.height || 1 }
    }

    function resizeCanvas() {
      const { width, height } = measure()
      canvas!.width = Math.round(width * dpr)
      canvas!.height = Math.round(height * dpr)
      canvas!.style.width = `${width}px`
      canvas!.style.height = `${height}px`
      return { width, height }
    }

    const { width: initialWidth, height: initialHeight } = resizeCanvas()
    const { simulation, links } = createGraphSimulation(simNodes, edges, initialWidth, initialHeight)

    function scheduleDraw() {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        draw()
      })
    }

    function draw() {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      ctx!.translate(transform.x, transform.y)
      ctx!.scale(transform.k, transform.k)

      const neighborSet = hoveredId ? adjacency.get(hoveredId) : null

      // Edges
      ctx!.lineWidth = 1 / transform.k
      ctx!.strokeStyle = colors.edge
      for (const l of links) {
        const s = l.source as SimNode
        const t = l.target as SimNode
        if (s.x == null || s.y == null || t.x == null || t.y == null) continue
        const dim = hoveredId !== null && s.id !== hoveredId && t.id !== hoveredId
        ctx!.globalAlpha = dim ? 0.12 : 0.55
        ctx!.beginPath()
        ctx!.moveTo(s.x, s.y)
        ctx!.lineTo(t.x, t.y)
        ctx!.stroke()
      }

      // Nodes (+ labels)
      const showLabels = transform.k > LABEL_ZOOM_THRESHOLD
      for (const n of simNodes) {
        if (n.x == null || n.y == null) continue
        const r = nodeRadius(n.linkCount)
        const isHovered = n.id === hoveredId
        const isNeighbor = neighborSet?.has(n.id) ?? false
        const dim = hoveredId !== null && !isHovered && !isNeighbor

        ctx!.globalAlpha = dim ? 0.3 : 1
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx!.fillStyle = isHovered || isNeighbor ? colors.accentHover : colors.accent
        ctx!.fill()

        if (isHovered) {
          ctx!.lineWidth = 2 / transform.k
          ctx!.strokeStyle = colors.text
          ctx!.stroke()
        }

        if (showLabels || isHovered || isNeighbor) {
          ctx!.globalAlpha = dim ? 0.5 : 1
          ctx!.fillStyle = colors.text
          ctx!.font = `${12 / transform.k}px ${colors.fontFamily}`
          ctx!.textBaseline = 'middle'
          ctx!.fillText(n.title, n.x + r + 4 / transform.k, n.y)
        }
      }

      ctx!.globalAlpha = 1
      ctx!.setTransform(1, 0, 0, 1, 0, 0)
    }

    function hitTest(worldX: number, worldY: number): SimNode | undefined {
      let best: SimNode | undefined
      let bestDist = Infinity
      for (const n of simNodes) {
        if (n.x == null || n.y == null) continue
        const r = nodeRadius(n.linkCount) + HOVER_HIT_PADDING
        const dist = Math.hypot(n.x - worldX, n.y - worldY)
        if (dist <= r && dist < bestDist) {
          best = n
          bestDist = dist
        }
      }
      return best
    }

    simulation.on('tick', scheduleDraw)

    // ---- Zoom / pan ----
    const zoomBehavior = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.15, 6])
      .on('zoom', (event) => {
        transform = event.transform
        scheduleDraw()
      })

    // ---- Node drag ----
    // Attached to the *same* canvas selection as zoom. `subject` hit-tests
    // for a node under the pointer, converting screen->world coordinates
    // via the current zoom transform's `invert`; when it returns
    // `undefined` (no node there), d3-drag skips starting a gesture
    // entirely for that pointer, so the event is left alone for zoom's own
    // pan handling to pick up — the standard way these two behaviors
    // share one element without fighting over the same mousedown.
    // Subject type includes `undefined` (d3-drag's own runtime contract:
    // returning nullish from `subject` skips starting a gesture at all —
    // see the comment above), so the start/drag/end handlers each guard
    // on it even though it's only ever actually undefined right before a
    // gesture that never starts.
    const dragBehavior = d3drag<HTMLCanvasElement, unknown, SimNode | undefined>()
      .subject((event) => {
        const [px, py] = pointer(event, canvas)
        const [wx, wy] = transform.invert([px, py])
        return hitTest(wx, wy)
      })
      .on('start', (event) => {
        if (!event.subject) return
        if (!event.active) simulation.alphaTarget(0.3).restart()
        event.subject.fx = event.subject.x
        event.subject.fy = event.subject.y
      })
      .on('drag', (event) => {
        if (!event.subject) return
        const [wx, wy] = transform.invert([event.x, event.y])
        event.subject.fx = wx
        event.subject.fy = wy
      })
      .on('end', (event) => {
        if (!event.subject) return
        if (!event.active) simulation.alphaTarget(0)
        event.subject.fx = null
        event.subject.fy = null
      })

    const selection = select(canvas)
    selection.call(zoomBehavior).call(dragBehavior)
    selection.on('dblclick.zoom', null) // double-click reserved for nothing special; avoid the surprise zoom-jump

    function onMouseMove(event: MouseEvent) {
      const [px, py] = pointer(event, canvas!)
      const [wx, wy] = transform.invert([px, py])
      const node = hitTest(wx, wy)
      const id = node?.id ?? null
      if (id !== hoveredId) {
        hoveredId = id
        canvas!.style.cursor = id ? 'pointer' : 'grab'
        scheduleDraw()
      }
    }

    function onMouseLeave() {
      if (hoveredId !== null) {
        hoveredId = null
        scheduleDraw()
      }
    }

    function onClick(event: MouseEvent) {
      const [px, py] = pointer(event, canvas!)
      const [wx, wy] = transform.invert([px, py])
      const node = hitTest(wx, wy)
      if (node) onOpenNoteRef.current(node)
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)
    canvas.addEventListener('click', onClick)
    canvas.style.cursor = 'grab'

    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = resizeCanvas()
      simulation.force('center', forceCenter(width / 2, height / 2))
      scheduleDraw()
    })
    resizeObserver.observe(container)

    return () => {
      simulation.stop()
      resizeObserver.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('click', onClick)
      selection.on('.zoom', null)
      selection.on('.drag', null)
    }
  }, [nodes, edges])

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-border bg-surface/90 px-2.5 py-1.5 text-[11px] text-text-faint shadow-sm">
        Scroll to zoom · drag canvas to pan · drag a node to reposition · click a node to open it
      </div>
    </div>
  )
}
