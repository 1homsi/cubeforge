import { useEffect, useContext } from 'react'
import { createScript } from '@cubeforge/core'
import type { EntityId } from '@cubeforge/core'
import type { Camera2DComponent } from '@cubeforge/renderer'
import type { EngineState } from '@cubeforge/context'
import { EngineContext } from '../context'

// ── Virtual camera registry ───────────────────────────────────────────────────

export interface VirtualCameraConfig {
  /** Unique identifier for this virtual camera. */
  id: string
  /** Higher-priority cameras take control when active. Default 0. */
  priority: number
  /** Whether this camera is currently contending for control. Default true. */
  active: boolean
  /** Entity ID string to follow (same as Camera2D.followEntityId). */
  followEntityId?: string
  /** Static world-space X when not following an entity. */
  x?: number
  /** Static world-space Y when not following an entity. */
  y?: number
  /** Zoom level. Default 1. */
  zoom?: number
  /** Follow smoothing (0 = instant, 0.85 = smooth). Inherits Camera2D value when omitted. */
  smoothing?: number
  /** World-space camera bounds clamp. */
  bounds?: { x: number; y: number; width: number; height: number }
  /** How long (seconds) to blend when transitioning to this camera. Default 0.4. */
  blendDuration: number
}

interface BlendState {
  fromX: number
  fromY: number
  fromZoom: number
  elapsed: number
  duration: number
}

export interface DriverState {
  activeId: string | null
  blend: BlendState | null
}

// Per-engine registries and driver tracking
const registries = new WeakMap<EngineState, Map<string, VirtualCameraConfig>>()
const driverEids = new WeakMap<EngineState, EntityId>()
const driverRefs = new WeakMap<EngineState, number>()
export const driverStates = new WeakMap<EngineState, DriverState>()

