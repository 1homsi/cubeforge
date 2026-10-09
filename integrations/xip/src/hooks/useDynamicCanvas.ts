import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
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
   * CPU→GPU transfers. Pass the changed rect (canvas pixels) to upload only
   * that region; calls within a frame are merged into one bounding rect.
   */
  markDirty(x?: number, y?: number, width?: number, height?: number): void
}

type DynamicCanvasRenderer = {
  registerDynamicCanvas?: (id: string, canvas: HTMLCanvasElement) => void
  markDynamicCanvasDirty?: (id: string, x?: number, y?: number, w?: number, h?: number) => void
  unregisterDynamicCanvas?: (id: string) => void
}

/**
 * Creates a CPU-side canvas that is uploaded to the GPU as a sprite texture.
 * Only re-uploads when you call `markDirty()` — skipping frames where the
 * canvas content hasn't changed avoids redundant `texSubImage2D` calls.
 * Resizing preserves the last committed bitmap, scaled to the new dimensions,
 * until the caller draws replacement content.
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
  const committedCanvas = useRef<HTMLCanvasElement | null>(null)

  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  const ctx = useMemo(() => canvas.getContext('2d')!, [canvas])

  useLayoutEffect(() => {
    const previous = committedCanvas.current
    if (previous && previous !== canvas && previous.width > 0 && previous.height > 0) {
      ctx.drawImage(previous, 0, 0, canvas.width, canvas.height)
    }
    committedCanvas.current = canvas
    const rs = engine.activeRenderSystem as DynamicCanvasRenderer
    rs.registerDynamicCanvas?.(id, canvas)
    engine.loop.markDirty()
    return () => {
      rs.unregisterDynamicCanvas?.(id)
    }
  }, [engine, id, canvas, ctx])

  const markDirty = useCallback(
    (x?: number, y?: number, width?: number, height?: number) => {
      const rs = engine.activeRenderSystem as DynamicCanvasRenderer
      rs.markDynamicCanvasDirty?.(id, x, y, width, height)
      engine.loop.markDirty()
    },
    [engine, id],
  )

  return useMemo(() => ({ id, canvas, ctx, markDirty }), [id, canvas, ctx, markDirty])
}
