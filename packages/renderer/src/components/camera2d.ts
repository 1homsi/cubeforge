import type { Component } from '@xip/core'
import type { CameraFollowPointProvider, CameraFollowSprite } from '../cameraFollow'

export interface Camera2DComponent extends Component {
  readonly type: 'Camera2D'
  /** Current world-space camera center (updated each frame when following) */
  x: number
  y: number
  zoom: number
  /** String ID of entity to follow */
  followEntityId?: string
  /**
   * Follow a world-space point returned each frame. Takes priority over
   * `followSprite` and `followEntityId`. Returning null/undefined holds the camera.
   */
  followPoint?: CameraFollowPointProvider
  /**
   * Follow one sprite of a SpriteLayer by index or id. Takes priority over
   * `followEntityId`; a hidden or removed sprite holds the camera.
   */
  followSprite?: CameraFollowSprite
  /** @internal cached index for `followSprite.id` lookups */
  _followSpriteIndex?: number
  /** Lerp factor for smooth follow (0 = instant, values like 0.85 = smooth) */
  smoothing: number
  /** Background fill color */
  background: string
  /** Clamp camera to these world-space bounds (null = no clamping) */
  bounds?: { x: number; y: number; width: number; height: number }
  /** Dead zone — camera only starts moving when target moves outside this box (world pixels) */
  deadZone?: { w: number; h: number }
  /** World-space offset applied to the follow target position (e.g. look-ahead). */
  followOffsetX: number
  followOffsetY: number
  /** Current shake magnitude (pixels) */
  shakeIntensity: number
  /** Total shake duration */
  shakeDuration: number
  /** Time remaining for shake */
  shakeTimer: number
  /** Round the camera offset to whole device pixels (crisp pixel art while panning). */
  pixelSnap?: boolean
}

export function createCamera2D(opts?: Partial<Camera2DComponent>): Camera2DComponent {
  return {
    type: 'Camera2D',
    x: 0,
    y: 0,
    zoom: 1,
    smoothing: 0,
    background: '#1a1a2e',
    followOffsetX: 0,
    followOffsetY: 0,
    shakeIntensity: 0,
    shakeDuration: 0,
    shakeTimer: 0,
    ...opts,
  }
}

/**
 * Keep a camera whose view is `halfW` x `halfH` world units (half extents) inside `bounds`.
 * On an axis where the bounds are smaller than the view the camera centres on the bounds
 * instead of pinning to the top/left edge.
 */
export function clampCameraToBounds(
  cam: { x: number; y: number; bounds?: { x: number; y: number; width: number; height: number } },
  halfW: number,
  halfH: number,
): void {
  const b = cam.bounds
  if (!b) return
  cam.x = b.width <= 2 * halfW ? b.x + b.width / 2 : Math.max(b.x + halfW, Math.min(b.x + b.width - halfW, cam.x))
  cam.y = b.height <= 2 * halfH ? b.y + b.height / 2 : Math.max(b.y + halfH, Math.min(b.y + b.height - halfH, cam.y))
}
