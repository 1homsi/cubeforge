/**
 * Object pooling for physics hot-path allocations.
 *
 * Avoids GC pressure by reusing objects across frames instead of
 * allocating new ones each tick. All pools auto-grow when exhausted.
 */

// ── Generic Pool ─────────────────────────────────────────────────────────────

/**
 * Simple object pool with auto-grow and reset semantics.
 *
 * Usage:
 * ```ts
 * const pool = new ObjectPool(() => ({ x: 0, y: 0 }), (obj) => { obj.x = 0; obj.y = 0 })
 * const obj = pool.acquire()
 * // ... use obj ...
 * pool.releaseAll()  // returns all acquired objects to pool
 * ```
 */
export class ObjectPool<T> {
  private items: T[] = []
  private index = 0

  constructor(
    private readonly factory: () => T,
    private readonly reset: (item: T) => void,
  ) {}

  /** Acquire an object from the pool (or create one if exhausted). */
  acquire(): T {
    if (this.index < this.items.length) {
      const item = this.items[this.index++]
      this.reset(item)
      return item
    }
    const item = this.factory()
    this.items.push(item)
    this.index++
    return item
  }

  /** Return all acquired objects to the pool without deallocating. */
  releaseAll(): void {
    this.index = 0
  }

  /** Number of objects currently in use. */
  get activeCount(): number {
    return this.index
  }

  /** Total capacity (used + free). */
  get capacity(): number {
    return this.items.length
  }
}

// ── Typed Array Pool ─────────────────────────────────────────────────────────

/**
 * Pool for reusable typed arrays (Float64Array, Int32Array, etc.).
 * Grows the backing buffer when needed rather than allocating new arrays.
 */
export class Float64Pool {
  private buffer: Float64Array
  private offset = 0

  constructor(initialCapacity = 1024) {
    this.buffer = new Float64Array(initialCapacity)
  }

  /** Allocate a slice of `count` floats from the pool. Returns start index. */
  alloc(count: number): number {
    if (this.offset + count > this.buffer.length) {
      // Grow buffer
      const newSize = Math.max(this.buffer.length * 2, this.offset + count)
      const newBuf = new Float64Array(newSize)
      newBuf.set(this.buffer)
      this.buffer = newBuf
    }
    const start = this.offset
    this.offset += count
    return start
  }

  /** Get the underlying buffer for reading/writing. */
  get data(): Float64Array {
    return this.buffer
  }

  /** Reset allocator — all previous slices become invalid. */
  reset(): void {
    this.offset = 0
  }
}

// ── Vec2 Pool ────────────────────────────────────────────────────────────────

interface PooledVec2 {
  x: number
  y: number
}

const vec2Pool = new ObjectPool<PooledVec2>(
  () => ({ x: 0, y: 0 }),
  (v) => {
    v.x = 0
    v.y = 0
  },
)

/** Acquire a temporary Vec2 from the pool. */
export function acquireVec2(x = 0, y = 0): PooledVec2 {
  const v = vec2Pool.acquire()
  v.x = x
  v.y = y
  return v
}

/** Release all temporary Vec2s back to the pool. Call once per frame. */
export function releaseAllVec2s(): void {
  vec2Pool.releaseAll()
}

// ── Contact Point Pool ───────────────────────────────────────────────────────

import type { ContactPoint } from './contactManifold'

const contactPointPool = new ObjectPool<ContactPoint>(
  () => ({
    worldAx: 0,
    worldAy: 0,
    worldBx: 0,
    worldBy: 0,
    rAx: 0,
    rAy: 0,
    rBx: 0,
    rBy: 0,
    penetration: 0,
    normalImpulse: 0,
    tangentImpulse: 0,
    featureId: 0,
  }),
  (p) => {
    p.worldAx = 0
    p.worldAy = 0
    p.worldBx = 0
    p.worldBy = 0
    p.rAx = 0
    p.rAy = 0
    p.rBx = 0
    p.rBy = 0
    p.penetration = 0
    p.normalImpulse = 0
    p.tangentImpulse = 0
    p.featureId = 0
  },
)

/** Acquire a contact point from the pool. */
export function acquireContactPoint(): ContactPoint {
  return contactPointPool.acquire()
}

/** Release all contact points back to the pool. Call once per frame. */
export function releaseAllContactPoints(): void {
  contactPointPool.releaseAll()
}

// ── Manifold Array Pool ──────────────────────────────────────────────────────

import type { ContactManifold } from './contactManifold'

const manifoldPool = new ObjectPool<ContactManifold>(
  () => ({
    entityA: 0,
    entityB: 0,
    normalX: 0,
    normalY: 0,
    points: [],
    friction: 0,
    restitution: 0,
  }),
  (m) => {
    m.entityA = 0
    m.entityB = 0
    m.normalX = 0
    m.normalY = 0
    m.points.length = 0
    m.friction = 0
    m.restitution = 0
  },
)

/** Acquire a contact manifold from the pool. */
export function acquireManifold(): ContactManifold {
  return manifoldPool.acquire()
}

/** Release all manifolds back to the pool. Call once per frame. */
export function releaseAllManifolds(): void {
  manifoldPool.releaseAll()
}

// ── Frame-level pool reset ───────────────────────────────────────────────────

/**
 * Reset all physics pools. Call once at the start of each physics step
 * to reclaim all temporary objects from the previous frame.
 */
export function resetAllPools(): void {
  vec2Pool.releaseAll()
  contactPointPool.releaseAll()
  manifoldPool.releaseAll()
}
