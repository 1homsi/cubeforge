import { describe, it, expect } from 'vitest'
import { ECSWorld } from '@cubeforge/core'
import { createTransform } from '@cubeforge/core'
import { createRigidBody } from '../components/rigidbody'
import { createBoxCollider } from '../components/boxCollider'
import { createCircleCollider } from '../components/circleCollider'
import { createCapsuleCollider } from '../components/capsuleCollider'
import { createJoint } from '../components/joint'
import { CollisionPipeline } from '../collisionPipeline'
import {
  takeSnapshot,
  restoreSnapshot,
  snapshotToJSON,
  snapshotFromJSON,
  snapshotToBytes,
  snapshotFromBytes,
  snapshotHash,
} from '../snapshot'
import { DebugRenderPipeline } from '../debugRender'
import {
  sortEntities,
  generateDeterministicPairs,
  pairKey,
  deterministicAtan2,
  deterministicSqrt,
  KahanSum,
} from '../determinism'
import { PhysicsSystem } from '../physicsSystem'
import type { TransformComponent } from '@cubeforge/core'
import type { RigidBodyComponent } from '../components/rigidbody'

function addBox(
  world: ECSWorld,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { isStatic?: boolean; isTrigger?: boolean },
) {
  const id = world.createEntity()
  world.addComponent(id, createTransform(x, y))
  world.addComponent(id, createRigidBody({ isStatic: opts?.isStatic ?? false }))
  world.addComponent(id, createBoxCollider(w, h, { isTrigger: opts?.isTrigger }))
  return id
}

// ── CollisionPipeline ─────────────────────────────────────────────────────

describe('CollisionPipeline', () => {
  it('detects overlapping boxes without dynamics', () => {
    const world = new ECSWorld()
    addBox(world, 100, 100, 20, 20)
    addBox(world, 110, 100, 20, 20)

    const pipeline = new CollisionPipeline()
    const result = pipeline.detect(world)

    expect(result.manifolds.length).toBe(1)
    expect(result.manifolds[0].points.length).toBeGreaterThan(0)
  })

  it('returns empty for non-overlapping boxes', () => {
    const world = new ECSWorld()
    addBox(world, 100, 100, 20, 20)
    addBox(world, 200, 100, 20, 20)

    const pipeline = new CollisionPipeline()
    const result = pipeline.detect(world)

    expect(result.manifolds).toHaveLength(0)
    expect(result.broadPhasePairs).toHaveLength(0)
  })

  it('detects intersection pairs for triggers', () => {
    const world = new ECSWorld()
    addBox(world, 100, 100, 20, 20)
    addBox(world, 110, 100, 20, 20, { isTrigger: true })

    const pipeline = new CollisionPipeline()
    const result = pipeline.detect(world)

    expect(result.intersectionPairs).toHaveLength(1)
    expect(result.manifolds).toHaveLength(0) // triggers don't generate manifolds
  })

  it('broadPhaseOnly returns pairs without narrow phase', () => {
    const world = new ECSWorld()
    addBox(world, 100, 100, 20, 20)
    addBox(world, 110, 100, 20, 20)
    addBox(world, 500, 500, 20, 20) // far away

    const pipeline = new CollisionPipeline()
    const pairs = pipeline.broadPhaseOnly(world)

    expect(pairs).toHaveLength(1) // only the overlapping pair
  })

  it('excludes joint-excluded pairs', () => {
    const world = new ECSWorld()
    const a = addBox(world, 100, 100, 20, 20)
    const b = addBox(world, 110, 100, 20, 20)

    // Joint connecting a and b with contactsEnabled=false
    const jid = world.createEntity()
    world.addComponent(jid, createJoint({ jointType: 'distance', entityA: a, entityB: b, contactsEnabled: false }))

    const pipeline = new CollisionPipeline()
    const result = pipeline.detect(world)

    expect(result.manifolds).toHaveLength(0)
  })

  it('detects circle-box overlap', () => {
    const world = new ECSWorld()
    addBox(world, 100, 100, 20, 20)
    const cid = world.createEntity()
    world.addComponent(cid, createTransform(115, 100))
    world.addComponent(cid, createRigidBody({}))
    world.addComponent(cid, createCircleCollider(10))

    const pipeline = new CollisionPipeline()
    const result = pipeline.detect(world)

    expect(result.manifolds.length).toBe(1)
  })
})

