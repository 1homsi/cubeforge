export type ParticlePreset =
  | 'explosion'
  | 'spark'
  | 'smoke'
  | 'coinPickup'
  | 'jumpDust'
  | 'fire'
  | 'magic'
  | 'rain'
  | 'snow'
  | 'confetti'
  | 'sparkle'
  | 'heal'
  | 'damage'
  | 'pickup'
  | 'fountain'
  | 'trail'

export interface ParticleEmitterConfig {
  rate?: number
  speed?: number
  spread?: number
  angle?: number
  particleLife?: number
  particleSize?: number
  color?: string
  gravity?: number
  maxParticles?: number
  /** Colors to interpolate through over particle lifetime. */
  colorOverLife?: string[]
  /** Start/end size ratios for per-particle size curve (end is multiplier of particleSize). */
  sizeOverLife?: { start: number; end: number }
  /** Blend mode for the emitter (additive for glows, normal for solid). */
  blendMode?: 'normal' | 'additive'
  /** Particle shape: 'soft' gradient, 'circle' hard disc, 'square' quad. */
  particleShape?: 'soft' | 'circle' | 'square'
}

/**
 * Ready-made particle configurations. Pass via the `preset` prop on
 * `<ParticleEmitter>`:
 *
 * ```tsx
 * <ParticleEmitter preset="fire" />
 * <ParticleEmitter preset="explosion" color="#8bc34a" />  // overrides
 * ```
 *
 * Individual props always override preset values — presets are defaults.
 *
 * ## Catalog
 *
 * Action / combat: `explosion`, `spark`, `damage`, `heal`, `magic`
 * Environment:     `fire`, `smoke`, `rain`, `snow`, `fountain`
 * UI / reward:     `coinPickup`, `pickup`, `sparkle`, `confetti`
 * Character:       `jumpDust`, `trail`
 */
