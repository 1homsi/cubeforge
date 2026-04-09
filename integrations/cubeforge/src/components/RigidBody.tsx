import { useEffect, useContext } from 'react'
import { createRigidBody } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface RigidBodyProps {
  /** Explicit mass. 0 (default) auto-computes from density × collider area */
  mass?: number
  gravityScale?: number
  isStatic?: boolean
  vx?: number
  vy?: number
  /** Prevent any horizontal movement — velocity.x is zeroed every frame */
  lockX?: boolean
  /** Prevent any vertical movement — velocity.y is zeroed every frame (disables gravity) */
  lockY?: boolean
  /** Lock rotation — angular velocity stays 0 */
  lockRotation?: boolean
  /** Enable continuous collision detection to prevent tunneling through thin colliders */
  ccd?: boolean
  /** Angular velocity in radians per second */
  angularVelocity?: number
  /** Angular damping (0–1): fraction of angular velocity removed each fixed step */
  angularDamping?: number
  /** Linear damping (0–1): velocity reduction applied every fixed step (air resistance) */
  linearDamping?: number
  /** Density for auto-computing mass (mass = density × area). Default 1.0 */
  density?: number
  /** Coefficient of restitution for this body (0 = no bounce, 1 = full bounce) */
  restitution?: number
  /** Dominance group (-127 to 127). Higher dominance acts as infinite mass in contacts */
  dominance?: number
  /** Kinematic bodies skip gravity/integration but resolve collisions without impulse response */
  isKinematic?: boolean
  /** Whether this body is enabled. Disabled bodies are completely skipped */
  enabled?: boolean
  /** Max linear velocity magnitude. 0 = unlimited */
  maxLinearVelocity?: number
  /** Max angular velocity magnitude. 0 = unlimited */
  maxAngularVelocity?: number
  /** Extra velocity solver iterations for constraints involving this body. Default 0 */
  additionalSolverIterations?: number
}

export function RigidBody({
  mass = 0,
  gravityScale = 1,
  isStatic = false,
  vx = 0,
  vy = 0,
  lockX = false,
  lockY = false,
  lockRotation = true,
  ccd = false,
  angularVelocity = 0,
  angularDamping = 0,
  linearDamping = 0,
  density = 1,
  restitution = 0,
  dominance = 0,
  isKinematic = false,
  enabled = true,
  maxLinearVelocity = 0,
  maxAngularVelocity = 0,
  additionalSolverIterations = 0,
}: RigidBodyProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  if (process.env.NODE_ENV !== 'production') {
    if (entityId === null) {
      console.warn('[Cubeforge] <RigidBody> must be inside an <Entity>. No EntityContext found.')
    }
  }

  useEffect(() => {
    engine.ecs.addComponent(
      entityId,
      createRigidBody({
        mass,
        gravityScale,
        isStatic,
        vx,
        vy,
        lockX,
        lockY,
        lockRotation,
        ccd,
        angularVelocity,
        angularDamping,
        linearDamping,
        density,
        restitution,
        dominance,
        isKinematic,
        enabled,
        maxLinearVelocity,
        maxAngularVelocity,
        additionalSolverIterations,
      }),
    )
    return () => engine.ecs.removeComponent(entityId, 'RigidBody')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
