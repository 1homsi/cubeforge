import type { Particle } from './components/particle'

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
