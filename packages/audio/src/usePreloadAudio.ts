import { useEffect, useRef, useState } from 'react'
import { getAudioCtx } from './audioContext'
import { _getBufferCache, _getBufferRefCount } from './useSound'

// Separate preload-specific cache so we can test it in isolation.
// Loaded buffers are also written into the shared useSound cache so
// subsequent useSound calls reuse already-decoded data.
const preloadCache = new Map<string, AudioBuffer>()

/** @internal Exposed for testing. */
export function _getPreloadCache(): Map<string, AudioBuffer> {
  return preloadCache
}

export interface PreloadAudioResult {
  /** Number of files that have finished loading (success or failure). */
  loaded: number
  /** Total number of files requested. */
  total: number
  /** Loading progress 0–1. Reaches 1 when all files have settled (success or fail). */
  progress: number
  /** `true` when all files have finished loading. */
  isReady: boolean
  /** Paths that failed to fetch or decode. */
  errors: string[]
}

/**
 * Preload multiple audio files in parallel and track progress.
 * Loaded buffers are stored in the shared `useSound` cache — subsequent
 * calls to `useSound` with the same paths will reuse the already-decoded buffers
 * without fetching again.
 *
 * @example
 * // Show a loading screen until all game audio is ready
 * const { progress, isReady } = usePreloadAudio([
 *   '/sfx/explosion.wav',
 *   '/sfx/jump.wav',
 *   '/music/theme.ogg',
 * ])
 *
 * if (!isReady) return <LoadingBar value={progress} />
 */
export function usePreloadAudio(srcs: string[]): PreloadAudioResult {
  const [settled, setSettled] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  // Stable join so the effect only re-runs when the actual set of paths changes
  const key = srcs.join('|')
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false

    if (srcs.length === 0) return

    const unique = [...new Set(srcs)]
    const bufferCache = _getBufferCache()
    const bufferRefCount = _getBufferRefCount()
    const ctx = getAudioCtx()

    const loadOne = async (src: string): Promise<void> => {
      try {
        if (!preloadCache.has(src) && !bufferCache.has(src)) {
          const res = await fetch(src)
          const data = await res.arrayBuffer()
          const buf = await ctx.decodeAudioData(data)
          // Write into both caches:
          // - preloadCache: owned by this hook, used for dedup checks
          // - bufferCache: shared with useSound so it reuses the decoded buffer
          preloadCache.set(src, buf)
          bufferCache.set(src, buf)
          bufferRefCount.set(src, (bufferRefCount.get(src) ?? 0) + 1)
        } else if (!preloadCache.has(src) && bufferCache.has(src)) {
          // Already in useSound cache — just mark as known to preloader
          preloadCache.set(src, bufferCache.get(src)!)
        }
      } catch {
        if (!cancelledRef.current) {
          setErrors((prev) => [...prev, src])
        }
      } finally {
        if (!cancelledRef.current) {
          setSettled((prev) => prev + 1)
        }
      }
    }

    void Promise.all(unique.map(loadOne))

    return () => {
      cancelledRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const total = srcs.length
  const progress = total === 0 ? 1 : Math.min(1, settled / total)

  return {
    loaded: settled,
    total,
    progress,
    isReady: progress >= 1,
    errors,
  }
}
