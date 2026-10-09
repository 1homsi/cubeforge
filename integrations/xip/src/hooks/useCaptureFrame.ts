import { useCallback } from 'react'
import type { CaptureFrame } from '@xip/context'
import { useGame } from './useGame'

/**
 * Returns `engine.captureFrame` as a stable function: render the world now and
 * read it back as a PNG blob (or an ImageBitmap / canvas, at a chosen size).
 *
 * @example
 * const capture = useCaptureFrame()
 * const share = async () => upload(await capture({ width: 512 }))
 */
export function useCaptureFrame(): CaptureFrame {
  const engine = useGame()
  return useCallback(
    ((opts) => {
      if (!engine.captureFrame) return Promise.reject(new Error('captureFrame is not available on this engine'))
      return engine.captureFrame(opts)
    }) as CaptureFrame,
    [engine],
  )
}
