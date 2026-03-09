import { getAudioCtx } from './audioContext'

/**
 * Set the global audio listener position (typically the camera/player position).
 * Used by spatial audio to calculate distance attenuation.
 *
 * For a 2D game engine the Z coordinate is kept at 0.
 *
 * @example
 * // Call every frame with the camera position:
 * setListenerPosition(camera.x, camera.y)
 */
export function setListenerPosition(x: number, y: number): void {
  const ctx = getAudioCtx()
  const listener = ctx.listener

  // Modern browsers expose AudioParam properties
  if (listener.positionX) {
    listener.positionX.setValueAtTime(x, ctx.currentTime)
    listener.positionY.setValueAtTime(y, ctx.currentTime)
    listener.positionZ.setValueAtTime(0, ctx.currentTime)
  } else {
    // Fallback for older browsers
    ;(listener as any).setPosition(x, y, 0)
  }
}

/** Read the current listener position. */
export function getListenerPosition(): { x: number; y: number } {
  const ctx = getAudioCtx()
  const listener = ctx.listener

  if (listener.positionX) {
    return { x: listener.positionX.value, y: listener.positionY.value }
  }
  // Fallback — no getter available on legacy API, return 0,0
  return { x: 0, y: 0 }
}
