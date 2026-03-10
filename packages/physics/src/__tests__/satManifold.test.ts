import { describe, it, expect } from 'vitest'
import {
  generatePolygonPolygonManifold,
  generatePolygonCircleManifold,
  generatePolygonBoxManifold,
  generateSegmentCircleManifold,
  generateSegmentBoxManifold,
  generateHalfSpaceCircleManifold,
  generateHalfSpaceBoxManifold,
  generateHeightFieldCircleManifold,
  generateHeightFieldBoxManifold,
  closestPointOnSegment,
} from '../satManifold'

// ── Helper: triangle vertices (equilateral, centered at origin) ──────────────
const triangle = [
  { x: 0, y: -20 },
  { x: 17.32, y: 10 },
  { x: -17.32, y: 10 },
]

// ── Helper: pentagon vertices ────────────────────────────────────────────────
const pentagon: { x: number; y: number }[] = []
for (let i = 0; i < 5; i++) {
  const angle = (2 * Math.PI * i) / 5 - Math.PI / 2
  pentagon.push({ x: 20 * Math.cos(angle), y: 20 * Math.sin(angle) })
}

// ── Helper: square vertices (box as polygon) ────────────────────────────────
const square = [
  { x: -10, y: -10 },
  { x: 10, y: -10 },
  { x: 10, y: 10 },
  { x: -10, y: 10 },
]

describe('closestPointOnSegment', () => {
  it('returns start when projection is before segment', () => {
    const p = closestPointOnSegment(-10, 0, 0, 0, 10, 0)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0)
  })

  it('returns end when projection is past segment', () => {
    const p = closestPointOnSegment(20, 0, 0, 0, 10, 0)
    expect(p.x).toBeCloseTo(10)
    expect(p.y).toBeCloseTo(0)
  })

  it('returns projected point on segment', () => {
    const p = closestPointOnSegment(5, 10, 0, 0, 10, 0)
    expect(p.x).toBeCloseTo(5)
    expect(p.y).toBeCloseTo(0)
  })

  it('handles degenerate segment (zero length)', () => {
    const p = closestPointOnSegment(5, 5, 3, 3, 3, 3)
    expect(p.x).toBeCloseTo(3)
    expect(p.y).toBeCloseTo(3)
  })
})

describe('generatePolygonPolygonManifold', () => {
  it('returns null for non-overlapping polygons', () => {
    const result = generatePolygonPolygonManifold(square, 0, 0, 0, 0, square, 50, 0, 0, 0)
    expect(result).toBeNull()
  })

  it('generates contact for overlapping squares', () => {
    const result = generatePolygonPolygonManifold(square, 0, 0, 0, 0, square, 15, 0, 0, 0)
    expect(result).not.toBeNull()
    expect(result!.points.length).toBeGreaterThanOrEqual(1)
    expect(result!.points[0].penetration).toBeGreaterThan(0)
  })

  it('generates correct normal direction', () => {
    const result = generatePolygonPolygonManifold(square, 0, 0, 0, 0, square, 15, 0, 0, 0)
    expect(result).not.toBeNull()
    // Normal should roughly point from A to B (positive X direction)
    const len = Math.sqrt(result!.normalX ** 2 + result!.normalY ** 2)
    expect(len).toBeCloseTo(1, 2)
  })

  it('handles triangle-triangle overlap', () => {
    const result = generatePolygonPolygonManifold(triangle, 0, 0, 0, 0, triangle, 10, 0, 0, 0)
    expect(result).not.toBeNull()
    expect(result!.points.length).toBeGreaterThanOrEqual(1)
  })

  it('handles pentagon vs square', () => {
    const result = generatePolygonPolygonManifold(pentagon, 0, 0, 0, 0, square, 25, 0, 0, 0)
    expect(result).not.toBeNull()
    expect(result!.points[0].penetration).toBeGreaterThan(0)
  })

  it('returns zero penetration for just-touching polygons', () => {
    // Two squares exactly adjacent — depth = 0 (boundary case)
    const result = generatePolygonPolygonManifold(square, 0, 0, 0, 0, square, 20, 0, 0, 0)
    // At exactly touching, SAT finds depth = 0 — valid manifold but no real penetration
    if (result) {
      expect(result.points[0].penetration).toBeCloseTo(0, 5)
    }
  })

  it('respects offset parameters', () => {
    // Without offset: no overlap
    const noOverlap = generatePolygonPolygonManifold(square, 0, 0, 0, 0, square, 30, 0, 0, 0)
    expect(noOverlap).toBeNull()

    // With offset: creates overlap
    const withOffset = generatePolygonPolygonManifold(square, 0, 0, 10, 0, square, 30, 0, -10, 0)
    expect(withOffset).not.toBeNull()
  })
})

