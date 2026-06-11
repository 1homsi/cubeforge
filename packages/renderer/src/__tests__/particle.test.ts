import { describe, it, expect } from 'vitest'
import { ParticleObjectPool, updateParticlesInPlace } from '../particlePool'
import type { FullParticle } from '../particlePool'
import type { Particle } from '../components/particle'

describe('ParticleObjectPool', () => {
  it('acquire returns a particle with _active true', () => {
    const pool = new ParticleObjectPool()
    const p = pool.acquire()
    expect(p).toBeDefined()
    expect(p._active).toBe(true)
    expect(p.x).toBe(0)
    expect(p.y).toBe(0)
    expect(p.rotation).toBe(0)
    expect(p.rotationSpeed).toBe(0)
    expect(p.currentSize).toBe(0)
    expect(p.startSize).toBe(0)
    expect(p.endSize).toBe(0)
  })

  it('release returns particle to pool and resets it', () => {
    const pool = new ParticleObjectPool()
    const p = pool.acquire()
    p.x = 100
    p.y = 200
    p.rotation = 1.5
    p.rotationSpeed = 3
    p.currentSize = 10
    p._active = true

    pool.release(p)
    expect(p._active).toBe(false)
    expect(p.x).toBe(0)
    expect(p.rotation).toBe(0)
    expect(pool.available).toBe(1)

    // Re-acquiring should return the same object
    const p2 = pool.acquire()
    expect(p2).toBe(p)
    expect(p2._active).toBe(true)
    expect(pool.available).toBe(0)
  })

  it('prewarm creates the specified count', () => {
    const pool = new ParticleObjectPool()
    pool.prewarm(50)
    expect(pool.available).toBe(50)

    const p = pool.acquire()
    expect(p).toBeDefined()
    expect(pool.available).toBe(49)
  })
})

describe('Particle rotation', () => {
  it('rotationSpeed is applied over time', () => {
    const pool = new ParticleObjectPool()
    const p = pool.acquire()
    p.rotationSpeed = 2 // 2 rad/s

    // Simulate an update step
    const dt = 0.016 // ~60fps
    p.rotation += p.rotationSpeed * dt

    expect(p.rotation).toBeCloseTo(0.032, 5)

    // Another step
    p.rotation += p.rotationSpeed * dt
    expect(p.rotation).toBeCloseTo(0.064, 5)
  })
})

describe('Particle sizeOverLife', () => {
  it('size interpolates correctly from start to end over lifetime', () => {
    const pool = new ParticleObjectPool()
    const p = pool.acquire()
    p.startSize = 10
    p.endSize = 2
    p.maxLife = 1.0
    p.life = 1.0
    p.currentSize = p.startSize

    // Simulate size-over-life interpolation (t goes from 0 to 1 as life decreases)
    function updateSize(particle: FullParticle) {
      const t = 1 - particle.life / particle.maxLife // 0 at birth, 1 at death
      particle.currentSize = particle.startSize + (particle.endSize - particle.startSize) * t
    }

    // At birth (life = maxLife), size should be startSize
    updateSize(p)
    expect(p.currentSize).toBeCloseTo(10, 5)

    // At half life
    p.life = 0.5
    updateSize(p)
    expect(p.currentSize).toBeCloseTo(6, 5)

    // At end of life
    p.life = 0
    updateSize(p)
    expect(p.currentSize).toBeCloseTo(2, 5)
  })
})

describe('Attractor', () => {
  it('pulls particle toward attractor point', () => {
    const pool = new ParticleObjectPool()
    const p = pool.acquire()
    p.x = 0
    p.y = 0
    p.vx = 0
    p.vy = 0

    const attractor = { x: 100, y: 0, strength: 500, radius: 200 }
    const dt = 0.016

    // Simulate attractor force
    const dx = attractor.x - p.x
    const dy = attractor.y - p.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < attractor.radius && dist > 0) {
      const force = attractor.strength * (1 - dist / attractor.radius)
      p.vx += (dx / dist) * force * dt
      p.vy += (dy / dist) * force * dt
    }

    // Particle should now be moving toward the attractor (positive vx)
    expect(p.vx).toBeGreaterThan(0)
    expect(p.vy).toBeCloseTo(0, 5)

    // Apply velocity
    p.x += p.vx * dt
    p.y += p.vy * dt

    // Particle should have moved closer to attractor
    expect(p.x).toBeGreaterThan(0)
  })

  it('does not affect particle outside attractor radius', () => {
    const pool = new ParticleObjectPool()
    const p = pool.acquire()
    p.x = 0
    p.y = 0
    p.vx = 0
    p.vy = 0

    const attractor = { x: 1000, y: 0, strength: 500, radius: 50 }
    const dt = 0.016

    const dx = attractor.x - p.x
    const dy = attractor.y - p.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < attractor.radius && dist > 0) {
      const force = attractor.strength * (1 - dist / attractor.radius)
      p.vx += (dx / dist) * force * dt
      p.vy += (dy / dist) * force * dt
    }

    // Particle is outside radius — velocity unchanged
    expect(p.vx).toBe(0)
    expect(p.vy).toBe(0)
  })
})

describe('updateParticlesInPlace', () => {
  function particle(overrides: Partial<Particle> = {}): Particle {
    return {
      x: 0,
      y: 0,
      vx: 10,
      vy: 20,
      life: 1,
      maxLife: 1,
      size: 10,
      color: '#ffffff',
      gravity: 100,
      ...overrides,
    }
  }

  it('compacts expired particles without replacing the array', () => {
    const particles = [
      particle({ color: 'alive-a', life: 1, vx: 10, vy: 0, gravity: 0 }),
      particle({ color: 'dead', life: 0.1 }),
      particle({ color: 'alive-b', life: 1, vx: 0, vy: 10, gravity: 0 }),
    ]
    const sameArray = particles

    updateParticlesInPlace(particles, 0.2)

    expect(particles).toBe(sameArray)
    expect(particles).toHaveLength(2)
    expect(particles.map((p) => p.color).sort()).toEqual(['alive-a', 'alive-b'])
    const aliveA = particles.find((p) => p.color === 'alive-a')!
    const aliveB = particles.find((p) => p.color === 'alive-b')!
    expect(aliveA.life).toBeCloseTo(0.8)
    expect(aliveA.x).toBeCloseTo(2)
    expect(aliveB.y).toBeCloseTo(2)
  })

  it('updates attractors, rotation, and size over life for living particles', () => {
    const particles = [
      particle({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        gravity: 0,
        rotation: 0,
        rotationSpeed: 2,
        startSize: 10,
        endSize: 2,
      }),
    ]

    updateParticlesInPlace(particles, 0.25, {
      attractors: [{ x: 100, y: 0, strength: 100, radius: 200 }],
    })

    expect(particles[0].vx).toBeGreaterThan(0)
    expect(particles[0].x).toBeGreaterThan(0)
    expect(particles[0].rotation).toBeCloseTo(0.5)
    expect(particles[0].currentSize).toBeCloseTo(8)
  })

  it('keeps formation particles alive while seeking targets', () => {
    const particles = [
      particle({
        x: 0,
        y: 0,
        life: 0,
        targetX: 100,
        targetY: 50,
      }),
    ]

    updateParticlesInPlace(particles, 1, { mode: 'formation', seekStrength: 0.25 })

    expect(particles).toHaveLength(1)
    expect(particles[0].life).toBe(0)
    expect(particles[0].x).toBeCloseTo(25)
    expect(particles[0].y).toBeCloseTo(12.5)
  })
})
