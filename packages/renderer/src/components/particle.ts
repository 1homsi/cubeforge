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
  /** Rotation in radians */
  rotation?: number
  /** Rotation speed in radians/s */
  rotationSpeed?: number
  /** Current size (allows size-over-life) */
  currentSize?: number
  /** Start size */
  startSize?: number
  /** End size (interpolated over lifetime) */
  endSize?: number
  /** Whether the particle is active (used by object pool) */
  _active?: boolean
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
  /** Sprite/texture source for particles (if undefined, renders as colored rect) */
  textureSrc?: string
  /** Loaded texture image (internal, populated from textureSrc) */
  _textureImage?: HTMLImageElement
  /** Enable particle rotation. Default false */
  enableRotation?: boolean
  /** Random rotation speed range [min, max] in radians/s */
  rotationSpeedRange?: [number, number]
  /** Size over lifetime: start and end size. If set, overrides particleSize */
  sizeOverLife?: { start: number; end: number }
  /** Attractor points that pull particles toward them */
  attractors?: { x: number; y: number; strength: number; radius: number }[]
  /** Color over lifetime: array of colors to interpolate through */
  colorOverLife?: string[]
  /** Use object pooling for particles (avoids GC). Default true */
  pooled?: boolean
}
