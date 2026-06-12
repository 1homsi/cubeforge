import { describe, expect, it, vi } from 'vitest'
import { ECSWorld } from '@cubeforge/core'

import {
  AnimationMixer,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Mat4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  RenderSystem3D,
  Scene,
  Vec3,
  createTransform3D,
} from '../index'
import type { Camera3DComponent, WebGLRenderer3D } from '../index'

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

  it('uses active ECS Camera3D components as the render camera', () => {
    const world = new ECSWorld()
    const scene = new Scene()
    const defaultCamera = new PerspectiveCamera(60, 1, 0.1, 1000)
    const render = vi.fn()
    const system = new RenderSystem3D({
      renderer: { render } as unknown as WebGLRenderer3D,
      scene,
      camera: defaultCamera,
    })

    const cameraEntity = world.createEntity()
    world.addComponent(cameraEntity, createTransform3D(1, 2, 3))
    world.addComponent<Camera3DComponent>(cameraEntity, {
      type: 'Camera3D',
      fov: 75,
      near: 0.5,
      far: 500,
      isActive: true,
    })

    system.update(world, 1 / 60)

    const activeCamera = render.mock.calls.at(-1)?.[1]
    expect(activeCamera).toBeInstanceOf(PerspectiveCamera)
    expect(activeCamera).not.toBe(defaultCamera)
    expect(activeCamera.fov).toBe(75)
    expect(activeCamera.near).toBe(0.5)
    expect(activeCamera.far).toBe(500)
    expectVec3(activeCamera.position, 1, 2, 3)
    expect(scene.children).toContain(activeCamera)

    const cameraComp = world.getComponent<Camera3DComponent>(cameraEntity, 'Camera3D')!
    cameraComp.isActive = false

    system.update(world, 1 / 60)

    expect(render.mock.calls.at(-1)?.[1]).toBe(defaultCamera)
  })
})
