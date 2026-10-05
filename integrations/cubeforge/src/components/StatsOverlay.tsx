import type { CSSProperties } from 'react'
import type { EngineStats } from '@cubeforge/core'
import { useEngineStats } from '../hooks/useProfiler'

export interface StatsOverlayProps {
  /** Refresh interval in ms. */
  interval?: number
  corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  style?: CSSProperties
}

const kb = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`)
const ms = (n: number) => n.toFixed(2)
const rate = (hit: number, miss: number) => (hit + miss === 0 ? '-' : `${Math.round((100 * hit) / (hit + miss))}%`)

const gpu = (s: EngineStats) =>
  s.render.gpuTimerSupported === false
    ? 'n/a'
    : s.gpuMs === null
      ? '...'
      : `${ms(s.gpuMs)} (avg ${ms(s.gpuMsAvg ?? s.gpuMs)})`

/**
 * Frame timings (CPU and GPU), draw calls, instances, textures (tile layers included),
 * tile layer uploads, a per-layer breakdown and cache hit rates. Place inside <Game>.
 * Mounting it turns on GPU timing; the `gpu ms` row reads `n/a` where the browser
 * has no timer query support.
 */
export function StatsOverlay({ interval = 500, corner = 'top-left', style }: StatsOverlayProps) {
  const s = useEngineStats(interval)
  if (!s) return null
  const r = s.render
  const [v, h] = corner.split('-') as ['top' | 'bottom', 'left' | 'right']
  const rows: [string, string][] = [
    ['fps', s.frameIntervalMs > 0 ? (1000 / s.frameIntervalMs).toFixed(0) : '-'],
    ['frame ms', ms(s.updateMs)],
    ['script ms', ms(s.scriptMs)],
    ['physics ms', ms(s.physicsMs)],
    ['render ms', ms(s.renderMs)],
    ['gpu ms', gpu(s)],
    ['entities', `${s.entityCount}`],
    ['draws', `${r.drawCalls}`],
    ['instances', `${r.instances}`],
    ['culled', `${r.spritesCulled}`],
    ['textures', `${r.textureCount} / ${kb(r.textureBytes)}B`],
    ['uploads', `${r.textureUploads} / ${kb(r.textureUploadBytes)}B`],
    ['tex cache', rate(r.textureCacheHits, r.textureCacheMisses)],
    ['text cache', rate(r.textCacheHits, r.textCacheMisses)],
  ]
  const t = s.tileLayerStats
  if (s.layers.some((l) => l.kind === 'tile') || t.textureCount > 0) {
    rows.splice(
      rows.findIndex(([k]) => k === 'tex cache'),
      0,
      ['tile draws', `${t.drawCalls}`],
      ['tile idx up', `${t.indexUploads} / ${kb(t.uploadedTexels)} texels`],
      ['tile tex', `${t.textureCount} / ${kb(t.textureBytes)}B`],
    )
  }
  // One line per drawn layer: instances (sprite quads / tile cells), draw calls, upload bytes.
  for (const l of s.layers) {
    rows.push([
      `${l.kind === 'tile' ? 'T' : 'S'} ${l.name}`,
      `z${l.zIndex} ${kb(l.instances)} i ${l.drawCalls} d ${kb(l.uploadBytes)}B`,
    ])
  }
  return (
    <div
      style={{
        position: 'absolute',
        [v]: 4,
        [h]: 4,
        padding: '4px 6px',
        font: '11px/1.35 monospace',
        color: '#e6e6e6',
        background: 'rgba(0,0,0,0.7)',
        borderRadius: 4,
        whiteSpace: 'pre',
        pointerEvents: 'none',
        zIndex: 10,
        ...style,
      }}
    >
      {rows.map(([k, val], i) => (
        <div key={i}>
          {k.padEnd(11, ' ')}
          {val}
        </div>
      ))}
    </div>
  )
}
