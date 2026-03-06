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
}

export function RigidBody({
  mass = 1,
  gravityScale = 1,
  isStatic = false,
  bounce = 0,
  friction = 0.85,
  vx = 0,
  vy = 0,
}: RigidBodyProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(entityId, createRigidBody({ mass, gravityScale, isStatic, bounce, friction, vx, vy }))
    return () => engine.ecs.removeComponent(entityId, 'RigidBody')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
