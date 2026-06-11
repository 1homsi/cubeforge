import type { Particle } from './components/particle'

export interface ParticleAttractor {
  x: number
  y: number
  strength: number
  radius: number
}

export interface ParticleUpdateOptions {
  mode?: 'standard' | 'formation'
  seekStrength?: number
  attractors?: ParticleAttractor[]
}

/** A particle with all optional extension fields guaranteed to be set. */
export type FullParticle = Required<Particle>

/** Reusable default particle values */
function resetParticle(p: FullParticle): FullParticle {
  p.x = 0
  p.y = 0
  p.vx = 0
  p.vy = 0
  p.life = 0
  p.maxLife = 0
  p.size = 0
  p.color = '#ffffff'
  p.gravity = 0
  p.rotation = 0
  p.rotationSpeed = 0
  p.currentSize = 0
  p.startSize = 0
  p.endSize = 0
  p._active = false
  p.targetX = 0
  p.targetY = 0
  return p
}

function createParticle(): FullParticle {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0,
    size: 0,
    color: '#ffffff',
    gravity: 0,
    rotation: 0,
    rotationSpeed: 0,
    currentSize: 0,
    startSize: 0,
    endSize: 0,
    _active: false,
    targetX: 0,
    targetY: 0,
  }
}

/**
 * Object pool for Particle instances to avoid GC pressure.
 * Particles are recycled instead of being created / destroyed each frame.
 */
export class ParticleObjectPool {
  private pool: FullParticle[] = []

  /** Return a particle from the pool, or create a new one if empty. */
  acquire(): FullParticle {
    const p = this.pool.pop()
    if (p) {
      p._active = true
      return p
    }
    const fresh = createParticle()
    fresh._active = true
    return fresh
  }

  /** Reset a particle and return it to the pool for later reuse. */
  release(p: FullParticle): void {
    resetParticle(p)
    this.pool.push(p)
  }

  /** Pre-create particles so early frames don't allocate. */
  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      this.pool.push(createParticle())
    }
  }

  /** Number of particles currently available in the pool. */
  get available(): number {
    return this.pool.length
  }
}

/**
 * Advance particles in place and compact expired particles without allocating
 * a replacement array. Both Canvas and WebGL renderers use this hot path.
 */
export function updateParticlesInPlace(
  particles: Particle[],
  dt: number,
  { mode, seekStrength, attractors }: ParticleUpdateOptions = {},
): void {
  if (mode === 'formation') {
    const seek = seekStrength ?? 0.055
    for (const p of particles) {
      if (p.targetX !== undefined && p.targetY !== undefined) {
        p.x += (p.targetX - p.x) * seek
        p.y += (p.targetY - p.y) * seek
      }
      applyAttractors(p, dt, attractors, true)
    }
    return
  }

  let alive = particles.length
  for (let i = alive - 1; i >= 0; i--) {
    const p = particles[i]
    p.life -= dt
    if (p.life <= 0) {
      alive--
      particles[i] = particles[alive]
      continue
    }

    applyAttractors(p, dt, attractors, false)
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += p.gravity * dt
    if (p.rotationSpeed !== undefined) p.rotation = (p.rotation ?? 0) + p.rotationSpeed * dt
    if (p.startSize !== undefined && p.endSize !== undefined && p.maxLife > 0) {
      const lifeT = 1 - p.life / p.maxLife
      p.currentSize = p.startSize + (p.endSize - p.startSize) * lifeT
    }
  }
  particles.length = alive
}

function applyAttractors(
  particle: Particle,
  dt: number,
  attractors: ParticleAttractor[] | undefined,
  positional: boolean,
): void {
  if (!attractors) return
  for (const attr of attractors) {
    const dx = positional ? particle.x - attr.x : attr.x - particle.x
    const dy = positional ? particle.y - attr.y : attr.y - particle.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist >= attr.radius || dist <= 0) continue

    if (positional) {
      const magnitude = -attr.strength * (1 - dist / attr.radius) * dt
      particle.x += (dx / dist) * magnitude
      particle.y += (dy / dist) * magnitude
    } else {
      const force = attr.strength * (1 - dist / attr.radius)
      particle.vx += (dx / dist) * force * dt
      particle.vy += (dy / dist) * force * dt
    }
  }
}
