import { describe, it, expect } from 'vitest'
import { SkySystem } from '../effects'
import { Scene } from '../scene'
import { Vec3 } from '../math'

function len(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

describe('SkySystem — construction & defaults', () => {
  it('applies default options', () => {
    const sky = new SkySystem(new Scene())
    expect(sky.options.turbidity).toBe(2)
    expect(sky.options.rayleigh).toBe(1)
    expect(sky.options.mieCoefficient).toBe(0.005)
    expect(sky.options.mieDirectionalG).toBe(0.8)
    expect(sky.options.starCount).toBe(2000)
    expect(sky.options.moonEnabled).toBe(true)
    expect(sky.options.starsEnabled).toBe(true)
  })

  it('adds a sky mesh and a star mesh to the scene when stars are enabled', () => {
    const scene = new Scene()
    new SkySystem(scene)
    expect(scene.children.length).toBe(2)
  })

  it('adds only the sky mesh when stars are disabled', () => {
    const scene = new Scene()
    new SkySystem(scene, { starsEnabled: false })
    expect(scene.children.length).toBe(1)
  })

  it('normalises the initial sun direction', () => {
    const sky = new SkySystem(new Scene(), { sunPosition: new Vec3(1, 1, 1) })
    const dir = sky.getSunDirection()
    expect(len(dir)).toBeCloseTo(1)
    expect(dir.x).toBeCloseTo(1 / Math.sqrt(3))
  })

  it('getSunDirection returns a fresh clone each call', () => {
    const sky = new SkySystem(new Scene())
    const a = sky.getSunDirection()
    const b = sky.getSunDirection()
    expect(a).not.toBe(b)
    expect(a.x).toBeCloseTo(b.x)
  })
})

describe('SkySystem — update / day-night cycle', () => {
  it('places the sun above the horizon at noon (0.5) with unit length', () => {
    const sky = new SkySystem(new Scene())
    sky.update(0.5)
    const dir = sky.getSunDirection()
    expect(dir.y).toBeGreaterThan(0)
    expect(len(dir)).toBeCloseTo(1)
  })

  it('places the sun below the horizon at midnight (0.0)', () => {
    const sky = new SkySystem(new Scene())
    sky.update(0.0)
    const dir = sky.getSunDirection()
    expect(dir.y).toBeLessThan(0)
  })
})

describe('SkySystem — colours', () => {
  it('returns black sun colour when sun is below horizon', () => {
    const sky = new SkySystem(new Scene())
    sky.update(0.0) // midnight -> below horizon
    const c = sky.getSunColor()
    expect(c.x).toBe(0)
    expect(c.y).toBe(0)
    expect(c.z).toBe(0)
  })

  it('returns white sun colour at high sun elevation', () => {
    const sky = new SkySystem(new Scene())
    sky.update(0.5) // noon -> high elevation, t clamps to 1
    const c = sky.getSunColor()
    expect(c.x).toBeCloseTo(1)
    expect(c.y).toBeCloseTo(1)
    expect(c.z).toBeCloseTo(1)
  })

  it('returns deep-blue night ambient when sun is below horizon', () => {
    const sky = new SkySystem(new Scene())
    sky.update(0.0)
    const c = sky.getAmbientColor()
    expect(c.x).toBeCloseTo(0.02)
    expect(c.y).toBeCloseTo(0.02)
    expect(c.z).toBeCloseTo(0.05)
  })
})

describe('SkySystem — dispose', () => {
  it('removes its meshes from the scene', () => {
    const scene = new Scene()
    const sky = new SkySystem(scene)
    expect(scene.children.length).toBe(2)
    sky.dispose()
    expect(scene.children.length).toBe(0)
  })
})
