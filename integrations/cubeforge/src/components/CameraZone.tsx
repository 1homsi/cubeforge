import React, { useEffect, useContext, useRef } from 'react'
import { createScript } from '@cubeforge/core'
import type { Camera2DComponent } from '@cubeforge/renderer'
import { EngineContext } from '../context'

interface CameraZoneProps {
  /** World-space center X of the trigger zone */
  x: number
  /** World-space center Y of the trigger zone */
  y: number
  /** Half-width of the trigger zone */
  width: number
  /** Half-height of the trigger zone */
  height: number
  /**
   * When an entity with this tag enters the zone, the camera stops following
   * its entity and locks to the fixed position (targetX, targetY).
   */
  watchTag?: string
  /** Fixed world-space X the camera moves to when activated (defaults to zone center) */
  targetX?: number
  /** Fixed world-space Y the camera moves to when activated (defaults to zone center) */
  targetY?: number
  children?: React.ReactNode
}

/**
 * Invisible trigger area. When the player (or another tagged entity) enters
 * the zone, the camera follow entity is cleared and the camera locks to the
 * zone's center (or a custom target). On exit, the camera resumes following.
 *
 * Zone detection runs inside the ScriptSystem tick — it respects pause and
 * deterministic stepping.
 *
 * @example
 * ```tsx
 * <CameraZone x={500} y={300} width={200} height={150} watchTag="player" />
 * ```
 */
export function CameraZone({ x, y, width, height, watchTag = 'player', targetX, targetY, children }: CameraZoneProps) {
  const engine = useContext(EngineContext)!
  const prevFollowRef = useRef<string | undefined>(undefined)
  const activeRef = useRef(false)

  useEffect(() => {
    // Create a lightweight ECS entity that runs zone detection inside the
    // ScriptSystem tick — respects pause, deterministic mode, and frame rate.
    const eid = engine.ecs.createEntity()

    engine.ecs.addComponent(
      eid,
      createScript(() => {
        const cam = engine.ecs.queryOne('Camera2D')
        if (cam === undefined) return

        const camComp = engine.ecs.getComponent<Camera2DComponent>(cam, 'Camera2D')
        if (!camComp) return

        const hw = width / 2
        const hh = height / 2
        let inside = false

        for (const tid of engine.ecs.query('Transform', 'Tag')) {
          const tagComp = engine.ecs.getComponent<{ type: 'Tag'; tags: string[] }>(tid, 'Tag')
          if (!tagComp?.tags.includes(watchTag)) continue
          const t = engine.ecs.getComponent<{ type: 'Transform'; x: number; y: number }>(tid, 'Transform')
          if (!t) continue
          if (Math.abs(t.x - x) <= hw && Math.abs(t.y - y) <= hh) {
            inside = true
            break
          }
        }

        if (inside && !activeRef.current) {
          activeRef.current = true
          prevFollowRef.current = camComp.followEntityId
          camComp.followEntityId = undefined
          camComp.x = targetX ?? x
          camComp.y = targetY ?? y
        } else if (!inside && activeRef.current) {
          activeRef.current = false
          camComp.followEntityId = prevFollowRef.current
        }
      }),
    )

    return () => {
      // Restore camera if zone was active when unmounted
      if (activeRef.current) {
        const cam = engine.ecs.queryOne('Camera2D')
        if (cam !== undefined) {
          const camComp = engine.ecs.getComponent<Camera2DComponent>(cam, 'Camera2D')
          if (camComp) camComp.followEntityId = prevFollowRef.current
        }
        activeRef.current = false
      }
      if (engine.ecs.hasEntity(eid)) engine.ecs.destroyEntity(eid)
    }
    // Props are read inside the script closure via the outer scope; the effect
    // must re-run when they change so the script is re-created with fresh values.
  }, [engine.ecs, x, y, width, height, watchTag, targetX, targetY])

  return <>{children ?? null}</>
}
