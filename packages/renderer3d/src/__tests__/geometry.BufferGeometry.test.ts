import { describe, it, expect } from 'vitest'
import { BufferAttribute, BufferGeometry } from '../geometry'
import { Vec3 } from '../math'

describe('BufferAttribute', () => {
  it('derives count from data length and itemSize', () => {
    const attr = new BufferAttribute(new Float32Array(12), 3)
    expect(attr.count).toBe(4)
    expect(attr.itemSize).toBe(3)
    expect(attr.normalized).toBe(false)
  })

  it('reads and writes components via accessors', () => {
    const attr = new BufferAttribute(new Float32Array(8), 4)
    attr.setXYZW(1, 10, 20, 30, 40)
    expect(attr.getX(1)).toBe(10)
    expect(attr.getY(1)).toBe(20)
    expect(attr.getZ(1)).toBe(30)
    expect(attr.getW(1)).toBe(40)
    attr.setX(0, 5).setY(0, 6).setZ(0, 7)
    expect([attr.getX(0), attr.getY(0), attr.getZ(0)]).toEqual([5, 6, 7])
  })

  it('increments version only when needsUpdate is set true', () => {
    const attr = new BufferAttribute(new Float32Array(3), 3)
    expect(attr.version).toBe(0)
    attr.needsUpdate = false
    expect(attr.version).toBe(0)
    attr.needsUpdate = true
    attr.needsUpdate = true
    expect(attr.version).toBe(2)
  })

  it('copyAt copies one item from a source attribute', () => {
    const src = new BufferAttribute(new Float32Array([1, 2, 3, 4, 5, 6]), 3)
    const dst = new BufferAttribute(new Float32Array(6), 3)
    dst.copyAt(0, src, 1)
    expect([dst.getX(0), dst.getY(0), dst.getZ(0)]).toEqual([4, 5, 6])
  })

  it('clone produces an independent copy with matching type', () => {
    const attr = new BufferAttribute(new Float32Array([1, 2, 3]), 3, true)
    const copy = attr.clone()
    expect(copy.data).toBeInstanceOf(Float32Array)
    expect(copy.itemSize).toBe(3)
    expect(copy.normalized).toBe(true)
    copy.setX(0, 99)
    expect(attr.getX(0)).toBe(1) // original untouched
    expect(copy.getX(0)).toBe(99)
  })
})

describe('BufferGeometry', () => {
  it('sets, gets and deletes attributes', () => {
    const geo = new BufferGeometry()
    const attr = new BufferAttribute(new Float32Array(9), 3)
    expect(geo.setAttribute('position', attr)).toBe(geo) // chainable
    expect(geo.getAttribute('position')).toBe(attr)
    geo.deleteAttribute('position')
    expect(geo.getAttribute('position')).toBeUndefined()
  })

  it('has expected defaults', () => {
    const geo = new BufferGeometry()
    expect(geo.index).toBeNull()
    expect(geo.drawRange).toEqual({ start: 0, count: Infinity })
    expect(geo.boundingBox).toBeNull()
    expect(geo.boundingSphere).toBeNull()
    expect(geo.groups).toEqual([])
    expect(geo.morphAttributes.size).toBe(0)
  })

  it('assigns unique incrementing ids', () => {
    const a = new BufferGeometry()
    const b = new BufferGeometry()
    expect(b.id).toBe(a.id + 1)
  })

  it('setIndex chooses Uint16 for small indices and Uint32 for large', () => {
    const small = new BufferGeometry().setIndex([0, 1, 2])
    expect(small.index!.data).toBeInstanceOf(Uint16Array)
    expect(small.index!.itemSize).toBe(1)
    expect(small.index!.count).toBe(3)

    const large = new BufferGeometry().setIndex([0, 1, 70000])
    expect(large.index!.data).toBeInstanceOf(Uint32Array)
  })

  it('addGroup and clearGroups manage draw groups', () => {
    const geo = new BufferGeometry()
    geo.addGroup(0, 3, 0)
    geo.addGroup(3, 6, 1)
    expect(geo.groups).toHaveLength(2)
    expect(geo.groups[1]).toEqual({ start: 3, count: 6, materialIndex: 1 })
    geo.clearGroups()
    expect(geo.groups).toHaveLength(0)
  })

  it('computeBoundingBox finds the min/max extents', () => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array([-1, -2, -3, 4, 5, 6, 0, 0, 0]), 3))
    geo.computeBoundingBox()
    expect(geo.boundingBox!.min).toEqual(new Vec3(-1, -2, -3))
    expect(geo.boundingBox!.max).toEqual(new Vec3(4, 5, 6))
  })

  it('computeBoundingBox falls back to origin when no position exists', () => {
    const geo = new BufferGeometry()
    geo.computeBoundingBox()
    expect(geo.boundingBox!.min).toEqual(new Vec3(0, 0, 0))
    expect(geo.boundingBox!.max).toEqual(new Vec3(0, 0, 0))
  })

  it('computeBoundingSphere centers the box and measures max radius', () => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array([-2, 0, 0, 2, 0, 0, 0, 2, 0, 0, -2, 0]), 3))
    geo.computeBoundingSphere()
    expect(geo.boundingSphere!.center).toEqual(new Vec3(0, 0, 0))
    expect(geo.boundingSphere!.radius).toBeCloseTo(2)
  })

  it('computeVertexNormals produces unit-length face normals (non-indexed)', () => {
    const geo = new BufferGeometry()
    // Single triangle in the XY plane -> normal along +Z
    geo.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3))
    geo.computeVertexNormals()
    const n = geo.getAttribute('normal')!
    expect(n.count).toBe(3)
    for (let i = 0; i < n.count; i++) {
      const len = Math.hypot(n.getX(i), n.getY(i), n.getZ(i))
      expect(len).toBeCloseTo(1)
      expect(n.getZ(i)).toBeCloseTo(1)
    }
  })

  it('computeVertexNormals averages shared vertices for indexed geometry', () => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), 3))
    geo.setIndex([0, 1, 2, 2, 1, 3])
    geo.computeVertexNormals()
    const n = geo.getAttribute('normal')!
    expect(n.count).toBe(4)
    for (let i = 0; i < n.count; i++) {
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1)
    }
  })

  it('clone deep-copies attributes, index, groups and bounds independently', () => {
    const geo = new BufferGeometry()
    geo.name = 'orig'
    geo.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 1]), 3))
    geo.setIndex([0, 1])
    geo.addGroup(0, 2, 0)
    geo.computeBoundingBox()
    geo.computeBoundingSphere()

    const copy = geo.clone()
    expect(copy.name).toBe('orig')
    expect(copy.getAttribute('position')).not.toBe(geo.getAttribute('position'))
    expect(copy.index).not.toBe(geo.index)
    expect(copy.groups).toEqual(geo.groups)
    expect(copy.groups).not.toBe(geo.groups)
    expect(copy.boundingBox!.min).toEqual(geo.boundingBox!.min)

    // Mutating the clone must not affect the original
    copy.getAttribute('position')!.setX(0, 42)
    expect(geo.getAttribute('position')!.getX(0)).toBe(0)
  })

  it('clones morph attributes deeply', () => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(3), 3))
    geo.morphAttributes.set('position', [new BufferAttribute(new Float32Array([1, 2, 3]), 3)])
    const copy = geo.clone()
    expect(copy.morphAttributes.get('position')).toHaveLength(1)
    expect(copy.morphAttributes.get('position')![0]).not.toBe(geo.morphAttributes.get('position')![0])
  })
})