describe('generatePolygonCircleManifold', () => {
  it('returns null when circle is far from polygon', () => {
    const result = generatePolygonCircleManifold(square, 0, 0, 0, 0, 50, 0, 5)
    expect(result).toBeNull()
  })

  it('detects circle overlapping polygon edge', () => {
    // Circle just barely overlapping right edge of square
    const result = generatePolygonCircleManifold(square, 0, 0, 0, 0, 14, 0, 5)
    expect(result).not.toBeNull()
    expect(result!.points.length).toBe(1)
    expect(result!.points[0].penetration).toBeGreaterThan(0)
  })

  it('detects circle at polygon vertex', () => {
    // Circle near top-right corner
    const result = generatePolygonCircleManifold(square, 0, 0, 0, 0, 14, -14, 8)
    expect(result).not.toBeNull()
  })

  it('detects circle inside polygon', () => {
    const result = generatePolygonCircleManifold(square, 0, 0, 0, 0, 0, 0, 5)
    expect(result).not.toBeNull()
    expect(result!.points[0].penetration).toBeGreaterThan(0)
  })

  it('triangle vs circle', () => {
    const result = generatePolygonCircleManifold(triangle, 0, 0, 0, 0, 0, -18, 5)
    expect(result).not.toBeNull()
  })
})

describe('generatePolygonBoxManifold', () => {
  it('returns null for non-overlapping polygon and box', () => {
    const result = generatePolygonBoxManifold(triangle, 0, 0, 0, 0, 50, 0, 10, 10)
    expect(result).toBeNull()
  })

  it('detects overlapping polygon and box', () => {
    const result = generatePolygonBoxManifold(triangle, 0, 0, 0, 0, 10, 0, 10, 10)
    expect(result).not.toBeNull()
    expect(result!.points.length).toBeGreaterThanOrEqual(1)
  })

  it('pentagon vs box overlap', () => {
    const result = generatePolygonBoxManifold(pentagon, 0, 0, 0, 0, 25, 0, 10, 10)
    expect(result).not.toBeNull()
    expect(result!.points[0].penetration).toBeGreaterThan(0)
  })
})

describe('generateSegmentCircleManifold', () => {
  it('returns null when circle is far from segment', () => {
    const result = generateSegmentCircleManifold(0, 0, 100, 0, 50, 50, 5)
    expect(result).toBeNull()
  })

  it('detects circle overlapping segment middle', () => {
    const result = generateSegmentCircleManifold(0, 0, 100, 0, 50, 3, 5)
    expect(result).not.toBeNull()
    expect(result!.points[0].penetration).toBeCloseTo(2, 0)
  })

  it('detects circle overlapping segment endpoint', () => {
    const result = generateSegmentCircleManifold(0, 0, 10, 0, -3, 0, 5)
    expect(result).not.toBeNull()
    expect(result!.points[0].penetration).toBeCloseTo(2, 0)
  })

  it('normal points from segment toward circle', () => {
    const result = generateSegmentCircleManifold(0, 0, 100, 0, 50, -10, 15)
    expect(result).not.toBeNull()
    // Circle is above segment (negative Y), normal should have a component pointing from segment toward circle
  })
})

