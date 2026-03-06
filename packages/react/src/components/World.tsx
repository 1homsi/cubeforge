import { useEffect, useContext, type ReactNode } from 'react'
import { EngineContext } from '../context'

interface WorldProps {
  /** Gravitational acceleration in pixels/s² (default inherited from Game) */
  gravity?: number
  /** Canvas background color */
  background?: string
  children?: ReactNode
}

export function World({ gravity, background = '#1a1a2e', children }: WorldProps) {
  const engine = useContext(EngineContext)

  useEffect(() => {
    if (!engine) return
    if (gravity !== undefined) engine.physics.setGravity(gravity)
  }, [gravity, engine])

  useEffect(() => {
    if (!engine) return
    // Propagate background to the camera component (or store it for renderer)
    // The camera component stores background — if no camera exists, fill canvas directly
    const camId = engine.ecs.queryOne('Camera2D')
    if (camId !== undefined) {
      const cam = engine.ecs.getComponent<{ type: 'Camera2D'; background: string }>(camId, 'Camera2D')
      if (cam) cam.background = background
    } else {
      engine.canvas.style.background = background
    }
  }, [background, engine])

  return <>{children}</>
}
