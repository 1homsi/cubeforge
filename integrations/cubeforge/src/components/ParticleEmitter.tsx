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
  /** Emit this many particles in one frame then deactivate (one-shot burst) */
  burstCount?: number
  /** Emission shape: 'point' (default), 'circle', or 'box' */
  emitShape?: 'point' | 'circle' | 'box'
  /** Radius for 'circle' emission shape */
  emitRadius?: number
  /** Width for 'box' emission shape */
  emitWidth?: number
  /** Height for 'box' emission shape */
  emitHeight?: number
  /** Sprite/texture source for particles (if undefined, renders as colored rect) */
  textureSrc?: string
  /** Enable particle rotation. Default false */
  enableRotation?: boolean
  /** Random rotation speed range [min, max] in radians/s */
  rotationSpeedRange?: [number, number]
  /** Size over lifetime: start and end size. If set, overrides particleSize */
  sizeOverLife?: { start: number; end: number }
  /** Attractor points that pull particles toward them */
  attractors?: Array<{ x: number; y: number; strength: number; radius: number }>
  /** Color over lifetime: array of colors to interpolate through */
  colorOverLife?: string[]
  /**
   * WebGL blend mode for particles.
   * - `'normal'` (default) — standard alpha blending
   * - `'additive'` — particles brighten the background; produces a glow effect
   * - `'multiply'` — darkens based on particle color
   * - `'screen'` — lightens, softer than additive
   */
  blendMode?: 'normal' | 'additive' | 'multiply' | 'screen'
  /**
   * Visual shape of each particle.
   * - `'soft'` (default) — radial gradient with glow halo; pairs well with `blendMode="additive"`
   * - `'circle'` — hard-edged anti-aliased circle, no glow falloff
   * - `'square'` — solid quad (fastest, no texture lookup)
   */
  particleShape?: 'soft' | 'circle' | 'square'
  /**
   * Formation mode: particles lerp toward fixed target positions instead of
   * being emitted with velocity. Enables logo reveals, constellations, shape morphing.
   * - `'standard'` (default) — normal emit/gravity/lifetime behaviour
   * - `'formation'` — particles seek `formationPoints`; no gravity, no expiry
   */
  mode?: 'standard' | 'formation'
  /**
   * Target positions for formation mode. One particle is spawned per point.
   * Change this array to morph the formation — particles smoothly lerp to new targets.
   */
  formationPoints?: { x: number; y: number }[]
  /**
   * How strongly particles seek their target each frame in formation mode.
   * Exponential lerp factor (0–1). Default 0.055 (~5.5% per frame at 60 fps).
   */
  seekStrength?: number
  /**
   * Smoothly transition all particles to this color.
   * Works in both standard and formation modes.
   */
  targetColor?: string
  /** Duration of the global color transition in seconds. Default 0.5. */
  colorTransitionDuration?: number
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
  burstCount,
  emitShape,
  emitRadius,
  emitWidth,
  emitHeight,
  textureSrc,
  enableRotation,
  rotationSpeedRange,
  sizeOverLife,
  attractors,
  colorOverLife,
  blendMode,
  mode,
  formationPoints,
  seekStrength,
  targetColor,
  colorTransitionDuration,
  particleShape,
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
  const resolvedBlendMode = blendMode ?? presetConfig.blendMode
  const resolvedParticleShape = particleShape ?? presetConfig.particleShape
  const resolvedColorOverLife = colorOverLife ?? presetConfig.colorOverLife
  const resolvedSizeOverLife = sizeOverLife ?? presetConfig.sizeOverLife
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
      burstCount,
      emitShape,
      emitRadius,
      emitWidth,
      emitHeight,
      textureSrc,
      enableRotation,
      rotationSpeedRange,
      sizeOverLife: resolvedSizeOverLife,
      attractors,
      colorOverLife: resolvedColorOverLife,
      blendMode: resolvedBlendMode,
      mode,
      formationPoints,
      seekStrength,
      colorTransitionDuration,
      particleShape: resolvedParticleShape,
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

  // Sync blend mode and particle shape (e.g. theme switching)
  useEffect(() => {
    const pool = engine.ecs.getComponent<ParticlePoolComponent>(entityId, 'ParticlePool')
    if (!pool) return
    pool.blendMode = resolvedBlendMode
    pool.particleShape = resolvedParticleShape
  }, [resolvedBlendMode, resolvedParticleShape, engine, entityId])

  // Sync attractor changes (e.g. cursor repulsion driven by live coordinates)
  useEffect(() => {
    const pool = engine.ecs.getComponent<ParticlePoolComponent>(entityId, 'ParticlePool')
    if (!pool) return
    pool.attractors = attractors
  }, [attractors, engine, entityId])

  // Morph formation: reassign targets (shuffled to avoid clumping)
  useEffect(() => {
    const pool = engine.ecs.getComponent<ParticlePoolComponent>(entityId, 'ParticlePool')
    if (!pool || pool.mode !== 'formation' || !formationPoints) return
    pool.formationPoints = formationPoints
    const shuffled = [...formationPoints].sort(() => Math.random() - 0.5)
    pool.particles.forEach((p, i) => {
      if (shuffled[i]) {
        p.targetX = shuffled[i].x
        p.targetY = shuffled[i].y
      }
    })
  }, [formationPoints, engine, entityId])

  // Trigger global color transition
  useEffect(() => {
    const pool = engine.ecs.getComponent<ParticlePoolComponent>(entityId, 'ParticlePool')
    if (!pool || !targetColor) return
    pool._colorTransitionFrom = pool.color
    pool._colorTransitionElapsed = 0
    pool.targetColor = targetColor
    pool.colorTransitionDuration = colorTransitionDuration
  }, [targetColor, colorTransitionDuration, engine, entityId])

  return null
}
