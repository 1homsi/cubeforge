import type { ECSWorld, EntityId } from '@cubeforge/core'
import type { AnimationStateComponent } from '@cubeforge/renderer'
import type { AnimatorComponent, AnimatorParamValue } from '@cubeforge/renderer'

export function playClip(world: ECSWorld, entityId: EntityId, clipName: string): void {
  const anim = world.getComponent<AnimationStateComponent>(entityId, 'AnimationState')
  if (anim) anim.currentClip = clipName
}

export function setAnimationState(world: ECSWorld, entityId: EntityId, stateName: string): void {
  const animator = world.getComponent<AnimatorComponent>(entityId, 'Animator')
  if (animator) {
    animator.currentState = stateName
    animator._entered = false
  }
}

export function setAnimatorParam(world: ECSWorld, entityId: EntityId, name: string, value: AnimatorParamValue): void {
  const animator = world.getComponent<AnimatorComponent>(entityId, 'Animator')
  if (animator) animator.params[name] = value
}
