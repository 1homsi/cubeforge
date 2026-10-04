import type { System } from './ecs/world'
import type { EventBus } from './events/eventBus'

export type PhysicsFactory = (gravity: number, events: EventBus) => System

let factory: PhysicsFactory | null = null

/**
 * Called by the physics component factories. <Game> attaches a physics system
 * only once one exists, so games that never create a physics component don't
 * bundle or run physics.
 */
export function providePhysics(f: PhysicsFactory): void {
  if (factory === null) factory = f
}

export function getPhysicsFactory(): PhysicsFactory | null {
  return factory
}
