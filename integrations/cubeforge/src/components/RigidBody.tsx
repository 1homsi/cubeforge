import { useEffect, useContext } from 'react'
import { createRigidBody } from '@cubeforge/physics'
import { EngineContext, EntityContext } from '../context'

interface RigidBodyProps {
  mass?: number
  gravityScale?: number
  isStatic?: boolean
  bounce?: number
  friction?: number
  vx?: number
  vy?: number
  /** Prevent any horizontal movement — velocity.x is zeroed every frame */
  lockX?: boolean
  /** Prevent any vertical movement — velocity.y is zeroed every frame (disables gravity) */
  lockY?: boolean
  /** Enable continuous collision detection to prevent tunneling through thin colliders */
  ccd?: boolean
  /** Angular velocity in radians per second */
  angularVelocity?: number
  /** Angular damping (0–1): fraction of angular velocity removed each fixed step */
  angularDamping?: number
  /** Linear damping (0–1): velocity reduction applied every fixed step (air resistance) */
  linearDamping?: number
}

export function RigidBody({
  mass = 1,
  gravityScale = 1,
  isStatic = false,
  bounce = 0,
  friction = 0.85,
  vx = 0,
  vy = 0,
  lockX = false,
  lockY = false,
  ccd = false,
  angularVelocity = 0,
  angularDamping = 0,
  linearDamping = 0,
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
        bounce,
        friction,
        vx,
        vy,
        lockX,
        lockY,
        ccd,
        angularVelocity,
        angularDamping,
        linearDamping,
      }),
    )
    return () => engine.ecs.removeComponent(entityId, 'RigidBody')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
