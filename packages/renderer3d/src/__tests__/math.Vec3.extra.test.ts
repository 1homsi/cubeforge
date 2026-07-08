import { describe, it, expect } from 'vitest'
import { Vec3, Vec4, Mat4, Quat } from '../math'

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps

describe('Vec3 allocation-free / extra ops', () => {
  it('copy and setScalar', () => {
    const a = new Vec3().copy(new Vec3(1, 2, 3))
    expect(a.toArray()).toEqual([1, 2, 3])
    expect(new Vec3().setScalar(5).toArray()).toEqual([5, 5, 5])
  })

  it('addVectors / subVectors write into this without mutating inputs', () => {
    const a = new Vec3(1, 2, 3)
    const b = new Vec3(4, 5, 6)
    const out = new Vec3().addVectors(a, b)
    expect(out.toArray()).toEqual([5, 7, 9])
    expect(a.toArray()).toEqual([1, 2, 3])
    expect(new Vec3().subVectors(b, a).toArray()).toEqual([3, 3, 3])
  })

  it('addScaledVector accumulates v*s (integrator core)', () => {
    const p = new Vec3(0, 0, 0)
    const v = new Vec3(1, 0, -2)
    p.addScaledVector(v, 0.5)
    expect(p.toArray()).toEqual([0.5, 0, -1])
  })

  it('crossVectors matches right-hand rule', () => {
    const out = new Vec3().crossVectors(new Vec3(1, 0, 0), new Vec3(0, 1, 0))
    expect(out.toArray()).toEqual([0, 0, 1])
  })

  it('multiplyScalar / divideScalar with zero guard', () => {
    expect(new Vec3(2, 4, 6).multiplyScalar(0.5).toArray()).toEqual([1, 2, 3])
    expect(new Vec3(2, 4, 6).divideScalar(2).toArray()).toEqual([1, 2, 3])
    expect(new Vec3(2, 4, 6).divideScalar(0).toArray()).toEqual([0, 0, 0])
  })

  it('lerpVectors interpolates endpoints', () => {
    const out = new Vec3().lerpVectors(new Vec3(0, 0, 0), new Vec3(10, 20, 30), 0.25)
    expect(out.toArray()).toEqual([2.5, 5, 7.5])
  })

  it('min / max / clamp / clampScalar', () => {
    expect(new Vec3(1, 5, 3).min(new Vec3(2, 2, 2)).toArray()).toEqual([1, 2, 2])
    expect(new Vec3(1, 5, 3).max(new Vec3(2, 2, 2)).toArray()).toEqual([2, 5, 3])
    expect(new Vec3(-5, 0, 5).clamp(new Vec3(-1, -1, -1), new Vec3(1, 1, 1)).toArray()).toEqual([-1, 0, 1])
    expect(new Vec3(-5, 0, 5).clampScalar(-1, 1).toArray()).toEqual([-1, 0, 1])
  })

  it('clampLength bounds magnitude but keeps direction', () => {
    const v = new Vec3(3, 4, 0) // length 5
    v.clampLength(0, 1)
    expect(near(v.length(), 1)).toBe(true)
    expect(near(v.x, 0.6)).toBe(true)
    expect(near(v.y, 0.8)).toBe(true)
    const w = new Vec3(0.3, 0, 0).clampLength(1, 10)
    expect(near(w.length(), 1)).toBe(true)
  })

  it('setLength', () => {
    const v = new Vec3(0, 3, 0).setLength(10)
    expect(v.toArray()).toEqual([0, 10, 0])
  })

  it('floor / ceil / round / abs', () => {
    expect(new Vec3(1.7, -1.2, 2.5).floor().toArray()).toEqual([1, -2, 2])
    expect(new Vec3(1.2, -1.7, 2.1).ceil().toArray()).toEqual([2, -1, 3])
    expect(new Vec3(1.4, -1.6, 2.5).round().toArray()).toEqual([1, -2, 3])
    expect(new Vec3(-1, -2, 3).abs().toArray()).toEqual([1, 2, 3])
  })

  it('manhattanLength', () => {
    expect(new Vec3(1, -2, 3).manhattanLength()).toBe(6)
  })

  it('angleTo is symmetric and clamped', () => {
    const a = new Vec3(1, 0, 0)
    const b = new Vec3(0, 1, 0)
    expect(near(a.angleTo(b), Math.PI / 2)).toBe(true)
    expect(near(a.angleTo(a.clone()), 0)).toBe(true)
    expect(near(a.angleTo(new Vec3(-1, 0, 0)), Math.PI)).toBe(true)
  })

  it('setFromMatrixPosition / setFromMatrixScale', () => {
    const m = new Mat4().compose(new Vec3(7, 8, 9), new Quat(), new Vec3(2, 3, 4))
    expect(new Vec3().setFromMatrixPosition(m).toArray()).toEqual([7, 8, 9])
    const s = new Vec3().setFromMatrixScale(m)
    expect(near(s.x, 2)).toBe(true)
    expect(near(s.y, 3)).toBe(true)
    expect(near(s.z, 4)).toBe(true)
  })

  it('setFromSphericalCoords round-trips radius', () => {
    const v = new Vec3().setFromSphericalCoords(5, Math.PI / 2, 0)
    expect(near(v.length(), 5)).toBe(true)
  })

  it('applyAxisAngle rotates about Y by 90deg', () => {
    const v = new Vec3(1, 0, 0).applyAxisAngle(new Vec3(0, 1, 0), Math.PI / 2)
    expect(near(v.x, 0)).toBe(true)
    expect(near(v.z, -1)).toBe(true)
  })

  it('applyAxisAngle agrees with applyQuat', () => {
    const axis = new Vec3(0.3, 0.7, -0.2).normalize()
    const angle = 1.1
    const a = new Vec3(2, -1, 0.5).applyAxisAngle(axis, angle)
    const q = new Quat().setFromAxisAngle(axis, angle)
    const b = new Vec3(2, -1, 0.5).applyQuat(q)
    expect(near(a.x, b.x)).toBe(true)
    expect(near(a.y, b.y)).toBe(true)
    expect(near(a.z, b.z)).toBe(true)
  })

  it('isZero honours epsilon', () => {
    expect(new Vec3(0, 0, 0).isZero()).toBe(true)
    expect(new Vec3(1e-9, 0, 0).isZero(1e-6)).toBe(true)
    expect(new Vec3(0.1, 0, 0).isZero(1e-6)).toBe(false)
  })
})

