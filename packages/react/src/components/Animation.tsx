import { useEffect, useContext } from 'react'
import type { AnimationStateComponent } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

interface AnimationProps {
  /** Frame indices to play (indexes into the sprite sheet) */
  frames: number[]
  /** Frames per second, default 12 */
  fps?: number
  /** Whether to loop, default true */
  loop?: boolean
  /** Whether currently playing, default true */
  playing?: boolean
  /** Called once when a non-looping animation finishes playing */
  onComplete?: () => void
}

export function Animation({ frames, fps = 12, loop = true, playing = true, onComplete }: AnimationProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    const state: AnimationStateComponent = {
      type: 'AnimationState',
      frames,
      fps,
      loop,
      playing,
      currentIndex: 0,
      timer: 0,
      _completed: false,
      onComplete,
    }
    engine.ecs.addComponent(entityId, state)

    return () => {
      engine.ecs.removeComponent(entityId, 'AnimationState')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync playing state and animation params
  useEffect(() => {
    const anim = engine.ecs.getComponent<AnimationStateComponent>(entityId, 'AnimationState')
    if (!anim) return
    const wasFramesChanged = anim.frames !== frames
    anim.playing = playing
    anim.fps = fps
    anim.loop = loop
    anim.onComplete = onComplete
    // Reset completion state if frames changed (new animation clip)
    if (wasFramesChanged) {
      anim.frames = frames
      anim.currentIndex = 0
      anim.timer = 0
      anim._completed = false
    }
  }, [playing, fps, loop, frames, onComplete, engine, entityId])

  return null
}
