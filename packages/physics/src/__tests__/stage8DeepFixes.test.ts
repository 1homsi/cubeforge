import { describe, it, expect } from 'vitest'
import { gjk, epa, gjkEpaQuery, boxShape, circleShape, capsuleShape, polygonShape, type ConvexShape } from '../gjk'
import { SweepAndPrune, type BroadPhaseAABB } from '../broadPhase'
import { IslandDetector } from '../islandDetector'
import { computeTOI, type TOIBody } from '../toi'
import { deterministicAtan2, deterministicSqrt, KahanSum } from '../determinism'
import type { EntityId } from '@cubeforge/core'
import type { ContactManifold } from '../contactManifold'

// ── Helpers ──────────────────────────────────────────────────────────────────

function eid(n: number): EntityId {
  return n as EntityId
}

function makeAABB(entityId: number, minX: number, minY: number, maxX: number, maxY: number): BroadPhaseAABB {
  return { entityId: eid(entityId), minX, minY, maxX, maxY }
}

function makeManifold(entityA: number, entityB: number): ContactManifold {
  return {
    entityA: entityA as EntityId,
    entityB: entityB as EntityId,
    normalX: 1,
    normalY: 0,
    friction: 0.5,
    restitution: 0,
    points: [
      {
        worldAx: 0,
        worldAy: 0,
        worldBx: 0,
        worldBy: 0,
        rAx: 0,
        rAy: 0,
        rBx: 0,
        rBy: 0,
        penetration: 1,
        normalImpulse: 0,
        tangentImpulse: 0,
        featureId: 0,
      },
    ],
  }
}