describe('Vec4 extra ops', () => {
  it('copy / setScalar / negate', () => {
    expect(new Vec4().copy(new Vec4(1, 2, 3, 4)).toArray()).toEqual([1, 2, 3, 4])
    expect(new Vec4().setScalar(2).toArray()).toEqual([2, 2, 2, 2])
    expect(new Vec4(1, -2, 3, -4).negate().toArray()).toEqual([-1, 2, -3, 4])
  })

  it('addVectors / subVectors / addScaledVector', () => {
    expect(new Vec4().addVectors(new Vec4(1, 1, 1, 1), new Vec4(2, 3, 4, 5)).toArray()).toEqual([3, 4, 5, 6])
    expect(new Vec4().subVectors(new Vec4(5, 5, 5, 5), new Vec4(1, 2, 3, 4)).toArray()).toEqual([4, 3, 2, 1])
    expect(new Vec4(0, 0, 0, 0).addScaledVector(new Vec4(1, 2, 3, 4), 2).toArray()).toEqual([2, 4, 6, 8])
  })

  it('multiplyScalar / divideScalar / manhattanLength / lerpVectors / equals', () => {
    expect(new Vec4(2, 4, 6, 8).multiplyScalar(0.5).toArray()).toEqual([1, 2, 3, 4])
    expect(new Vec4(2, 4, 6, 8).divideScalar(0).toArray()).toEqual([0, 0, 0, 0])
    expect(new Vec4(1, -2, 3, -4).manhattanLength()).toBe(10)
    expect(new Vec4().lerpVectors(new Vec4(0, 0, 0, 0), new Vec4(4, 4, 4, 4), 0.5).toArray()).toEqual([2, 2, 2, 2])
    expect(new Vec4(1, 2, 3, 4).equals(new Vec4(1, 2, 3, 4))).toBe(true)
    expect(new Vec4(1, 2, 3, 4).equals(new Vec4(1, 2, 3, 5))).toBe(false)
  })
})

describe('Quat.copy', () => {
  it('copies all four components', () => {
    const q = new Quat().copy(new Quat(0.1, 0.2, 0.3, 0.4))
    expect(q.toArray()).toEqual([0.1, 0.2, 0.3, 0.4])
  })
})