// ── Snapshot ──────────────────────────────────────────────────────────────

describe('Snapshot — takeSnapshot / restoreSnapshot', () => {
  it('round-trips body state', () => {
    const world = new ECSWorld()
    const id = addBox(world, 100, 200, 20, 20)
    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
    rb.vx = 50
    rb.vy = -30
    rb.angularVelocity = 1.5

    const snap = takeSnapshot(world)
    expect(snap.bodies).toHaveLength(1)
    expect(snap.bodies[0].vx).toBe(50)

    // Mutate
    rb.vx = 0
    rb.vy = 0
    const t = world.getComponent<TransformComponent>(id, 'Transform')!
    t.x = 999

    // Restore
    restoreSnapshot(world, snap)

    expect(t.x).toBe(100)
    expect(rb.vx).toBe(50)
    expect(rb.vy).toBe(-30)
    expect(rb.angularVelocity).toBe(1.5)
  })

  it('includes joints in snapshot', () => {
    const world = new ECSWorld()
    const a = addBox(world, 0, 0, 10, 10)
    const b = addBox(world, 50, 0, 10, 10)
    const jid = world.createEntity()
    world.addComponent(jid, createJoint({ jointType: 'distance', entityA: a, entityB: b }))

    const snap = takeSnapshot(world)
    expect(snap.joints).toHaveLength(1)
    expect(snap.joints[0].entityA).toBe(a)
    expect(snap.joints[0].entityB).toBe(b)
  })
})

describe('Snapshot — JSON serialization', () => {
  it('round-trips via JSON', () => {
    const world = new ECSWorld()
    addBox(world, 42, 84, 20, 20)

    const snap = takeSnapshot(world)
    const json = snapshotToJSON(snap)
    const restored = snapshotFromJSON(json)

    expect(restored.bodies[0].x).toBe(42)
    expect(restored.bodies[0].y).toBe(84)
    expect(restored.version).toBe(snap.version)
  })
})

describe('Snapshot — binary serialization', () => {
  it('round-trips via Uint8Array', () => {
    const world = new ECSWorld()
    const id = addBox(world, 123, 456, 20, 20)
    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
    rb.vx = 77.5
    rb.angularVelocity = -2.3

    const snap = takeSnapshot(world)
    const bytes = snapshotToBytes(snap)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)

    const restored = snapshotFromBytes(bytes)
    expect(restored.bodies[0].x).toBe(123)
    expect(restored.bodies[0].y).toBe(456)
    expect(restored.bodies[0].vx).toBeCloseTo(77.5)
    expect(restored.bodies[0].angularVelocity).toBeCloseTo(-2.3)
  })
})

describe('Snapshot — hash', () => {
  it('produces same hash for same state', () => {
    const world = new ECSWorld()
    addBox(world, 100, 200, 20, 20)
    const snap1 = takeSnapshot(world)
    const snap2 = takeSnapshot(world)

    expect(snapshotHash(snap1)).toBe(snapshotHash(snap2))
  })

  it('produces different hash for different state', () => {
    const world = new ECSWorld()
    const id = addBox(world, 100, 200, 20, 20)
    const snap1 = takeSnapshot(world)

    const t = world.getComponent<TransformComponent>(id, 'Transform')!
    t.x = 101
    const snap2 = takeSnapshot(world)

    expect(snapshotHash(snap1)).not.toBe(snapshotHash(snap2))
  })
})

// ── DebugRenderPipeline ──────────────────────────────────────────────────

