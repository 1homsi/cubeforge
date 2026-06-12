// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import React from 'react'
import { GameLoop } from '@cubeforge/core'
import {
  AmbientLight,
  DirectionalLight,
  PointLight,
  PerspectiveCamera,
  Scene,
  SpotLight,
  type WebGLRenderer3D,
} from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext, type Engine3DState } from '../context3d'
import { AmbientLight3D } from '../components/AmbientLight3D'
import { Camera3D } from '../components/Camera3D'
import { DirectionalLight3D } from '../components/DirectionalLight3D'
import { PointLight3D } from '../components/PointLight3D'
import { SpotLight3D } from '../components/SpotLight3D'
import { Weather3D } from '../components/Weather3D'

function makeEngine(scene: Scene): Engine3DState {
  return {
    renderer: {
      render: vi.fn(),
      dispose: vi.fn(),
    } as unknown as WebGLRenderer3D,
    scene,
    camera: new PerspectiveCamera(),
    loop: new GameLoop(() => {}),
    canvas: document.createElement('canvas'),
    time: 0,
    _frameListeners: new Set(),
  }
}

function Wrapper({ scene, children }: { scene: Scene; children: React.ReactNode }) {
  return (
    <Engine3DContext.Provider value={makeEngine(scene)}>
      <ParentObject3DContext.Provider value={scene}>{children}</ParentObject3DContext.Provider>
    </Engine3DContext.Provider>
  )
}

function ControlledWrapper({
  engine,
  scene,
  children,
}: {
  engine: Engine3DState
  scene: Scene
  children: React.ReactNode
}) {
  return (
    <Engine3DContext.Provider value={engine}>
      <ParentObject3DContext.Provider value={scene}>{children}</ParentObject3DContext.Provider>
    </Engine3DContext.Provider>
  )
}

function childOfType<T>(scene: Scene, ctor: new (...args: never[]) => T): T {
  const found = scene.children.find((child) => child instanceof ctor)
  expect(found).toBeDefined()
  return found as T
}

describe('3D light components', () => {
  it('live-syncs AmbientLight color and intensity', async () => {
    const scene = new Scene()
    const result = render(
      <Wrapper scene={scene}>
        <AmbientLight3D color={[1, 0, 0]} intensity={0.5} />
      </Wrapper>,
    )

    const light = childOfType(scene, AmbientLight)
    expect(light.color.x).toBe(1)
    expect(light.intensity).toBe(0.5)

    await act(async () => {
      result.rerender(
        <Wrapper scene={scene}>
          <AmbientLight3D color={[0, 0.25, 1]} intensity={1.75} />
        </Wrapper>,
      )
    })

    expect(scene.children).toContain(light)
    expect(light.color.x).toBe(0)
    expect(light.color.y).toBe(0.25)
    expect(light.color.z).toBe(1)
    expect(light.intensity).toBe(1.75)
  })

  it('live-syncs DirectionalLight color, position, shadow flag, and map size', async () => {
    const scene = new Scene()
    const result = render(
      <Wrapper scene={scene}>
        <DirectionalLight3D color={[1, 1, 1]} intensity={1} position={[1, 2, 3]} />
      </Wrapper>,
    )

    const light = childOfType(scene, DirectionalLight)
    expect(light.position.x).toBe(1)
    expect(light.castShadow).toBe(false)

    await act(async () => {
      result.rerender(
        <Wrapper scene={scene}>
          <DirectionalLight3D
            color={[0.2, 0.4, 0.6]}
            intensity={2}
            position={[4, 5, 6]}
            castShadow
            shadowMapSize={2048}
          />
        </Wrapper>,
      )
    })

    expect(scene.children).toContain(light)
    expect(light.color.x).toBe(0.2)
    expect(light.color.y).toBe(0.4)
    expect(light.color.z).toBe(0.6)
    expect(light.intensity).toBe(2)
    expect(light.position.x).toBe(4)
    expect(light.position.y).toBe(5)
    expect(light.position.z).toBe(6)
    expect(light.castShadow).toBe(true)
    expect(light.shadow.mapSize).toEqual({ width: 2048, height: 2048 })
  })

  it('live-syncs PointLight attenuation and transform props', async () => {
    const scene = new Scene()
    const result = render(
      <Wrapper scene={scene}>
        <PointLight3D color={[1, 0, 0]} intensity={1} position={[0, 0, 0]} distance={5} decay={1} />
      </Wrapper>,
    )

    const light = childOfType(scene, PointLight)

    await act(async () => {
      result.rerender(
        <Wrapper scene={scene}>
          <PointLight3D color={[0, 1, 0]} intensity={3} position={[7, 8, 9]} distance={25} decay={2.5} />
        </Wrapper>,
      )
    })

    expect(scene.children).toContain(light)
    expect(light.color.y).toBe(1)
    expect(light.intensity).toBe(3)
    expect(light.position.x).toBe(7)
    expect(light.position.y).toBe(8)
    expect(light.position.z).toBe(9)
    expect(light.distance).toBe(25)
    expect(light.decay).toBe(2.5)
  })

  it('live-syncs SpotLight cone, target, and shadow props', async () => {
    const scene = new Scene()
    const result = render(
      <Wrapper scene={scene}>
        <SpotLight3D position={[0, 1, 2]} target={[0, 0, 0]} />
      </Wrapper>,
    )

    const light = childOfType(scene, SpotLight)
    expect(scene.children).toContain(light.target)

    await act(async () => {
      result.rerender(
        <Wrapper scene={scene}>
          <SpotLight3D
            color={[0.8, 0.7, 0.6]}
            intensity={4}
            position={[3, 4, 5]}
            target={[6, 7, 8]}
            angle={0.2}
            penumbra={0.3}
            distance={40}
            decay={1.5}
            castShadow
          />
        </Wrapper>,
      )
    })

    expect(scene.children).toContain(light)
    expect(scene.children).toContain(light.target)
    expect(light.color.x).toBe(0.8)
    expect(light.color.y).toBe(0.7)
    expect(light.color.z).toBe(0.6)
    expect(light.intensity).toBe(4)
    expect(light.position.x).toBe(3)
    expect(light.position.y).toBe(4)
    expect(light.position.z).toBe(5)
    expect(light.target.position.x).toBe(6)
    expect(light.target.position.y).toBe(7)
    expect(light.target.position.z).toBe(8)
    expect(light.angle).toBe(0.2)
    expect(light.penumbra).toBe(0.3)
    expect(light.distance).toBe(40)
    expect(light.decay).toBe(1.5)
    expect(light.castShadow).toBe(true)
  })
})

