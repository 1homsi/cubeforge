import { useEffect, useContext } from 'react'
import type { AnimatorComponent } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

// Re-export the types users will need
import type {
  AnimatorStateDefinition,
  AnimatorTransition,
  AnimatorCondition,
  AnimatorParamValue,
} from '@cubeforge/renderer'
export type { AnimatorStateDefinition, AnimatorTransition, AnimatorCondition, AnimatorParamValue }

interface AnimatorProps {
  initial: string
  states: Record<string, AnimatorStateDefinition>
  params?: Record<string, AnimatorParamValue>
  playing?: boolean
}

export function Animator({ initial, states, params = {}, playing = true }: AnimatorProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    const comp: AnimatorComponent = {
      type: 'Animator',
      initialState: initial,
      currentState: initial,
      states,
      params: { ...params },
      playing,
      _entered: false,
    }
    engine.ecs.addComponent(entityId, comp)
    return () => engine.ecs.removeComponent(entityId, 'Animator')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync params and playing
  useEffect(() => {
    const comp = engine.ecs.getComponent<AnimatorComponent>(entityId, 'Animator')
    if (!comp) return
    // Merge params into the existing params object (don't replace reference)
    Object.assign(comp.params, params)
    comp.playing = playing
  }, [params, playing, engine, entityId])

  // Sync states
  useEffect(() => {
    const comp = engine.ecs.getComponent<AnimatorComponent>(entityId, 'Animator')
    if (!comp) return
    comp.states = states
  }, [states, engine, entityId])

  return null
}
