import type { CSSProperties } from 'react'
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

/** Frame timings, draw calls, instances, textures and cache hit rates. Place inside <Game>. */
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
    ['entities', `${s.entityCount}`],
    ['draws', `${r.drawCalls}`],
    ['instances', `${r.instances}`],
    ['culled', `${r.spritesCulled}`],
    ['textures', `${r.textureCount} / ${kb(r.textureBytes)}B`],
    ['uploads', `${r.textureUploads} / ${kb(r.textureUploadBytes)}B`],
    ['tex cache', rate(r.textureCacheHits, r.textureCacheMisses)],
    ['text cache', rate(r.textCacheHits, r.textCacheMisses)],
  ]
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
        pointerEvents: 'none',
        zIndex: 10,
        ...style,
      }}
    >
      {rows.map(([k, val]) => (
        <div key={k}>
          {k.padEnd(11, ' ')}
          {val}
        </div>
      ))}
    </div>
  )
}