function makeTOIBody(overrides: Partial<TOIBody> = {}): TOIBody {
  return {
    x: 0,
    y: 0,
    rotation: 0,
    vx: 0,
    vy: 0,
    angVel: 0,
    hw: 10,
    hh: 10,
    shapeType: 'box',
    ...overrides,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GJK / EPA
// ══════════════════════════════════════════════════════════════════════════════

describe('GJK/EPA — box vs box', () => {
  it('reports no collision for two separated boxes', () => {
    const a = boxShape(0, 0, 10, 10, 0)
    const b = boxShape(50, 0, 10, 10, 0)
    const result = gjk(a, b)
    expect(result.collision).toBe(false)
    expect(result.closestDistance).toBeGreaterThan(0)
  })

  it('detects collision for two overlapping boxes', () => {
    const a = boxShape(0, 0, 10, 10, 0)
    const b = boxShape(15, 0, 10, 10, 0)
    const result = gjk(a, b)
    expect(result.collision).toBe(true)
    expect(result.closestDistance).toBe(0)
  })

  it('returns correct penetration depth and normal via EPA', () => {
    // Two boxes overlapping by 5 units on the X axis
    const a = boxShape(0, 0, 10, 10, 0)
    const b = boxShape(15, 0, 10, 10, 0)
    const gjkResult = gjk(a, b)
    expect(gjkResult.collision).toBe(true)

    const epaResult = epa(a, b, gjkResult.simplex)
    // Overlap is 5 units (10 + 10 - 15 = 5)
    expect(epaResult.penetration).toBeCloseTo(5, 0)
    // Normal should be approximately along X axis
    const nx = Math.abs(epaResult.normalX)
    const ny = Math.abs(epaResult.normalY)
    expect(nx).toBeGreaterThan(ny)
  })
})

describe('GJK/EPA — circle vs circle', () => {
  it('detects overlap for two overlapping circles', () => {
    const a = circleShape(0, 0, 10)
    const b = circleShape(15, 0, 10)
    const result = gjk(a, b)
    expect(result.collision).toBe(true)

    const epaResult = epa(a, b, result.simplex)
    // Penetration: 10 + 10 - 15 = 5
    expect(epaResult.penetration).toBeCloseTo(5, 0)
  })

  it('reports no collision for separated circles', () => {
    const a = circleShape(0, 0, 5)
    const b = circleShape(20, 0, 5)
    const result = gjk(a, b)
    expect(result.collision).toBe(false)
    expect(result.closestDistance).toBeGreaterThan(0)
  })
})

describe('GJK/EPA — box vs circle', () => {
  it('detects overlap between box and circle', () => {
    const box = boxShape(0, 0, 10, 10, 0)
    const circle = circleShape(18, 0, 10)
    const result = gjk(box, circle)
    expect(result.collision).toBe(true)

    const epaResult = epa(box, circle, result.simplex)
    // Box right edge at 10, circle left edge at 18-10=8 → overlap = 2
    expect(epaResult.penetration).toBeCloseTo(2, 0)
  })
})

describe('GJK/EPA — capsule vs box', () => {
  it('detects overlap between capsule and box', () => {
    // Capsule centered at origin, hw=5 (radius), hh=15 (total half-height)
    const cap = capsuleShape(0, 0, 5, 15)
    // Box to the right, partially overlapping
    const box = boxShape(12, 0, 10, 10, 0)
    const result = gjk(cap, box)
    expect(result.collision).toBe(true)
  })
})

describe('GJK/EPA — polygon vs polygon (triangles)', () => {
  it('detects overlap between two overlapping triangles', () => {
    const triA = polygonShape(
      0,
      0,
      [
        { x: 0, y: -10 },
        { x: 10, y: 10 },
        { x: -10, y: 10 },
      ],
      0,
    )
    const triB = polygonShape(
      5,
      0,
      [
        { x: 0, y: -10 },
        { x: 10, y: 10 },
        { x: -10, y: 10 },
      ],
      0,
    )
    const result = gjk(triA, triB)
    expect(result.collision).toBe(true)

    const epaResult = epa(triA, triB, result.simplex)
    expect(epaResult.penetration).toBeGreaterThan(0)
  })

  it('reports no collision for separated triangles', () => {
    const triA = polygonShape(
      0,
      0,
      [
        { x: 0, y: -5 },
        { x: 5, y: 5 },
        { x: -5, y: 5 },
      ],
      0,
    )
    const triB = polygonShape(
      50,
      0,
      [
        { x: 0, y: -5 },
        { x: 5, y: 5 },
        { x: -5, y: 5 },
      ],
      0,
    )
    const result = gjk(triA, triB)
    expect(result.collision).toBe(false)
  })
})

describe('GJK/EPA — degenerate and edge cases', () => {
  it('handles identical shapes at the same position', () => {
    const a = boxShape(0, 0, 10, 10, 0)
    const b = boxShape(0, 0, 10, 10, 0)
    const result = gjk(a, b)
    expect(result.collision).toBe(true)
  })

  it('handles near-touching shapes at tolerance boundary', () => {
    // Two boxes barely separated by a tiny gap
    const a = boxShape(0, 0, 10, 10, 0)
    // Gap of 0.001 units
    const b = boxShape(20.001, 0, 10, 10, 0)
    const result = gjk(a, b)
    expect(result.collision).toBe(false)
    expect(result.closestDistance).toBeCloseTo(0.001, 2)
  })

  it('handles exactly touching shapes (zero gap)', () => {
    const a = boxShape(0, 0, 10, 10, 0)
    const b = boxShape(20, 0, 10, 10, 0)
    const result = gjk(a, b)
    // At exact boundary, GJK may report either collision or very close distance
    if (result.collision) {
      expect(result.closestDistance).toBe(0)
    } else {
      expect(result.closestDistance).toBeLessThan(0.01)
    }
  })
})

describe('gjkEpaQuery — high-level API', () => {
  it('returns contact manifold for overlapping shapes', () => {
    const a = boxShape(0, 0, 10, 10, 0)
    const b = boxShape(15, 0, 10, 10, 0)
    const contact = gjkEpaQuery(a, b)
    expect(contact).not.toBeNull()
    expect(contact!.penetration).toBeCloseTo(5, 0)
    // Normal should point roughly along X
    expect(Math.abs(contact!.normalX)).toBeGreaterThan(Math.abs(contact!.normalY))
  })

  it('returns null for separated shapes', () => {
    const a = boxShape(0, 0, 10, 10, 0)
    const b = boxShape(50, 0, 10, 10, 0)
    const contact = gjkEpaQuery(a, b)
    expect(contact).toBeNull()
  })

  it('returns contact manifold for circle-circle overlap', () => {
    const a = circleShape(0, 0, 10)
    const b = circleShape(12, 0, 10)
    const contact = gjkEpaQuery(a, b)
    expect(contact).not.toBeNull()
    // Penetration: 10 + 10 - 12 = 8
    expect(contact!.penetration).toBeCloseTo(8, 0)
  })

  it('provides contact points on each shape', () => {
    const a = boxShape(0, 0, 10, 10, 0)
    const b = boxShape(15, 0, 10, 10, 0)
    const contact = gjkEpaQuery(a, b)
    expect(contact).not.toBeNull()
    // Contact points should be finite numbers
    expect(Number.isFinite(contact!.contactAx)).toBe(true)
    expect(Number.isFinite(contact!.contactAy)).toBe(true)
    expect(Number.isFinite(contact!.contactBx)).toBe(true)
    expect(Number.isFinite(contact!.contactBy)).toBe(true)
  })

  it('handles degenerate identical-position shapes via simplex expansion', () => {
    const a = boxShape(0, 0, 10, 10, 0)
    const b = boxShape(0, 0, 10, 10, 0)
    const contact = gjkEpaQuery(a, b)
    expect(contact).not.toBeNull()
    expect(contact!.penetration).toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Sweep-and-Prune (Broad Phase)
// ══════════════════════════════════════════════════════════════════════════════

describe('SweepAndPrune', () => {
  it('returns pair for two overlapping AABBs', () => {
    const sap = new SweepAndPrune()
    sap.update([makeAABB(1, 0, 0, 20, 20), makeAABB(2, 10, 0, 30, 20)])
    const pairs = sap.query()
    expect(pairs).toHaveLength(1)
    expect(pairs[0]).toEqual(expect.objectContaining({ entityA: eid(1), entityB: eid(2) }))
  })

  it('returns no pairs for two separated AABBs', () => {
    const sap = new SweepAndPrune()
    sap.update([makeAABB(1, 0, 0, 10, 10), makeAABB(2, 50, 0, 60, 10)])
    const pairs = sap.query()
    expect(pairs).toHaveLength(0)
  })

  it('returns only the overlapping pair among three AABBs', () => {
    const sap = new SweepAndPrune()
    sap.update([makeAABB(1, 0, 0, 20, 20), makeAABB(2, 15, 0, 35, 20), makeAABB(3, 100, 0, 120, 20)])
    const pairs = sap.query()
    expect(pairs).toHaveLength(1)
    // The pair should be between entities 1 and 2
    const ids = [pairs[0].entityA, pairs[0].entityB].sort((a, b) => a - b)
    expect(ids).toEqual([eid(1), eid(2)])
  })

  it('handles entity removal', () => {
    const sap = new SweepAndPrune()
    sap.update([makeAABB(1, 0, 0, 20, 20), makeAABB(2, 10, 0, 30, 20)])
    expect(sap.query()).toHaveLength(1)

    sap.remove(eid(2))
    // After removal, update with just entity 1
    sap.update([makeAABB(1, 0, 0, 20, 20)])
    expect(sap.query()).toHaveLength(0)
  })

  it('detects pair changes after position updates', () => {
    const sap = new SweepAndPrune()

    // Initially separated
    sap.update([makeAABB(1, 0, 0, 10, 10), makeAABB(2, 50, 0, 60, 10)])
    expect(sap.query()).toHaveLength(0)

    // Move entity 2 to overlap with entity 1
    sap.update([makeAABB(1, 0, 0, 10, 10), makeAABB(2, 5, 0, 15, 10)])
    expect(sap.query()).toHaveLength(1)

    // Move entity 2 away again
    sap.update([makeAABB(1, 0, 0, 10, 10), makeAABB(2, 100, 0, 110, 10)])
    expect(sap.query()).toHaveLength(0)
  })

  it('clear resets all state', () => {
    const sap = new SweepAndPrune()
    sap.update([makeAABB(1, 0, 0, 20, 20), makeAABB(2, 10, 0, 30, 20)])
    expect(sap.query()).toHaveLength(1)

    sap.clear()
    expect(sap.query()).toHaveLength(0)
  })

  it('requires Y-axis overlap — X overlap alone is not enough', () => {
    const sap = new SweepAndPrune()
    // X ranges overlap (0-20 and 10-30) but Y ranges do not (0-10 and 50-60)
    sap.update([makeAABB(1, 0, 0, 20, 10), makeAABB(2, 10, 50, 30, 60)])
    const pairs = sap.query()
    expect(pairs).toHaveLength(0)
  })

  it('handles automatic removal of stale entities', () => {
    const sap = new SweepAndPrune()
    sap.update([makeAABB(1, 0, 0, 20, 20), makeAABB(2, 10, 0, 30, 20)])
    expect(sap.query()).toHaveLength(1)

    // Update with only entity 1 — entity 2 should be auto-removed
    sap.update([makeAABB(1, 0, 0, 20, 20)])
    expect(sap.query()).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Island Detection
// ══════════════════════════════════════════════════════════════════════════════

describe('IslandDetector', () => {
  const detector = new IslandDetector()
  const staticSet = new Set<EntityId>()
  const isStatic = (id: EntityId) => staticSet.has(id)
  const allSleepy = (_id: EntityId) => true
  const noneSleeepy = (_id: EntityId) => false

  it('groups two dynamic bodies touching into the same island', () => {
    staticSet.clear()
    const manifolds = [makeManifold(1, 2)]
    const islands = detector.detect([eid(1), eid(2)], manifolds, [], isStatic, noneSleeepy)
    expect(islands).toHaveLength(1)
    expect(islands[0].bodies.sort((a, b) => a - b)).toEqual([eid(1), eid(2)])
  })

  it('separates two dynamic bodies not touching into different islands', () => {
    staticSet.clear()
    const islands = detector.detect(
      [eid(1), eid(2)],
      [], // no manifolds
      [],
      isStatic,
      noneSleeepy,
    )
    expect(islands).toHaveLength(2)
    // Each island should have exactly one body
    const sizes = islands.map((i) => i.bodies.length).sort()
    expect(sizes).toEqual([1, 1])
  })

  it('puts dynamic body touching static into island with just the dynamic body', () => {
    staticSet.clear()
    staticSet.add(eid(10))
    const manifolds = [makeManifold(1, 10)]
    const islands = detector.detect(
      [eid(1)], // only dynamic bodies
      manifolds,
      [],
      isStatic,
      noneSleeepy,
    )
    expect(islands).toHaveLength(1)
    expect(islands[0].bodies).toEqual([eid(1)])
    // The manifold should still be associated with the island
    expect(islands[0].manifoldIndices).toEqual([0])
  })

  it('chains 3 dynamic bodies into a single island', () => {
    staticSet.clear()
    // A touches B, B touches C → all three in one island
    const manifolds = [makeManifold(1, 2), makeManifold(2, 3)]
    const islands = detector.detect([eid(1), eid(2), eid(3)], manifolds, [], isStatic, noneSleeepy)
    expect(islands).toHaveLength(1)
    expect(islands[0].bodies.sort((a, b) => a - b)).toEqual([eid(1), eid(2), eid(3)])
    expect(islands[0].manifoldIndices.sort()).toEqual([0, 1])
  })

  it('uses joint connections to group bodies into the same island', () => {
    staticSet.clear()
    // No manifolds, but a joint connects entity 1 and 2
    const jointPairs: [EntityId, EntityId][] = [[eid(1), eid(2)]]
    const islands = detector.detect([eid(1), eid(2)], [], jointPairs, isStatic, noneSleeepy)
    expect(islands).toHaveLength(1)
    expect(islands[0].bodies.sort((a, b) => a - b)).toEqual([eid(1), eid(2)])
  })

  it('detects sleep candidates when all bodies are sleepy', () => {
    staticSet.clear()
    const manifolds = [makeManifold(1, 2)]
    const islands = detector.detect([eid(1), eid(2)], manifolds, [], isStatic, allSleepy)
    expect(islands).toHaveLength(1)
    expect(islands[0].canSleep).toBe(true)
  })

  it('does not mark island as sleepable if any body is not a sleep candidate', () => {
    staticSet.clear()
    const manifolds = [makeManifold(1, 2)]
    const mixedSleep = (id: EntityId) => id === eid(1) // only entity 1 is sleepy
    const islands = detector.detect([eid(1), eid(2)], manifolds, [], isStatic, mixedSleep)
    expect(islands).toHaveLength(1)
    expect(islands[0].canSleep).toBe(false)
  })

  it('returns empty output for empty input', () => {
    staticSet.clear()
    const islands = detector.detect([], [], [], isStatic, noneSleeepy)
    expect(islands).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Time of Impact (TOI)
// ══════════════════════════════════════════════════════════════════════════════

describe('computeTOI', () => {
  it('finds TOI for two circles moving toward each other', () => {
    const a = makeTOIBody({ x: 0, y: 0, vx: 100, vy: 0, hw: 5, hh: 5, shapeType: 'circle' })
    const b = makeTOIBody({ x: 100, y: 0, vx: -100, vy: 0, hw: 5, hh: 5, shapeType: 'circle' })
    const result = computeTOI(a, b, 1)
    expect(result).not.toBeNull()
    expect(result!.toi).toBeGreaterThan(0)
    expect(result!.toi).toBeLessThan(1)
  })

  it('returns null for two circles moving apart', () => {
    const a = makeTOIBody({ x: 0, y: 0, vx: -100, vy: 0, hw: 5, hh: 5, shapeType: 'circle' })
    const b = makeTOIBody({ x: 100, y: 0, vx: 100, vy: 0, hw: 5, hh: 5, shapeType: 'circle' })
    const result = computeTOI(a, b, 1)
    expect(result).toBeNull()
  })

  it('finds TOI for box-box head-on collision', () => {
    const a = makeTOIBody({ x: 0, y: 0, vx: 50, vy: 0, hw: 10, hh: 10, shapeType: 'box' })
    const b = makeTOIBody({ x: 100, y: 0, vx: -50, vy: 0, hw: 10, hh: 10, shapeType: 'box' })
    const result = computeTOI(a, b, 1)
    expect(result).not.toBeNull()
    expect(result!.toi).toBeGreaterThan(0)
    expect(result!.toi).toBeLessThan(1)
  })

  it('detects impact with stationary target', () => {
    // Projectile moving right toward a stationary box
    const projectile = makeTOIBody({ x: 0, y: 0, vx: 200, vy: 0, hw: 5, hh: 5, shapeType: 'box' })
    const target = makeTOIBody({ x: 50, y: 0, vx: 0, vy: 0, hw: 10, hh: 10, shapeType: 'box' })
    const result = computeTOI(projectile, target, 1)
    expect(result).not.toBeNull()
    expect(result!.toi).toBeGreaterThan(0)
    expect(result!.toi).toBeLessThan(1)
  })

  it('returns TOI at 0 for already overlapping shapes', () => {
    const a = makeTOIBody({ x: 0, y: 0, vx: 10, vy: 0, hw: 10, hh: 10, shapeType: 'box' })
    const b = makeTOIBody({ x: 5, y: 0, vx: -10, vy: 0, hw: 10, hh: 10, shapeType: 'box' })
    const result = computeTOI(a, b, 1)
    expect(result).not.toBeNull()
    expect(result!.toi).toBe(0)
  })

  it('returns null for perpendicular motion (no impact)', () => {
    // A moves right, B moves up — they never meet
    const a = makeTOIBody({ x: 0, y: 0, vx: 100, vy: 0, hw: 5, hh: 5, shapeType: 'box' })
    const b = makeTOIBody({ x: 0, y: 100, vx: 0, vy: -100, hw: 5, hh: 5, shapeType: 'box' })
    // They start far apart on different axes — but they might actually collide
    // depending on speed. Use truly perpendicular with large separation.
    const c = makeTOIBody({ x: -500, y: 0, vx: 0, vy: 100, hw: 5, hh: 5, shapeType: 'box' })
    const d = makeTOIBody({ x: 500, y: 0, vx: 0, vy: -100, hw: 5, hh: 5, shapeType: 'box' })
    const result = computeTOI(c, d, 1)
    expect(result).toBeNull()
  })

  it('handles high-speed collision (large velocities)', () => {
    const a = makeTOIBody({ x: 0, y: 0, vx: 10000, vy: 0, hw: 5, hh: 5, shapeType: 'circle' })
    const b = makeTOIBody({ x: 500, y: 0, vx: -10000, vy: 0, hw: 5, hh: 5, shapeType: 'circle' })
    const result = computeTOI(a, b, 1)
    expect(result).not.toBeNull()
    expect(result!.toi).toBeGreaterThan(0)
    expect(result!.toi).toBeLessThan(1)
  })

  it('returns null when there is no relative motion', () => {
    const a = makeTOIBody({ x: 0, y: 0, vx: 0, vy: 0, hw: 5, hh: 5, shapeType: 'box' })
    const b = makeTOIBody({ x: 50, y: 0, vx: 0, vy: 0, hw: 5, hh: 5, shapeType: 'box' })
    const result = computeTOI(a, b, 1)
    expect(result).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Determinism
// ══════════════════════════════════════════════════════════════════════════════

describe('deterministicAtan2', () => {
  it('matches Math.atan2 within tolerance for various inputs', () => {
    const cases: [number, number][] = [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
      [0.5, 0.866],
      [3, 4],
      [0.001, 1000],
      [1000, 0.001],
      [7, 24],
      [-5, 12],
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

  it('returns approximately 0 for (0, 1) — zero angle', () => {
    const result = deterministicAtan2(0, 1)
    expect(Math.abs(result)).toBeLessThan(0.002)
  })

  it('returns approximately PI/2 for (1, 0)', () => {
    const result = deterministicAtan2(1, 0)
    expect(Math.abs(result - Math.PI / 2)).toBeLessThan(0.002)
  })

  it('returns approximately PI for (0, -1)', () => {
    const result = deterministicAtan2(0, -1)
    expect(Math.abs(result - Math.PI)).toBeLessThan(0.002)
  })

  it('returns approximately -PI/2 for (-1, 0)', () => {
    const result = deterministicAtan2(-1, 0)
    expect(Math.abs(result - -Math.PI / 2)).toBeLessThan(0.002)
  })
})

describe('deterministicSqrt', () => {
  it('matches Math.sqrt within tolerance for various inputs', () => {
    const values = [0, 0.25, 1, 2, 4, 9, 16, 100, 12345, 0.0001]
    for (const v of values) {
      expect(deterministicSqrt(v)).toBeCloseTo(Math.sqrt(v), 10)
    }
  })

  it('returns 0 for 0', () => {
    expect(deterministicSqrt(0)).toBe(0)
  })

  it('returns 0 for negative input', () => {
    expect(deterministicSqrt(-5)).toBe(0)
  })

  it('handles very large values', () => {
    expect(deterministicSqrt(1e12)).toBeCloseTo(Math.sqrt(1e12), 5)
  })

  it('handles very small positive values', () => {
    expect(deterministicSqrt(1e-10)).toBeCloseTo(Math.sqrt(1e-10), 10)
  })
})

describe('KahanSum', () => {
  it('accumulates many small values more accurately than naive sum', () => {
    const kahan = new KahanSum()
    let naive = 0
    const n = 100000
    const smallValue = 0.1

    for (let i = 0; i < n; i++) {
      kahan.add(smallValue)
      naive += smallValue
    }

    const expected = n * smallValue // 10000
    const kahanError = Math.abs(kahan.value - expected)
    const naiveError = Math.abs(naive - expected)

    // Kahan should be at least as accurate as naive, and typically much better
    expect(kahanError).toBeLessThan(1e-8)
    // With 100k additions of 0.1, naive sum accumulates noticeable error
    expect(kahanError).toBeLessThanOrEqual(naiveError + 1e-15)
  })

  it('resets to zero', () => {
    const sum = new KahanSum()
    sum.add(100)
    sum.add(200)
    expect(sum.value).toBe(300)
    sum.reset()
    expect(sum.value).toBe(0)
  })

  it('handles mixed positive and negative values', () => {
    const sum = new KahanSum()
    for (let i = 0; i < 10000; i++) {
      sum.add(1)
      sum.add(-1)
    }
    expect(Math.abs(sum.value)).toBeLessThan(1e-10)
  })

  it('handles a single value', () => {
    const sum = new KahanSum()
    sum.add(42)
    expect(sum.value).toBe(42)
  })
})
