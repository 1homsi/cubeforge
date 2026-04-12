import { useEffect } from 'react'

// ── Shared overlay rAF ───────────────────────────────────────────────────────
//
// All DOM overlay components (TransformHandles, EditableText, A11yNode,
// VectorPath, FocusRing) used to each run their own requestAnimationFrame loop
// to sync position with the canvas. Mounting many overlays multiplied that
// cost. Now they all share this single rAF, which dispatches to every
// registered callback once per browser frame.
//
// Callbacks are invoked in registration order. Each one is responsible for its
// own error handling — this module intentionally doesn't catch, so a thrown
// error in one overlay surfaces normally instead of being silently swallowed
// across others.

const callbacks = new Set<() => void>()
let rafId = 0

function tick(): void {
  for (const cb of callbacks) cb()
  if (callbacks.size > 0) rafId = requestAnimationFrame(tick)
  else rafId = 0
}

function start(): void {
  if (rafId === 0) rafId = requestAnimationFrame(tick)
}

function register(cb: () => void): () => void {
  callbacks.add(cb)
  start()
  return () => {
    callbacks.delete(cb)
    // When the last callback unregisters, stop the rAF so no-op ticks don't
    // keep the page awake.
    if (callbacks.size === 0 && rafId !== 0) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }
}

/**
 * Register a callback to run once per browser frame, sharing a single rAF loop
 * with every other CubeForge DOM overlay on the page. Used internally by
 * `<TransformHandles>`, `<EditableText>`, `<A11yNode>`, `<VectorPath>`, and
 * `<FocusRing>` to keep their DOM positions synced with entity transforms
 * without each overlay paying for its own rAF.
 *
 * The callback is responsible for reading the entity's Transform and applying
 * style updates — it should be cheap and must not block. If a callback throws,
 * the error surfaces normally; no other registered callbacks are affected on
 * subsequent frames (but the current frame stops at the throw).
 *
 * @internal External users should not typically need this, but it's exported
 * for plugins or custom overlay components that want the same batching benefit.
 */
export function useOverlayTick(callback: () => void, deps: readonly unknown[] = []): void {
  useEffect(() => {
    return register(callback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