describe('DebugRenderPipeline', () => {
  it('renders box colliders as rectangles', () => {
    const world = new ECSWorld()
    addBox(world, 100, 100, 20, 20)

    const debug = new DebugRenderPipeline()
    const output = debug.render(world)

    // A box = 4 lines
    expect(output.lines.length).toBeGreaterThanOrEqual(4)
  })

  it('renders circle colliders', () => {
    const world = new ECSWorld()
    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createCircleCollider(15))

    const debug = new DebugRenderPipeline()
    const output = debug.render(world)

    expect(output.circles.length).toBe(1)
    expect(output.circles[0].radius).toBe(15)
  })

  it('renders capsule colliders', () => {
    const world = new ECSWorld()
    const id = world.createEntity()
    world.addComponent(id, createTransform(100, 100))
    world.addComponent(id, createCapsuleCollider(16, 32))

    const debug = new DebugRenderPipeline()
    const output = debug.render(world)

    // Capsule = 2 lines + 2 circles
    expect(output.lines.length).toBe(2)
    expect(output.circles.length).toBe(2)
  })

  it('renders contact points when manifolds provided', () => {
    const debug = new DebugRenderPipeline()
    const output = debug.render(new ECSWorld(), [
      {
        entityA: 1,
        entityB: 2,
        normalX: 1,
        normalY: 0,
        friction: 0.5,
        restitution: 0,
        points: [
          {
            worldAx: 10,
            worldAy: 20,
            worldBx: 15,
            worldBy: 20,
            rAx: 0,
            rAy: 0,
            rBx: 0,
            rBy: 0,
            penetration: 5,
            normalImpulse: 0,
            tangentImpulse: 0,
            featureId: 0,
          },
        ],
      },
    ])

    expect(output.points.length).toBe(1)
    expect(output.lines.length).toBe(1) // normal arrow
  })

  it('renders joints as lines between anchors', () => {
    const world = new ECSWorld()
    const a = addBox(world, 0, 0, 10, 10)
    const b = addBox(world, 50, 0, 10, 10)
    const jid = world.createEntity()
    world.addComponent(jid, createJoint({ jointType: 'distance', entityA: a, entityB: b }))

    const debug = new DebugRenderPipeline()
    const output = debug.render(world)

    // Should have joint line + 2 joint anchor points + box lines
    const jointLines = output.lines.filter((l) => l.color === '#26c6da')
    const jointPoints = output.points.filter((p) => p.color === '#26c6da')
    expect(jointLines.length).toBe(1)
    expect(jointPoints.length).toBe(2)
  })

  it('respects render flags', () => {
    const world = new ECSWorld()
    addBox(world, 100, 100, 20, 20)

    const debug = new DebugRenderPipeline({ colliders: false, bodies: false })
    const output = debug.render(world)

    expect(output.lines).toHaveLength(0)
    expect(output.circles).toHaveLength(0)
  })

  it('renders velocity vectors when enabled', () => {
    const world = new ECSWorld()
    const id = addBox(world, 100, 100, 20, 20)
    const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
    rb.vx = 100
    rb.vy = 50

    const debug = new DebugRenderPipeline({ velocityVectors: true })
    const output = debug.render(world)

    const velLines = output.lines.filter((l) => l.color === '#81c784')
    expect(velLines.length).toBe(1)
  })

  it('renders center of mass when enabled', () => {
    const world = new ECSWorld()
    addBox(world, 100, 100, 20, 20)

    const debug = new DebugRenderPipeline({ centerOfMass: true })
    const output = debug.render(world)

    const comLines = output.lines.filter((l) => l.color === '#ff7043')
    expect(comLines.length).toBe(2) // cross = 2 lines
  })

  it('renderTo calls backend methods', () => {
    const world = new ECSWorld()
    addBox(world, 100, 100, 20, 20)

    const calls: string[] = []
    const backend = {
      drawLine: () => calls.push('line'),
      drawCircle: () => calls.push('circle'),
      drawPoint: () => calls.push('point'),
    }

    const debug = new DebugRenderPipeline()
    debug.renderTo(backend, world)

    expect(calls.filter((c) => c === 'line').length).toBeGreaterThanOrEqual(4)
  })
})