describe('3D lifecycle components', () => {
  it('switches Camera3D in and out as the active render camera', async () => {
    const scene = new Scene()
    const engine = makeEngine(scene)
    const defaultCamera = engine.camera
    const result = render(
      <ControlledWrapper engine={engine} scene={scene}>
        <Camera3D active={false} position={[1, 2, 3]} />
      </ControlledWrapper>,
    )

    const componentCamera = childOfType(scene, PerspectiveCamera)
    expect(engine.camera).toBe(defaultCamera)
    expect(componentCamera.position.x).toBe(1)

    await act(async () => {
      result.rerender(
        <ControlledWrapper engine={engine} scene={scene}>
          <Camera3D active fov={75} near={0.5} far={500} position={[4, 5, 6]} />
        </ControlledWrapper>,
      )
    })

    expect(engine.camera).toBe(componentCamera)
    expect(componentCamera.fov).toBe(75)
    expect(componentCamera.near).toBe(0.5)
    expect(componentCamera.far).toBe(500)
    expect(componentCamera.position.x).toBe(4)
    expect(componentCamera.position.y).toBe(5)
    expect(componentCamera.position.z).toBe(6)

    await act(async () => {
      result.rerender(
        <ControlledWrapper engine={engine} scene={scene}>
          <Camera3D active={false} />
        </ControlledWrapper>,
      )
    })

    expect(engine.camera).toBe(defaultCamera)
    expect(scene.children).toContain(componentCamera)
  })

  it('disposes Weather3D scene objects and fog on unmount', async () => {
    const scene = new Scene()
    const engine = makeEngine(scene)
    const result = render(
      <ControlledWrapper engine={engine} scene={scene}>
        <Weather3D type="storm" particleCount={8} />
      </ControlledWrapper>,
    )

    expect(scene.children.length).toBe(1)
    expect(scene.fog).not.toBeNull()
    expect(engine._frameListeners.size).toBe(1)

    await act(async () => {
      result.unmount()
    })

    expect(scene.children.length).toBe(0)
    expect(scene.fog).toBeNull()
    expect(engine._frameListeners.size).toBe(0)
  })
})
