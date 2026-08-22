import type { AssetManager } from './assetManager'
import type { AssetLoadError } from './assetManager'

export interface PreloadManifest {
  /** Image URLs to preload */
  images?: string[]
  /** Audio URLs to preload */
  audio?: string[]
  /** Called each time an asset finishes loading, with 0–1 progress */
  onProgress?: (percent: number) => void
}

export interface PreloadResult {
  /** Assets that failed to load. Empty when everything loaded. */
  failures: AssetLoadError[]
}

/**
 * Preloads a batch of assets and resolves when all are done (or failed).
 * Failed assets do not reject — inspect `result.failures` to surface
 * problems on a loading screen.
 *
 * @example
 * ```ts
 * const { failures } = await preloadManifest({
 *   images: ['/hero.png', '/tiles.png'],
 *   audio:  ['/jump.wav', '/music.ogg'],
 *   onProgress: (pct) => console.log(`${Math.round(pct * 100)}%`),
 * }, assets)
 * if (failures.length) console.warn('Missing assets:', failures.map(f => f.src))
 * ```
 */
export async function preloadManifest(manifest: PreloadManifest, assets: AssetManager): Promise<PreloadResult> {
  const imageUrls = manifest.images ?? []
  const audioUrls = manifest.audio ?? []
  const total = imageUrls.length + audioUrls.length

  if (total === 0) {
    manifest.onProgress?.(1)
    return { failures: [] }
  }

  let done = 0
  const tick = (): void => {
    done++
    manifest.onProgress?.(done / total)
  }

  // Snapshot BEFORE starting loads — loadImage/loadAudio kick off
  // asynchronously as the promises are created. (Matching failures by src is
  // unreliable: errors store baseURL-resolved paths while callers pass
  // originals.)
  const errBefore = assets.getErrors().length

  const imageLoads = imageUrls.map((src) => assets.loadImage(src).then(tick, tick))
  const audioLoads = audioUrls.map((src) => assets.loadAudio(src).then(tick, tick))

  await Promise.allSettled([...imageLoads, ...audioLoads])

  return { failures: assets.getErrors().slice(errBefore) }
}