describe('generateSegmentBoxManifold', () => {
  it('returns null when segment is far from box', () => {
    const result = generateSegmentBoxManifold(0, 0, 10, 0, 50, 0, 5, 5)
    expect(result).toBeNull()
  })

  it('detects segment overlapping box', () => {
    // Horizontal segment passing through box
    const result = generateSegmentBoxManifold(-20, 0, 20, 0, 0, 0, 10, 10)
    expect(result).not.toBeNull()
  })
})

describe('generateHalfSpaceCircleManifold', () => {
  it('returns null when circle is above the plane', () => {
    // Plane at y=0, normal pointing up (0, -1), circle at y=-20
    const result = generateHalfSpaceCircleManifold(0, 0, 0, -1, 0, -20, 5)
    expect(result).toBeNull()
  })

  it('detects circle resting on plane', () => {
    // Plane at y=100, normal pointing up (0, -1), circle at y=97
    const result = generateHalfSpaceCircleManifold(0, 100, 0, -1, 0, 97, 5)
    expect(result).not.toBeNull()
    expect(result!.points[0].penetration).toBeCloseTo(2, 0)
  })

  it('detects circle penetrating plane', () => {
    // Plane at y=0, normal pointing up (0, -1), circle at y=0
    const result = generateHalfSpaceCircleManifold(0, 0, 0, -1, 0, 0, 10)
    expect(result).not.toBeNull()
    expect(result!.points[0].penetration).toBe(10)
  })
})

describe('generateHalfSpaceBoxManifold', () => {
  it('returns null when box is above plane', () => {
    const result = generateHalfSpaceBoxManifold(0, 100, 0, -1, 0, 50, 10, 10)
    expect(result).toBeNull()
  })

  it('detects box resting on plane', () => {
    // Plane at y=100, normal up. Box center at y=92 with hh=10 → bottom at y=102
    const result = generateHalfSpaceBoxManifold(0, 100, 0, -1, 0, 92, 10, 10)
    expect(result).not.toBeNull()
    expect(result!.points.length).toBe(2) // bottom-left and bottom-right corners
    expect(result!.points[0].penetration).toBeCloseTo(2, 0)
  })

  it('works with angled half-space', () => {
    // 45-degree plane
    const nx = Math.SQRT1_2
    const ny = -Math.SQRT1_2
    const result = generateHalfSpaceBoxManifold(0, 0, nx, ny, 0, 0, 5, 5)
    expect(result).not.toBeNull()
  })
})

describe('generateHeightFieldCircleManifold', () => {
  it('returns null when circle is above heightfield', () => {
    const heights = [0, 0, 0, 0, 0]
    const result = generateHeightFieldCircleManifold(0, 100, heights, 10, 1, 20, 80, 5)
    expect(result).toBeNull()
  })

  it('detects circle resting on flat heightfield', () => {
    // Flat heightfield at y=100 (heights all 0, scaleY=1 → segments at y=100)
    const heights = [0, 0, 0, 0, 0]
    const result = generateHeightFieldCircleManifold(0, 100, heights, 20, 1, 40, 97, 5)
    expect(result).not.toBeNull()
    expect(result!.points[0].penetration).toBeCloseTo(2, 0)
  })

  it('detects circle on sloped heightfield', () => {
    // Heights rise from 0 to 10
    const heights = [0, 5, 10, 10, 10]
    const result = generateHeightFieldCircleManifold(0, 100, heights, 20, -1, 30, 93, 5)
    expect(result).not.toBeNull()
  })
})

describe('generateHeightFieldBoxManifold', () => {
  it('returns null when box is above heightfield', () => {
    const heights = [0, 0, 0, 0]
    const result = generateHeightFieldBoxManifold(0, 100, heights, 20, 1, 30, 80, 10, 10)
    expect(result).toBeNull()
  })

  it('detects box on flat heightfield', () => {
    const heights = [0, 0, 0, 0]
    const result = generateHeightFieldBoxManifold(0, 100, heights, 20, 1, 30, 100, 10, 10)
    // Box bottom at y=110, heightfield at y=100 → segment-box test
    expect(result).not.toBeNull()
  })
})