export const PARTICLE_PRESETS: Record<ParticlePreset, ParticleEmitterConfig> = {
  // ── Action / combat ──
  explosion: {
    rate: 60,
    speed: 200,
    spread: Math.PI * 2,
    angle: 0,
    particleLife: 0.5,
    particleSize: 6,
    color: '#ff6b35',
    colorOverLife: ['#fff3b0', '#ff6b35', '#6d4c41'],
    sizeOverLife: { start: 1.4, end: 0 },
    gravity: 300,
    maxParticles: 80,
    blendMode: 'additive',
    particleShape: 'soft',
  },
  spark: {
    rate: 40,
    speed: 150,
    spread: Math.PI * 2,
    angle: 0,
    particleLife: 0.3,
    particleSize: 3,
    color: '#ffd54f',
    gravity: 400,
    maxParticles: 50,
    blendMode: 'additive',
    particleShape: 'soft',
  },
  damage: {
    rate: 45,
    speed: 120,
    spread: Math.PI * 2,
    angle: 0,
    particleLife: 0.35,
    particleSize: 4,
    color: '#ef5350',
    colorOverLife: ['#ffab91', '#ef5350', '#4a148c'],
    sizeOverLife: { start: 1, end: 0.2 },
    gravity: 150,
    maxParticles: 40,
    blendMode: 'normal',
    particleShape: 'circle',
  },
  heal: {
    rate: 22,
    speed: 50,
    spread: Math.PI / 2,
    angle: -Math.PI / 2,
    particleLife: 0.9,
    particleSize: 5,
    color: '#8bc34a',
    colorOverLife: ['#e8f5e9', '#8bc34a'],
    sizeOverLife: { start: 0.5, end: 1.2 },
    gravity: -60,
    maxParticles: 30,
    blendMode: 'additive',
    particleShape: 'soft',
  },
  magic: {
    rate: 32,
    speed: 80,
    spread: Math.PI * 2,
    angle: 0,
    particleLife: 1.1,
    particleSize: 5,
    color: '#ba68c8',
    colorOverLife: ['#e1bee7', '#ba68c8', '#4a148c'],
    sizeOverLife: { start: 1, end: 0 },
    gravity: -20,
    maxParticles: 60,
    blendMode: 'additive',
    particleShape: 'soft',
  },

  // ── Environment ──
  fire: {
    rate: 40,
    speed: 60,
    spread: 0.6,
    angle: -Math.PI / 2,
    particleLife: 0.7,
    particleSize: 7,
    color: '#ff9800',
    colorOverLife: ['#ffe082', '#ff9800', '#6d4c41', '#37474f'],
    sizeOverLife: { start: 1.2, end: 0.3 },
    gravity: -120,
    maxParticles: 70,
    blendMode: 'additive',
    particleShape: 'soft',
  },
  smoke: {
    rate: 15,
    speed: 30,
    spread: 0.5,
    angle: -Math.PI / 2,
    particleLife: 1.2,
    particleSize: 10,
    color: '#90a4ae',
    colorOverLife: ['#90a4ae', 'rgba(55,71,79,0)'],
    sizeOverLife: { start: 0.5, end: 1.8 },
    gravity: -20,
    maxParticles: 40,
    blendMode: 'normal',
    particleShape: 'soft',
  },
  rain: {
    rate: 80,
    speed: 350,
    spread: 0.05,
    angle: Math.PI / 2,
    particleLife: 0.8,
    particleSize: 2,
    color: '#81d4fa',
    gravity: 900,
    maxParticles: 300,
    blendMode: 'normal',
    particleShape: 'square',
  },
  snow: {
    rate: 20,
    speed: 40,
    spread: 0.4,
    angle: Math.PI / 2,
    particleLife: 4,
    particleSize: 3,
    color: '#ffffff',
    gravity: 20,
    maxParticles: 150,
    blendMode: 'normal',
    particleShape: 'circle',
  },
  fountain: {
    rate: 50,
    speed: 300,
    spread: 0.3,
    angle: -Math.PI / 2,
    particleLife: 1.5,
    particleSize: 4,
    color: '#4fc3f7',
    colorOverLife: ['#b3e5fc', '#4fc3f7', '#0277bd'],
    gravity: 500,
    maxParticles: 200,
    blendMode: 'additive',
    particleShape: 'soft',
  },

  // ── UI / reward ──
  coinPickup: {
    rate: 30,
    speed: 80,
    spread: Math.PI * 2,
    angle: -Math.PI / 2,
    particleLife: 0.4,
    particleSize: 4,
    color: '#ffd700',
    gravity: 200,
    maxParticles: 20,
    blendMode: 'additive',
    particleShape: 'soft',
  },
  pickup: {
    rate: 35,
    speed: 70,
    spread: Math.PI * 2,
    angle: 0,
    particleLife: 0.5,
    particleSize: 5,
    color: '#4fc3f7',
    colorOverLife: ['#ffffff', '#4fc3f7'],
    sizeOverLife: { start: 1, end: 0 },
    gravity: -80,
    maxParticles: 24,
    blendMode: 'additive',
    particleShape: 'soft',
  },
  sparkle: {
    rate: 14,
    speed: 40,
    spread: Math.PI * 2,
    angle: 0,
    particleLife: 0.8,
    particleSize: 3,
    color: '#fffde7',
    sizeOverLife: { start: 0, end: 1 },
    gravity: 0,
    maxParticles: 30,
    blendMode: 'additive',
    particleShape: 'soft',
  },
  confetti: {
    rate: 70,
    speed: 280,
    spread: Math.PI / 3,
    angle: -Math.PI / 2,
    particleLife: 2.2,
    particleSize: 5,
    color: '#ffc107',
    colorOverLife: ['#f44336', '#ffc107', '#4caf50', '#2196f3', '#9c27b0'],
    gravity: 400,
    maxParticles: 150,
    blendMode: 'normal',
    particleShape: 'square',
  },

  // ── Character ──
  jumpDust: {
    rate: 25,
    speed: 60,
    spread: Math.PI,
    angle: Math.PI / 2,
    particleLife: 0.3,
    particleSize: 5,
    color: '#b0bec5',
    gravity: 80,
    maxParticles: 20,
    blendMode: 'normal',
    particleShape: 'soft',
  },
  trail: {
    rate: 30,
    speed: 8,
    spread: 0.2,
    angle: Math.PI / 2,
    particleLife: 0.5,
    particleSize: 4,
    color: '#4fc3f7',
    sizeOverLife: { start: 1, end: 0 },
    gravity: 0,
    maxParticles: 40,
    blendMode: 'additive',
    particleShape: 'soft',
  },
}
