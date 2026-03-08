import { useEffect, useContext, useRef } from 'react'
import { createScript, type ScriptUpdateFn } from '@cubeforge/core'
import type { ECSWorld, EntityId } from '@cubeforge/core'
import type { InputManager } from '@cubeforge/input'
import { EngineContext, EntityContext } from '../context'

interface ScriptProps {
  /** Called once when the entity is mounted — use to attach extra components */
  init?: (entityId: EntityId, world: ECSWorld) => void
  /** Called every frame */
  update: ScriptUpdateFn | ((entityId: EntityId, world: ECSWorld, input: InputManager, dt: number) => void)
}

export function Script({ init, update }: ScriptProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  if (process.env.NODE_ENV !== 'production') {
    if (entityId === null) {
      console.warn('[Cubeforge] <Script> must be inside an <Entity>. No EntityContext found.')
    }
  }

  // Keep refs to always call the latest callback — prevents stale closures
  // when the parent re-renders with new props/state.
  const initRef = useRef(init)
  initRef.current = init
  const updateRef = useRef(update)
  updateRef.current = update

  useEffect(() => {
    if (initRef.current) {
      try {
        initRef.current(entityId, engine.ecs)
      } catch (err) {
        console.error(`[Cubeforge] Script init error on entity ${entityId}:`, err)
      }
    }
    const stableUpdate: ScriptUpdateFn = (id, world, input, dt) =>
      (updateRef.current as ScriptUpdateFn)(id, world, input, dt)
    engine.ecs.addComponent(entityId, createScript(stableUpdate))
    return () => engine.ecs.removeComponent(entityId, 'Script')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
