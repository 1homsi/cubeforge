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
  /** Formation mode target position */
  targetX?: number
  /** Formation mode target position */
  targetY?: number
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
  /**
   * WebGL blend mode for particles.
   * - `'normal'` (default) — standard alpha blending
   * - `'additive'` — particles brighten the background; produces a glow effect
   * - `'multiply'` — darkens based on particle color
   * - `'screen'` — lightens, softer than additive
   */
  blendMode?: 'normal' | 'additive' | 'multiply' | 'screen'
  /**
   * Formation mode: particles lerp toward fixed target positions instead of
   * being emitted with velocity. Enables logo reveals, constellations, morphing shapes.
   * - `'standard'` (default) — normal emit/gravity/lifetime behaviour
   * - `'formation'` — particles seek `formationPoints`; no gravity, no expiry
   */
  mode?: 'standard' | 'formation'
  /** Target positions for formation mode. One particle is spawned per point. */
  formationPoints?: { x: number; y: number }[]
  /**
   * How strongly particles seek their target each frame in formation mode.
   * Exponential lerp factor (0–1). Default 0.055 (~5.5% per frame at 60 fps).
   */
  seekStrength?: number
  /**
   * Smoothly transition all currently alive particles to this color.
   * Set alongside `colorTransitionDuration`. Clear by setting to undefined.
   */
  targetColor?: string
  /** Duration of the global color transition in seconds. Default 0.5. */
  colorTransitionDuration?: number
  /** @internal — tracks transition source color */
  _colorTransitionFrom?: string
  /** @internal — elapsed time for color transition */
  _colorTransitionElapsed?: number
}
