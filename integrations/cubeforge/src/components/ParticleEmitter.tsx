import { useEffect, useContext } from 'react'
import type { ParticlePoolComponent } from '@cubeforge/renderer'
import { EngineContext, EntityContext } from '../context'
import { PARTICLE_PRESETS } from './particlePresets'
import type { ParticlePreset } from './particlePresets'

interface ParticleEmitterProps {
  active?: boolean
  /** Named preset — values can be overridden by explicit props */
  preset?: ParticlePreset
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
  preset,
  rate,
  speed,
  spread,
  angle,
  particleLife,
  particleSize,
  color,
  gravity,
  maxParticles,
}: ParticleEmitterProps) {
  const presetConfig = preset ? PARTICLE_PRESETS[preset] : {}

  const resolvedRate = rate ?? presetConfig.rate ?? 20
  const resolvedSpeed = speed ?? presetConfig.speed ?? 80
  const resolvedSpread = spread ?? presetConfig.spread ?? Math.PI
  const resolvedAngle = angle ?? presetConfig.angle ?? -Math.PI / 2
  const resolvedParticleLife = particleLife ?? presetConfig.particleLife ?? 0.8
  const resolvedParticleSize = particleSize ?? presetConfig.particleSize ?? 4
  const resolvedColor = color ?? presetConfig.color ?? '#ffffff'
  const resolvedGravity = gravity ?? presetConfig.gravity ?? 200
  const resolvedMaxParticles = maxParticles ?? presetConfig.maxParticles ?? 100
  const engine = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  useEffect(() => {
    engine.ecs.addComponent(entityId, {
      type: 'ParticlePool' as const,
      particles: [],
      maxParticles: resolvedMaxParticles,
      active,
      rate: resolvedRate,
      timer: 0,
      speed: resolvedSpeed,
      spread: resolvedSpread,
      angle: resolvedAngle,
      particleLife: resolvedParticleLife,
      particleSize: resolvedParticleSize,
      color: resolvedColor,
      gravity: resolvedGravity,
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
