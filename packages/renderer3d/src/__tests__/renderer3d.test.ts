import { describe, expect, it } from 'vitest'

import {
  AnimationMixer,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Mat4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Raycaster,
  Vec3,
} from '../index'

function expectVec3(vec: Vec3, x: number, y: number, z: number, precision = 5): void {
  expect(vec.x).toBeCloseTo(x, precision)
  expect(vec.y).toBeCloseTo(y, precision)
  expect(vec.z).toBeCloseTo(z, precision)
}

describe('@cubeforge/renderer3d', () => {
  it('applies composed matrix transforms to points', () => {
    const transform = new Mat4().makeTranslation(10, 0, 0).multiply(new Mat4().makeRotationZ(Math.PI / 2))
    const point = new Vec3(2, 0, 0).applyMat4(transform)

    expectVec3(point, 10, 2, 0)
  })

  it('computes stable bounds for generated box geometry', () => {
    const geometry = new BoxGeometry(2, 4, 6, 2, 1, 3)

    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()

    expect(geometry.getAttribute('position')?.count).toBe(52)
    expect(geometry.index?.count).toBe(132)
    expect(geometry.groups).toHaveLength(6)
    expectVec3(geometry.boundingBox!.min, -1, -2, -3)
    expectVec3(geometry.boundingBox!.max, 1, 2, 3)
    expectVec3(geometry.boundingSphere!.center, 0, 0, 0)
    expect(geometry.boundingSphere!.radius).toBeCloseTo(Math.sqrt(14))
  })

  it('raycasts indexed meshes and reports world-space hit distance', () => {
    const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial())
    const raycaster = new Raycaster(new Vec3(0, 0, 5), new Vec3(0, 0, -1))

    const hits = raycaster.intersectObject(mesh, false)

    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]!.distance).toBeCloseTo(4)
    expectVec3(hits[0]!.point, 0, 0, 1)
    expect(hits[0]!.face).not.toBeNull()
  })

  it('recomputes morph target animation weights without accumulating stale frames', () => {
    const root = new Object3D()
    const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
    const mesh = new Mesh(geometry, new MeshBasicMaterial())
    mesh.name = 'morphing-mesh'
    mesh.morphTargetInfluences = [0, 0, 0, 0]
    root.add(mesh)

    const mixer = new AnimationMixer(root)
    const action = mixer
      .clipAction({
        name: 'morph',
        duration: 1,
        tracks: [
          {
            nodeName: 'morphing-mesh',
            nodeIndex: 0,
            property: 'morphTargetInfluences',
            times: new Float32Array([0, 1]),
            values: new Float32Array([0, 0, 0, 0, 1, 0.5, 0.25, 0.125]),
            interpolation: 'LINEAR',
          },
        ],
      })
      .play()

    mixer.update(0.5)
    expect(mesh.morphTargetInfluences).toEqual([0.5, 0.25, 0.125, 0.0625])

    mixer.update(0)
    expect(mesh.morphTargetInfluences).toEqual([0.5, 0.25, 0.125, 0.0625])

    action.stop()
  })
})
