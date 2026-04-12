import { useContext, useRef, type CSSProperties } from 'react'
import type { EntityId, TransformComponent } from '@cubeforge/core'
import type { Camera2DComponent } from '@cubeforge/renderer'
import { EngineContext, EntityContext, type EngineState } from '../context'
import { useOverlayTick } from '../hooks/useOverlayTick'

export interface VectorPathProps {
  /**
   * SVG path data (the `d` attribute). Supports the full SVG path syntax including
   * cubic and quadratic beziers, arcs, and close commands.
   *
   * Coordinates are in world units relative to the parent entity's Transform.
   *
   * @example `M0,0 C10,-20 40,-20 50,0`
   */
  d: string
  /** Stroke color. Default '#ffffff'. */
  stroke?: string
  /** Stroke width in world units. Default 2. */
  strokeWidth?: number
  /** Stroke dash pattern, e.g. '4 2'. */
  strokeDasharray?: string
  /** Line cap style. Default 'round'. */
  strokeLinecap?: 'butt' | 'round' | 'square'
  /** Line join style. Default 'round'. */
  strokeLinejoin?: 'miter' | 'round' | 'bevel'
  /** Fill color. Default 'none' (no fill). */
  fill?: string
  /** Fill rule. Default 'nonzero'. */
  fillRule?: 'nonzero' | 'evenodd'
  /** Opacity (0–1). Default 1. */
  opacity?: number
  /** Hide the path. */
  visible?: boolean
}

/**
 * A vector path (cubic/quadratic beziers, arcs, polylines) positioned in world
 * space and rendered as a DOM SVG overlay above the game canvas.
 *
 * Follows the parent {@link Entity}'s Transform and the active {@link Camera2D}
 * every frame, so zoom/pan work automatically. Accepts the full SVG path syntax
 * in the `d` prop.
 *
 * **Trade-off**: Because this is a DOM overlay (not a WebGL draw), paths do not
 * participate in the post-process stack (vignette, scanlines, chromatic
 * aberration, etc.) and always render above all sprites. If you need paths to
 * be affected by post-FX or z-ordered with sprites, rasterize your artwork into
 * an image and use `<Sprite>` instead.
 *
 * @example
 * ```tsx
 * <Entity>
 *   <Transform x={100} y={100} />
 *   <VectorPath
 *     d="M 0 0 C 20 -40, 60 -40, 80 0 S 140 40, 160 0"
 *     stroke="#4fc3f7"
 *     strokeWidth={3}
 *     fill="none"
 *   />
 * </Entity>
 * ```
 */
export function VectorPath({
  d,
  stroke = '#ffffff',
  strokeWidth = 2,
  strokeDasharray,
  strokeLinecap = 'round',
  strokeLinejoin = 'round',
  fill = 'none',
  fillRule = 'nonzero',
  opacity = 1,
  visible = true,
}: VectorPathProps) {
  const engine = useContext(EngineContext)
  const entityId = useContext(EntityContext)
  const svgRef = useRef<SVGSVGElement>(null)

  // Shared overlay tick — no per-component rAF.
  useOverlayTick(() => {
    if (!engine || entityId === null || entityId === undefined) return
    const svg = svgRef.current
    if (!svg) return
    const t = engine.ecs.getComponent<TransformComponent>(entityId as EntityId, 'Transform')
    if (!t) return
    const screen = worldToScreenCss(engine, t.x, t.y)
    if (!screen) return
    svg.style.display = visible ? 'block' : 'none'
    const rect = engine.canvas.getBoundingClientRect()
    svg.style.left = `${rect.left + window.scrollX}px`
    svg.style.top = `${rect.top + window.scrollY}px`
    svg.style.width = `${rect.width}px`
    svg.style.height = `${rect.height}px`
    const path = svg.querySelector('path')
    if (path) {
      const degrees = (t.rotation * 180) / Math.PI
      path.setAttribute(
        'transform',
        `translate(${screen.x} ${screen.y}) rotate(${degrees}) scale(${t.scaleX * screen.zoom} ${t.scaleY * screen.zoom})`,
      )
      path.setAttribute('stroke-width', `${strokeWidth * screen.zoom}`)
    }
  }, [engine, entityId, visible, strokeWidth])

  if (!engine) return null

  const svgStyle: CSSProperties = {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: 9997,
    overflow: 'visible',
  }

  return (
    <svg ref={svgRef} style={svgStyle} xmlns="http://www.w3.org/2000/svg">
      <path
        d={d}
        fill={fill}
        fillRule={fillRule}
        stroke={stroke}
        strokeLinecap={strokeLinecap}
        strokeLinejoin={strokeLinejoin}
        strokeDasharray={strokeDasharray}
        opacity={opacity}
      />
    </svg>
  )
}

function worldToScreenCss(engine: EngineState, wx: number, wy: number): { x: number; y: number; zoom: number } | null {
  const canvas = engine.canvas
  const camId = engine.ecs.queryOne('Camera2D')
  if (camId === undefined) {
    return { x: canvas.clientWidth / 2 + wx, y: canvas.clientHeight / 2 + wy, zoom: 1 }
  }
  const cam = engine.ecs.getComponent<Camera2DComponent>(camId, 'Camera2D')
  if (!cam) return null
  const zoom = cam.zoom
  const x = canvas.clientWidth / 2 + (wx - cam.x) * zoom
  const y = canvas.clientHeight / 2 + (wy - cam.y) * zoom
  return { x, y, zoom }
}
