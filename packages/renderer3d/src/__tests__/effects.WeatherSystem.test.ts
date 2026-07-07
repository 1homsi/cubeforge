import { describe, it, expect } from 'vitest'
import { WeatherSystem } from '../effects'
import { Scene } from '../scene'
import { PerspectiveCamera } from '../scene'
import { InstancedMesh } from '../objects'

function makeCamera(): PerspectiveCamera {
  const cam = new PerspectiveCamera(60, 1, 0.1, 1000)
  cam.position.set(0, 0, 0)
  return cam
}

describe('WeatherSystem — initial state', () => {
  it('starts clear with no fog', () => {
    const scene = new Scene()
    const w = new WeatherSystem(scene)
    expect(w.weatherType).toBe('clear')
    expect(scene.fog).toBeNull()
  })
})

describe('WeatherSystem — setWeather', () => {
  it('applies fog with default near/far/colour', () => {
    const scene = new Scene()
    const w = new WeatherSystem(scene)
    w.setWeather('fog')
    expect(w.weatherType).toBe('fog')
    expect(scene.fog).not.toBeNull()
    expect(scene.fog!.near).toBe(10)
    expect(scene.fog!.far).toBe(100)
    expect(scene.fog!.color.x).toBeCloseTo(0.8)
    expect(scene.fog!.color.z).toBeCloseTo(0.85)
  })

  it('applies custom fog options', () => {
    const scene = new Scene()
    const w = new WeatherSystem(scene, { fogNear: 3, fogFar: 42 })
    w.setWeather('fog')
    expect(scene.fog!.near).toBe(3)
    expect(scene.fog!.far).toBe(42)
  })

  it('creates an InstancedMesh and clears fog for rain', () => {
    const scene = new Scene()
    const w = new WeatherSystem(scene)
    w.setWeather('rain')
    expect(w.weatherType).toBe('rain')
    expect(scene.fog).toBeNull()
    expect(scene.children.some((c) => c instanceof InstancedMesh)).toBe(true)
  })

  it('adds storm fog (dark) alongside particles', () => {
    const scene = new Scene()
    const w = new WeatherSystem(scene)
    w.setWeather('storm')
    expect(w.weatherType).toBe('storm')
    expect(scene.fog).not.toBeNull()
    expect(scene.fog!.near).toBe(5)
    expect(scene.fog!.far).toBe(40)
    expect(scene.fog!.color.x).toBeCloseTo(0.6)
    expect(scene.children.some((c) => c instanceof InstancedMesh)).toBe(true)
  })

  it('returns to clear removes mesh and fog', () => {
    const scene = new Scene()
    const w = new WeatherSystem(scene)
    w.setWeather('rain')
    w.setWeather('clear')
    expect(w.weatherType).toBe('clear')
    expect(scene.fog).toBeNull()
    expect(scene.children.some((c) => c instanceof InstancedMesh)).toBe(false)
  })
})

describe('WeatherSystem — transitions', () => {
  it('interpolates fog part-way during a timed transition, then snaps to target', () => {
    const scene = new Scene()
    const w = new WeatherSystem(scene)
    const cam = makeCamera()

    // Start a 1s transition to fog. Baseline snapshot is near=far=1000.
    w.setWeather('fog', 1)
    expect(w.weatherType).toBe('clear') // not applied yet

    // Halfway: near lerps 1000 -> 10, far 1000 -> 100.
    w.update(cam, 0.5)
    expect(scene.fog).not.toBeNull()
    expect(scene.fog!.near).toBeCloseTo(1000 + (10 - 1000) * 0.5)
    expect(scene.fog!.far).toBeCloseTo(1000 + (100 - 1000) * 0.5)

    // Finish the transition.
    w.update(cam, 0.6)
    expect(w.weatherType).toBe('fog')
    expect(scene.fog!.near).toBe(10)
    expect(scene.fog!.far).toBe(100)
  })
})

describe('WeatherSystem — update particles', () => {
  it('bumps the instance matrix version after a rain frame', () => {
    // needsUpdate is a write-only setter that increments `version`.
    const scene = new Scene()
    const w = new WeatherSystem(scene)
    const cam = makeCamera()
    w.setWeather('rain')
    const mesh = scene.children.find((c) => c instanceof InstancedMesh) as InstancedMesh
    const before = mesh.instanceMatrix.version
    w.update(cam, 0.016)
    expect(mesh.instanceMatrix.version).toBeGreaterThan(before)
  })
})

describe('WeatherSystem — dispose', () => {
  it('removes the mesh and clears fog', () => {
    const scene = new Scene()
    const w = new WeatherSystem(scene)
    w.setWeather('storm')
    w.dispose()
    expect(scene.fog).toBeNull()
    expect(scene.children.some((c) => c instanceof InstancedMesh)).toBe(false)
  })
})