// ── Determinism ──────────────────────────────────────────────────────────

describe('Determinism — sortEntities', () => {
  it('sorts entity IDs numerically', () => {
    expect(sortEntities([5, 2, 8, 1, 3])).toEqual([1, 2, 3, 5, 8])
  })

  it('does not mutate original array', () => {
    const arr = [3, 1, 2]
    sortEntities(arr)
    expect(arr).toEqual([3, 1, 2])
  })
})

describe('Determinism — generateDeterministicPairs', () => {
  it('generates canonical pairs', () => {
    const pairs = generateDeterministicPairs([1, 3], [2, 4])
    expect(pairs).toEqual([
      [1, 2],
      [1, 4],
      [2, 3],
      [3, 4],
    ])
  })

  it('skips self-pairs', () => {
    const pairs = generateDeterministicPairs([1, 2], [1, 2])
    // Should have [1,2] only (not [1,1] or [2,2])
    expect(pairs).toEqual([
      [1, 2],
      [1, 2],
    ])
  })
})

describe('Determinism — pairKey', () => {
  it('produces canonical key regardless of order', () => {
    expect(pairKey(5, 3)).toBe('3:5')
    expect(pairKey(3, 5)).toBe('3:5')
  })
})

describe('Determinism — deterministicAtan2', () => {
  it('approximates Math.atan2 within 0.002 radians', () => {
    const cases = [
      [0, 1],
      [1, 0],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
      [0.5, 0.866],
      [3, 4],
    ]
    for (const [y, x] of cases) {
      const expected = Math.atan2(y, x)
      const actual = deterministicAtan2(y, x)
      expect(Math.abs(actual - expected)).toBeLessThan(0.002)
    }
  })

  it('returns 0 for (0, 0)', () => {
    expect(deterministicAtan2(0, 0)).toBe(0)
  })
})

describe('Determinism — deterministicSqrt', () => {
  it('approximates Math.sqrt', () => {
    for (const v of [0, 1, 2, 4, 9, 16, 100, 0.25]) {
      expect(deterministicSqrt(v)).toBeCloseTo(Math.sqrt(v), 10)
    }
  })
})

describe('Determinism — KahanSum', () => {
  it('accumulates values with reduced floating-point error', () => {
    const sum = new KahanSum()
    for (let i = 0; i < 10000; i++) {
      sum.add(0.1)
    }
    // Should be very close to 1000
    expect(Math.abs(sum.value - 1000)).toBeLessThan(1e-10)
  })

  it('resets properly', () => {
    const sum = new KahanSum()
    sum.add(42)
    sum.reset()
    expect(sum.value).toBe(0)
  })
})

// ── Deterministic simulation ─────────────────────────────────────────────

describe('Determinism — simulation replay', () => {
  it('produces identical snapshot hashes after N frames', () => {
    function runSim() {
      const world = new ECSWorld()
      const physics = new PhysicsSystem(500)

      // Create a box that will fall
      const id = world.createEntity()
      world.addComponent(id, createTransform(100, 0))
      world.addComponent(id, createRigidBody({ mass: 1 }))
      world.addComponent(id, createBoxCollider(20, 20))

      // Ground
      const gid = world.createEntity()
      world.addComponent(gid, createTransform(100, 200))
      world.addComponent(gid, createRigidBody({ isStatic: true }))
      world.addComponent(gid, createBoxCollider(200, 20))

      for (let i = 0; i < 60; i++) {
        physics.update(world, 1 / 60)
      }
      return snapshotHash(takeSnapshot(world))
    }

    const hash1 = runSim()
    const hash2 = runSim()
    expect(hash1).toBe(hash2)
  })
})
