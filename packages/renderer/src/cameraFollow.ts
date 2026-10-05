import type { SpriteLayer } from './spriteLayer'
import { SPRITE_HIDDEN } from './spriteLayerFlags'

/** A world-space point the camera can follow. */
export interface CameraFollowPoint {
  x: number
  y: number
}

/**
 * Returns the world-space point to follow, or `null`/`undefined` when there is
 * nothing to follow right now (the camera then holds its position).
 */
export type CameraFollowPointProvider = () => CameraFollowPoint | null | undefined

/** The part of a `SpriteLayer` the camera reads. */
export type CameraFollowLayer = Pick<SpriteLayer, 'x' | 'y' | 'ids' | 'flags' | 'count'>

/**
 * Follow one sprite of a `SpriteLayer`, by slot `index` or by caller `id`
 * (the value in `layer.ids`, first match). When both are given `id` wins.
 */
export interface CameraFollowSprite {
  layer: CameraFollowLayer
  index?: number
  id?: number
}

/** Fields of the camera component that drive point and sprite following. */
export interface CameraFollowState {
  followPoint?: CameraFollowPointProvider
  followSprite?: CameraFollowSprite
  /** @internal last index an id lookup resolved to, checked before rescanning. */
  _followSpriteIndex?: number
}

/** True when a point provider or a sprite is set (these take priority over `followEntityId`). */
export function hasPointOrSpriteFollow(cam: CameraFollowState): boolean {
  return cam.followPoint !== undefined || cam.followSprite !== undefined
}

/**
 * Resolves the follow target of `followPoint` (first) or `followSprite` into
 * `out`. Returns false when the highest-priority source has no target this
 * frame (provider returned null, sprite hidden or removed, non-finite values):
 * the caller should then hold the camera where it is. Never allocates.
 */
export function resolveCameraFollowTarget(cam: CameraFollowState, out: CameraFollowPoint): boolean {
  if (cam.followPoint) {
    const p = cam.followPoint()
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false
    out.x = p.x
    out.y = p.y
    return true
  }
  const s = cam.followSprite
  if (!s) return false
  const layer = s.layer
  let i = -1
  if (s.id !== undefined) {
    const cached = cam._followSpriteIndex
    if (cached !== undefined && cached < layer.count && layer.ids[cached] === s.id) {
      i = cached
    } else {
      const ids = layer.ids
      for (let k = 0, n = layer.count; k < n; k++) {
        if (ids[k] === s.id) {
          i = k
          break
        }
      }
      cam._followSpriteIndex = i < 0 ? undefined : i
    }
  } else if (s.index !== undefined && s.index >= 0 && s.index < layer.count) {
    i = s.index
  }
  if (i < 0 || layer.flags[i] & SPRITE_HIDDEN) return false
  const x = layer.x[i]
  const y = layer.y[i]
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  out.x = x
  out.y = y
  return true
}
