import React from 'react'
import { usePreload } from '../hooks/usePreload'

interface AssetLoaderProps {
  /** List of asset URLs to preload */
  assets: string[]
  /** Shown while assets are loading */
  fallback?: React.ReactNode
  /** Called if any asset fails to load */
  onError?: (err: Error) => void
  children: React.ReactNode
}

/**
 * Suspense-style asset loading boundary.
 *
 * Shows `fallback` until all assets in the list are loaded (or errored).
 * Once loaded, renders `children`.
 *
 * @example
 * ```tsx
 * <AssetLoader
 *   assets={['/hero.png', '/tiles.png', '/jump.wav']}
 *   fallback={<div>Loading…</div>}
 * >
 *   <GameScene />
 * </AssetLoader>
 * ```
 */
export function AssetLoader({ assets, fallback = null, onError, children }: AssetLoaderProps) {
  const { loaded, error, progress } = usePreload(assets)

  if (error && onError) {
    onError(error)
  }

  if (!loaded) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

export type { AssetLoaderProps }
