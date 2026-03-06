import { useEffect, useContext } from 'react'
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

  useEffect(() => {
    if (init) {
      try {
        init(entityId, engine.ecs)
      } catch (err) {
        console.error(`[Cubeforge] Script init error on entity ${entityId}:`, err)
      }
    }
    engine.ecs.addComponent(entityId, createScript(update as ScriptUpdateFn))
    return () => engine.ecs.removeComponent(entityId, 'Script')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
