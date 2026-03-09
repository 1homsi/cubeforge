import { useState, useEffect, useContext } from 'react'
import { EngineContext } from '../context'

export interface PreloadState {
  /** 0–1 loading progress */
  progress: number
  /** True when all assets have finished loading (or errored) */
  loaded: boolean
  /** First error encountered, if any */
  error: Error | null
}

/**
 * Preloads a list of asset URLs using the engine's AssetManager.
 * Returns loading progress and a `loaded` flag.
 *
 * Works with images (any extension) — audio goes through the engine's audio API.
 *
 * @example
 * ```tsx
 * function Level() {
 *   const { progress, loaded } = usePreload(['/hero.png', '/tiles.png'])
 *   if (!loaded) return <LoadingBar progress={progress} />
 *   return <GameScene />
 * }
 * ```
 */
export function usePreload(assets: string[]): PreloadState {
  const engine = useContext(EngineContext)!
  const [state, setState] = useState<PreloadState>({
    progress: assets.length === 0 ? 1 : 0,
    loaded: assets.length === 0,
    error: null,
  })

  useEffect(() => {
    if (assets.length === 0) {
      setState({ progress: 1, loaded: true, error: null })
      return
    }

    let done = 0
    let firstError: Error | null = null
    const total = assets.length

    const onDone = (err?: Error): void => {
      done++
      if (err && !firstError) firstError = err
      setState({ progress: done / total, loaded: done >= total, error: firstError })
    }

    const promises = assets.map((src) => {
      const isAudio = /\.(mp3|ogg|wav|aac|flac|m4a)$/i.test(src)
      if (isAudio) {
        return engine.assets.loadAudio(src).then(
          () => onDone(),
          (e: unknown) => onDone(e as Error),
        )
      }
      return engine.assets.loadImage(src).then(
        () => onDone(),
        (e: unknown) => onDone(e as Error),
      )
    })

    return () => {
      void promises
    } // effect cleanup — promises are already in flight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(assets), engine.assets])

  return state
}
