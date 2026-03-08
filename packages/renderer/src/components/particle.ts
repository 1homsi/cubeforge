import type { Component } from '@cubeforge/core'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  gravity: number
}

export interface ParticlePoolComponent extends Component {
  readonly type: 'ParticlePool'
  particles: Particle[]
  maxParticles: number
  /** Whether new particles are being emitted */
  active: boolean
  /** Particles per second */
  rate: number
  /** Accumulator for fractional particles */
  timer: number
  /** Particle initial speed (pixels/s) */
  speed: number
  /** Angle spread in radians */
  spread: number
  /** Base emit angle in radians (0 = right, -PI/2 = up) */
  angle: number
  /** Particle lifetime in seconds */
  particleLife: number
  /** Particle size in pixels */
  particleSize: number
  /** Particle color */
  color: string
  /** Gravity applied to particles (pixels/s²) */
  gravity: number
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
}
