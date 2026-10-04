import { providePhysics } from '@cubeforge/core'
import { PhysicsSystem } from './physicsSystem'

export function registerPhysics(): void {
  providePhysics((gravity, events) => new PhysicsSystem(gravity, events))
}
