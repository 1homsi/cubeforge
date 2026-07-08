import { describe, it, expect } from 'vitest'
import { NavigationMesh3D } from '../effects'
import type { NavMeshPolygon } from '../effects'
import { Vec3 } from '../math'
import { BufferGeometry, BufferAttribute } from '../geometry'

function makePoly(center: Vec3, neighbors: number[], normal = new Vec3(0, 1, 0)): NavMeshPolygon {
  return {
    vertices: [center.clone(), center.clone(), center.clone()],
    center,
    normal,
    neighbors,
  }
}

describe('NavigationMesh3D — empty mesh', () => {
  it('constructs with no polygons by default', () => {
    const nav = new NavigationMesh3D()
    expect(nav.polygons).toEqual([])
  })

  it('findPath returns null when there are no polygons', () => {
    const nav = new NavigationMesh3D()
    expect(nav.findPath(new Vec3(0, 0, 0), new Vec3(1, 0, 0))).toBeNull()
  })

  it('getPolygonAt returns -1 for an empty mesh', () => {
    const nav = new NavigationMesh3D()
    expect(nav.getPolygonAt(new Vec3(0, 0, 0))).toBe(-1)
  })
})

describe('NavigationMesh3D — getPolygonAt', () => {
  it('returns the index of the nearest centroid', () => {
    const nav = new NavigationMesh3D([makePoly(new Vec3(0, 0, 0), [1]), makePoly(new Vec3(10, 0, 0), [0])])
    expect(nav.getPolygonAt(new Vec3(1, 0, 0))).toBe(0)
    expect(nav.getPolygonAt(new Vec3(9, 0, 0))).toBe(1)
  })
})

describe('NavigationMesh3D — findPath', () => {
  it('returns [start, end] when start and end are in the same polygon', () => {
    const nav = new NavigationMesh3D([makePoly(new Vec3(0, 0, 0), [])])
    const path = nav.findPath(new Vec3(0.1, 0, 0), new Vec3(0.2, 0, 0))
    expect(path).not.toBeNull()
    expect(path!.length).toBe(2)
    expect(path![0].x).toBeCloseTo(0.1)
    expect(path![1].x).toBeCloseTo(0.2)
  })

  it('collapses collinear centroids during string-pull smoothing', () => {
    // Three polygons in a straight line. The middle centroid is collinear
    // so string-pull should drop it, leaving only start and end.
    const nav = new NavigationMesh3D([
      makePoly(new Vec3(0, 0, 0), [1]),
      makePoly(new Vec3(5, 0, 0), [0, 2]),
      makePoly(new Vec3(10, 0, 0), [1]),
    ])
    const path = nav.findPath(new Vec3(0, 0, 0), new Vec3(10, 0, 0))
    expect(path).not.toBeNull()
    expect(path!.length).toBe(2)
    expect(path![0].x).toBeCloseTo(0)
    expect(path![1].x).toBeCloseTo(10)
  })

  it('keeps a bent corner waypoint during string-pull smoothing', () => {
    // A right-angle bend: the middle centroid adds enough detour that
    // string-pull keeps it.
    const nav = new NavigationMesh3D([
      makePoly(new Vec3(0, 0, 0), [1]),
      makePoly(new Vec3(5, 0, 0), [0, 2]),
      makePoly(new Vec3(5, 0, 5), [1]),
    ])
    const path = nav.findPath(new Vec3(0, 0, 0), new Vec3(5, 0, 5))
    expect(path).not.toBeNull()
    expect(path!.length).toBe(3)
    expect(path![1].x).toBeCloseTo(5)
    expect(path![1].z).toBeCloseTo(0)
  })

  it('returns null when the goal polygon is unreachable', () => {
    // Two disconnected polygons (no neighbors between them).
    const nav = new NavigationMesh3D([makePoly(new Vec3(0, 0, 0), []), makePoly(new Vec3(100, 0, 0), [])])
    const path = nav.findPath(new Vec3(0, 0, 0), new Vec3(100, 0, 0))
    expect(path).toBeNull()
  })
})

describe('NavigationMesh3D — snapToNavMesh', () => {
  it('projects a point onto the nearest polygon plane', () => {
    const nav = new NavigationMesh3D([
      {
        vertices: [new Vec3(0, 0, 0), new Vec3(10, 0, 0), new Vec3(0, 0, 10)],
        center: new Vec3(3, 0, 3),
        normal: new Vec3(0, 1, 0),
        neighbors: [],
      },
    ])
    const snapped = nav.snapToNavMesh(new Vec3(2, 5, 3))
    expect(snapped.x).toBeCloseTo(2)
    expect(snapped.y).toBeCloseTo(0)
    expect(snapped.z).toBeCloseTo(3)
  })
})

describe('NavigationMesh3D — fromGeometry', () => {
  it('builds polygons from an indexed ground quad and detects adjacency', () => {
    // Quad on the XZ plane (y = 0), two triangles sharing an edge.
    const positions = new Float32Array([
      0,
      0,
      0, // 0
      10,
      0,
      0, // 1
      10,
      0,
      10, // 2
      0,
      0,
      10, // 3
    ])
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    geo.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1))

    const nav = NavigationMesh3D.fromGeometry(geo)
    expect(nav.polygons.length).toBe(2)
    // Triangles share vertices 0 and 2 -> adjacent
    expect(nav.polygons[0].neighbors).toContain(1)
    expect(nav.polygons[1].neighbors).toContain(0)
  })

  it('filters out steep faces beyond maxSlopeAngle', () => {
    // A vertical wall triangle (normal roughly horizontal) should be excluded.
    const positions = new Float32Array([0, 0, 0, 0, 10, 0, 0, 0, 10])
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    const nav = NavigationMesh3D.fromGeometry(geo)
    expect(nav.polygons.length).toBe(0)
  })
})

describe('NavigationMesh3D — toDebugGeometry', () => {
  it('produces a position attribute for the polygon soup', () => {
    const nav = new NavigationMesh3D([
      {
        vertices: [new Vec3(0, 0, 0), new Vec3(1, 0, 0), new Vec3(0, 0, 1)],
        center: new Vec3(0.33, 0, 0.33),
        normal: new Vec3(0, 1, 0),
        neighbors: [],
      },
    ])
    const geo = nav.toDebugGeometry()
    const pos = geo.getAttribute('position')
    expect(pos).toBeTruthy()
    // One triangle -> 3 vertices
    expect(pos!.count).toBe(3)
  })
})
