import { describe, it, expect } from 'vitest'
import { InstancedMesh } from '../objects'
import { BoxGeometry } from '../geometry'
import { MeshStandardMaterial } from '../material'
import { Vec3, Mat4, Quat } from '../math'

function make(count = 4) {
  return new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial(), count)
}

describe('InstancedMesh', () => {
  it('initialises every instance to identity', () => {
    const im = make(3)
    const m = new Mat4()
    im.getMatrixAt(0, m)
    expect(m.elements[0]).toBe(1)
    expect(m.elements[5]).toBe(1)
    expect(m.elements[10]).toBe(1)
    expect(m.elements[15]).toBe(1)
    expect(im.count).toBe(3)
    expect(im.capacity).toBe(3)
    expect(im.isInstancedMesh).toBe(true)
  })

  it('setMatrixAt stores data and bumps the buffer version', () => {
    const im = make()
    const before = im.instanceMatrix.version
    const m = new Mat4().compose(new Vec3(5, 6, 7), new Quat(), new Vec3(1, 1, 1))
    im.setMatrixAt(2, m)
    expect(im.instanceMatrix.version).toBeGreaterThan(before)
    const out = new Mat4()
    im.getMatrixAt(2, out)
    expect(out.elements[12]).toBe(5)
    expect(out.elements[13]).toBe(6)
    expect(out.elements[14]).toBe(7)
  })

  it('setPositionAt only changes translation and marks dirty', () => {
    const im = make()
    const v0 = im.instanceMatrix.version
    im.setPositionAt(1, 9, 8, 7)
    const out = new Mat4()
    im.getMatrixAt(1, out)
    expect(out.elements[12]).toBe(9)
    expect(out.elements[13]).toBe(8)
    expect(out.elements[14]).toBe(7)
    // rotation/scale still identity
    expect(out.elements[0]).toBe(1)
    expect(im.instanceMatrix.version).toBeGreaterThan(v0)
  })

  it('setTransformAt composes position/quat/scale', () => {
    const im = make()
    im.setTransformAt(0, new Vec3(1, 2, 3), new Quat(), new Vec3(2, 2, 2))
    const out = new Mat4()
    im.getMatrixAt(0, out)
    expect(out.elements[0]).toBe(2) // scaled x axis
    expect(out.elements[12]).toBe(1)
    expect(out.elements[14]).toBe(3)
  })

  it('setColorAt lazily allocates color buffer and defaults to white', () => {
    const im = make()
    expect(im.instanceColor).toBeNull()
    const c = new Vec3()
    im.getColorAt(0, c)
    expect(c.toArray()).toEqual([1, 1, 1])
    im.setColorAt(1, new Vec3(1, 0, 0))
    expect(im.instanceColor).not.toBeNull()
    im.getColorAt(1, c)
    expect(c.toArray()).toEqual([1, 0, 0])
    // unset instances remain white
    im.getColorAt(0, c)
    expect(c.toArray()).toEqual([1, 1, 1])
  })

  it('throws on out-of-range index', () => {
    const im = make(2)
    expect(() => im.setMatrixAt(2, new Mat4())).toThrow(RangeError)
    expect(() => im.setPositionAt(-1, 0, 0, 0)).toThrow(RangeError)
  })

  it('setCount clamps to [0, capacity]', () => {
    const im = make(5)
    expect(im.setCount(3).count).toBe(3)
    expect(im.setCount(99).count).toBe(5)
    expect(im.setCount(-4).count).toBe(0)
  })

  it('resize grows capacity, preserves data, and identity-fills new slots', () => {
    const im = make(2)
    im.setPositionAt(0, 1, 1, 1)
    im.resize(5)
    expect(im.capacity).toBe(5)
    const out = new Mat4()
    im.getMatrixAt(0, out)
    expect(out.elements[12]).toBe(1) // preserved
    im.getMatrixAt(4, out)
    expect(out.elements[0]).toBe(1) // new slot identity
    expect(out.elements[15]).toBe(1)
    // resize downward is a no-op
    im.resize(1)
    expect(im.capacity).toBe(5)
  })

  it('resize preserves and extends the color buffer when present', () => {
    const im = make(2)
    im.setColorAt(0, new Vec3(0.2, 0.4, 0.6))
    im.resize(4)
    const c = new Vec3()
    im.getColorAt(0, c)
    expect(c.x).toBeCloseTo(0.2)
    im.getColorAt(3, c)
    expect(c.toArray()).toEqual([1, 1, 1]) // new slots white
  })

  it('computeBoundingSphere covers all instance translations', () => {
    const im = make(2)
    im.setPositionAt(0, -10, 0, 0)
    im.setPositionAt(1, 10, 0, 0)
    im.computeBoundingSphere()
    const bs = im.boundingSphere!
    expect(bs).not.toBeNull()
    expect(bs.center.x).toBeCloseTo(0)
    // radius must reach each instance plus the box's own extent
    expect(bs.radius).toBeGreaterThanOrEqual(10)
  })

  it('computeBoundingSphere with zero count yields empty sphere', () => {
    const im = make(3)
    im.setCount(0)
    im.computeBoundingSphere()
    expect(im.boundingSphere!.radius).toBe(0)
  })
})