export function getRegistry(engine: EngineState): Map<string, VirtualCameraConfig> {
  if (!registries.has(engine)) registries.set(engine, new Map())
  return registries.get(engine)!
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

function acquireDriver(engine: EngineState): void {
  const count = driverRefs.get(engine) ?? 0
  driverRefs.set(engine, count + 1)
  if (count > 0) return // driver already running

  const state: DriverState = { activeId: null, blend: null }
  driverStates.set(engine, state)

  const eid: EntityId = engine.ecs.createEntity()
  driverEids.set(engine, eid)

  engine.ecs.addComponent(
    eid,
    createScript((_id: EntityId, _world: unknown, _input: unknown, dt: number) => {
      const registry = getRegistry(engine)
      const camId: EntityId | undefined = engine.ecs.queryOne('Camera2D')
      if (camId === undefined) return
      const cam = engine.ecs.getComponent<Camera2DComponent>(camId, 'Camera2D')
      if (!cam) return

      // Pick highest-priority active virtual camera
      let best: VirtualCameraConfig | null = null
      for (const vc of registry.values()) {
        if (!vc.active) continue
        if (!best || vc.priority > best.priority) best = vc
      }
      if (!best) return

      // Detect change in active camera → start blend
      if (best.id !== state.activeId) {
        state.blend = {
          fromX: cam.x,
          fromY: cam.y,
          fromZoom: cam.zoom,
          elapsed: 0,
          duration: best.blendDuration,
        }
        state.activeId = best.id
        // Clear follow during blend so we can lerp position freely
        cam.followEntityId = undefined
      }

      if (state.blend) {
        if (state.blend.duration <= 0) {
          // Instant cut — skip interpolation
          state.blend = null
        } else {
          state.blend.elapsed += dt
          const t = Math.min(1, state.blend.elapsed / state.blend.duration)
          const eased = easeInOutQuad(t)

          const targetX = best.x ?? state.blend.fromX
          const targetY = best.y ?? state.blend.fromY
          const targetZoom = best.zoom ?? 1

          cam.x = state.blend.fromX + (targetX - state.blend.fromX) * eased
          cam.y = state.blend.fromY + (targetY - state.blend.fromY) * eased
          cam.zoom = state.blend.fromZoom + (targetZoom - state.blend.fromZoom) * eased

          if (t >= 1) {
            state.blend = null
            // Restore follow after blend completes
            cam.followEntityId = best.followEntityId
            if (best.smoothing !== undefined) cam.smoothing = best.smoothing
            if (best.bounds !== undefined) cam.bounds = best.bounds
          }
          return
        }
      }

      // No active blend — apply target directly
      cam.followEntityId = best.followEntityId
      if (best.followEntityId === undefined) {
        if (best.x !== undefined) cam.x = best.x
        if (best.y !== undefined) cam.y = best.y
      }
      if (best.zoom !== undefined) cam.zoom = best.zoom
      if (best.smoothing !== undefined) cam.smoothing = best.smoothing
      if (best.bounds !== undefined) cam.bounds = best.bounds
    }),
  )
}

function releaseDriver(engine: EngineState): void {
  const count = (driverRefs.get(engine) ?? 1) - 1
  driverRefs.set(engine, Math.max(0, count))
  if (count > 0) return

  const eid = driverEids.get(engine)
  if (eid !== undefined && engine.ecs.hasEntity(eid)) engine.ecs.destroyEntity(eid)
  driverEids.delete(engine)
  driverStates.delete(engine)
  driverRefs.delete(engine)
  getRegistry(engine).clear()
}

// ── VirtualCamera component ───────────────────────────────────────────────────

export interface VirtualCameraProps {
  /** Unique ID used to identify and blend between cameras. */
  id: string
  /**
   * Higher values win when multiple virtual cameras are active simultaneously.
   * Default 0.
   */
  priority?: number
  /** Whether this camera is currently competing for control. Default true. */
  active?: boolean
  /**
   * Entity string ID to follow (same semantics as `<Camera2D followEntity>`).
   * Takes precedence over x/y when set.
   */
  followEntity?: string
  /** Static world-space X to center on (when not following an entity). */
  x?: number
  /** Static world-space Y to center on (when not following an entity). */
  y?: number
  /** Zoom level applied while this camera is active. Default 1. */
  zoom?: number
  /**
   * Follow-smoothing factor (0 = instant snap, 0.85 = very smooth).
   * When omitted, inherits the current Camera2D smoothing.
   */
  smoothing?: number
  /** World-space bounds clamping while this camera is active. */
  bounds?: { x: number; y: number; width: number; height: number }
  /**
   * Blend-in duration in seconds when transitioning to this camera.
   * Use 0 for an instant cut. Default 0.4.
   */
  blendDuration?: number
}

/**
 * Declares a virtual camera that competes for control of the scene's
 * `Camera2D`. The active virtual camera with the highest `priority` wins.
 * Transitions between cameras blend smoothly over `blendDuration` seconds.
 *
 * Multiple `<VirtualCamera>` components can coexist. Toggle `active` to hand
 * off camera control — ideal for cutscenes, boss arenas, and split focus.
 *
 * Must be placed inside `<Game>` alongside a `<Camera2D>`.
 *
 * @example
 * ```tsx
 * // Normal gameplay: follow the player
 * <VirtualCamera id="main" priority={0} followEntity={playerId} zoom={1} active />
 *
 * // Boss fight: zoom out to show the arena
 * <VirtualCamera
 *   id="boss"
 *   priority={10}
 *   x={arenaX} y={arenaY}
 *   zoom={0.7}
 *   blendDuration={0.8}
 *   active={bossActive}
 * />
 * ```
 */
export function VirtualCamera({
  id,
  priority = 0,
  active = true,
  followEntity,
  x,
  y,
  zoom = 1,
  smoothing,
  bounds,
  blendDuration = 0.4,
}: VirtualCameraProps) {
  const engine = useContext(EngineContext)!

  // Register + ensure driver on mount
  useEffect(() => {
    acquireDriver(engine)
    const registry = getRegistry(engine)
    registry.set(id, {
      id,
      priority,
      active,
      followEntityId: followEntity,
      x,
      y,
      zoom,
      smoothing,
      bounds,
      blendDuration,
    })

    return () => {
      getRegistry(engine).delete(id)
      releaseDriver(engine)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync prop changes into the registry entry
  useEffect(() => {
    const entry = getRegistry(engine).get(id)
    if (!entry) return
    entry.priority = priority
    entry.active = active
    entry.followEntityId = followEntity
    entry.x = x
    entry.y = y
    entry.zoom = zoom
    entry.smoothing = smoothing
    entry.bounds = bounds
    entry.blendDuration = blendDuration
  }, [id, priority, active, followEntity, x, y, zoom, smoothing, bounds, blendDuration, engine])

  return null
}
