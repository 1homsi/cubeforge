import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useGame } from './useGame'

export interface DynamicCanvasHandle {
  /** Unique ID — pass to `<Sprite dynamicSrc={...}>` to display this canvas. */
  readonly id: string
  /** The offscreen canvas you draw onto. */
  readonly canvas: HTMLCanvasElement
  /** 2D drawing context for the canvas. */
  readonly ctx: CanvasRenderingContext2D
  /**
   * Call after drawing to schedule a GPU upload before the next frame.
   * The renderer uses `texSubImage2D` to re-upload only when dirty,
   * so skipping this call when the canvas hasn't changed avoids unnecessary
   * CPU→GPU transfers.
   */
  markDirty(): void
}

type DynamicCanvasRenderer = {
  registerDynamicCanvas?: (id: string, canvas: HTMLCanvasElement) => void
  markDynamicCanvasDirty?: (id: string) => void
  unregisterDynamicCanvas?: (id: string) => void
}

/**
 * Creates a CPU-side canvas that is uploaded to the GPU as a sprite texture.
 * Only re-uploads when you call `markDirty()` — skipping frames where the
 * canvas content hasn't changed avoids redundant `texSubImage2D` calls.
 *
 * Useful for minimaps, procedural textures, dynamic UI painted with Canvas2D,
 * or any per-frame canvas drawing that shouldn't upload every RAF tick.
 *
 * @param width  - Canvas width in pixels.
 * @param height - Canvas height in pixels.
 *
 * @example
 * ```tsx
 * function Minimap() {
 *   const { id, ctx, canvas, markDirty } = useDynamicCanvas(128, 128)
 *
 *   useFrame(() => {
 *     ctx.clearRect(0, 0, canvas.width, canvas.height)
 *     // ...draw minimap content...
 *     markDirty()
 *   })
 *
 *   return (
 *     <Entity>
 *       <Transform x={-200} y={-150} />
 *       <Sprite width={128} height={128} dynamicSrc={id} />
 *     </Entity>
 *   )
 * }
 * ```
 */
export function useDynamicCanvas(width: number, height: number): DynamicCanvasHandle {
  const engine = useGame()
  const idRef = useRef(`__dynamic__:${Math.random().toString(36).slice(2)}`)
  const id = idRef.current

  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  const ctx = useMemo(() => canvas.getContext('2d')!, [canvas])

  useEffect(() => {
    const rs = engine.activeRenderSystem as DynamicCanvasRenderer
    rs.registerDynamicCanvas?.(id, canvas)
    return () => {
      rs.unregisterDynamicCanvas?.(id)
    }
  }, [engine, id, canvas])

  const markDirty = useCallback(() => {
    const rs = engine.activeRenderSystem as DynamicCanvasRenderer
    rs.markDynamicCanvasDirty?.(id)
  }, [engine, id])

  return useMemo(() => ({ id, canvas, ctx, markDirty }), [id, canvas, ctx, markDirty])
}
