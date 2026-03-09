import type { AssetManager } from './assetManager'

export interface PreloadManifest {
  /** Image URLs to preload */
  images?: string[]
  /** Audio URLs to preload */
  audio?: string[]
  /** Called each time an asset finishes loading, with 0–1 progress */
  onProgress?: (percent: number) => void
}

/**
 * Preloads a batch of assets and resolves when all are done (or failed).
 *
 * @example
 * ```ts
 * await preloadManifest({
 *   images: ['/hero.png', '/tiles.png'],
 *   audio:  ['/jump.wav', '/music.ogg'],
 *   onProgress: (pct) => console.log(`${Math.round(pct * 100)}%`),
 * }, assets)
 * ```
 */
export async function preloadManifest(manifest: PreloadManifest, assets: AssetManager): Promise<void> {
  const imageUrls = manifest.images ?? []
  const audioUrls = manifest.audio ?? []
  const total = imageUrls.length + audioUrls.length

  if (total === 0) {
    manifest.onProgress?.(1)
    return
  }

  let done = 0
  const tick = (): void => {
    done++
    manifest.onProgress?.(done / total)
  }

  const imageLoads = imageUrls.map((src) => assets.loadImage(src).then(tick, tick))
  const audioLoads = audioUrls.map((src) => assets.loadAudio(src).then(tick, tick))

  await Promise.allSettled([...imageLoads, ...audioLoads])
}
