import { useEffect, useContext } from 'react'
import type { ParticlePoolComponent } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'

interface ParticleEmitterProps {
  active?: boolean
  /** Particles per second, default 20 */
  rate?: number
  /** Initial particle speed (pixels/s), default 80 */
  speed?: number
  /** Angle spread in radians, default Math.PI */
  spread?: number
  /** Base emit angle in radians (0=right, -PI/2=up), default -Math.PI/2 */
  angle?: number
  /** Particle lifetime in seconds, default 0.8 */
  particleLife?: number
  /** Particle size in pixels, default 4 */
  particleSize?: number
  /** Particle color, default '#ffffff' */
  color?: string
  /** Gravity applied to particles (pixels/s²), default 200 */
  gravity?: number
  /** Maximum live particles, default 100 */
  maxParticles?: number
}

export function ParticleEmitter({
  active = true,
  rate = 20,
  speed = 80,
  spread = Math.PI,
  angle = -Math.PI / 2,
  particleLife = 0.8,
  particleSize = 4,
  color = '#ffffff',
  gravity = 200,
  maxParticles = 100,
}: ParticleEmitterProps) {
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(entityId, {
      type: 'ParticlePool' as const,
      particles: [],
      maxParticles,
      active,
      rate,
      timer: 0,
      speed,
      spread,
      angle,
      particleLife,
      particleSize,
      color,
      gravity,
    } as ParticlePoolComponent)

    return () => engine.ecs.removeComponent(entityId, 'ParticlePool')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync active state
  useEffect(() => {
    const pool = engine.ecs.getComponent<ParticlePoolComponent>(entityId, 'ParticlePool')
    if (!pool) return
    pool.active = active
  }, [active, engine, entityId])

  return null
}
