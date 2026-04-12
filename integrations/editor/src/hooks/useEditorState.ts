import { useState, useCallback, useContext, useEffect, useRef } from 'react'
import type { EntityId, Component } from '@cubeforge/core'
import type { EngineState } from '@cubeforge/context'
import { EngineContext } from '@cubeforge/context'

export interface EntityInfo {
  id: EntityId
  /** String name from engine.entityIds reverse map, or `'Entity #<id>'` fallback. */
  name: string
  /** Component type strings on this entity. */
  componentTypes: string[]
}

export interface EditorState {
  /** All entities currently in the world. */
  entities: EntityInfo[]
  /** The selected entity, or null. */
  selectedId: EntityId | null
  /** Components of the selected entity (live references). */
  selectedComponents: readonly Component[]
  /** Select an entity by id. */
  select(id: EntityId | null): void
  /** Force a refresh of the entity list. */
  refresh(): void
}

function buildEntityInfo(engine: EngineState): EntityInfo[] {
  // Reverse map: EntityId → string name
  const nameMap = new Map<EntityId, string>()
  engine.entityIds.forEach((eid, name) => nameMap.set(eid, name))

  const ids = engine.ecs.getAllEntityIds()
  return ids.map((id) => {
    const comps = engine.ecs.getEntityComponents(id)
    return {
      id,
      name: nameMap.get(id) ?? `Entity #${id}`,
      componentTypes: comps.map((c) => c.type),
    }
  })
}

/**
 * Core state hook for the scene editor. Reads the live ECS world and provides
 * entity selection + refresh controls.
 *
 * @internal Used by editor components; can also be used directly for custom UI.
 */
export function useEditorState(refreshHz = 4): EditorState {
  const engine = useContext(EngineContext)!
  const [entities, setEntities] = useState<EntityInfo[]>([])
  const [selectedId, setSelectedId] = useState<EntityId | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(() => {
    setEntities(buildEntityInfo(engine))
  }, [engine])

  // Poll the ECS at a low rate to keep the hierarchy up to date
  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, 1000 / refreshHz)
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
  }, [refresh, refreshHz])

  const select = useCallback((id: EntityId | null) => {
    setSelectedId(id)
  }, [])

  const selectedComponents =
    selectedId !== null ? engine.ecs.getEntityComponents(selectedId) : ([] as readonly Component[])

  return { entities, selectedId, selectedComponents, select, refresh }
}
