import { providePhysics } from '@xip/core'
import { PhysicsSystem } from './physicsSystem'

export function registerPhysics(): void {
  providePhysics((gravity, events) => new PhysicsSystem(gravity, events))
}
