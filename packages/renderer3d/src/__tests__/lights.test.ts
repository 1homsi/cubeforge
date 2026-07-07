import { describe, it, expect } from 'vitest'
import {
  Light,
  AmbientLight,
  DirectionalLight,
  DirectionalLightShadow,
  PointLight,
  SpotLight,
  LightShadow,
} from '../lights'
import { Vec3 } from '../math'

describe('Light (base)', () => {
  it('applies default color (white) and intensity', () => {
    const light = new Light()
    expect(light.color.x).toBe(1)
    expect(light.color.y).toBe(1)
    expect(light.color.z).toBe(1)
    expect(light.intensity).toBe(1)
  })

  it('stores custom color and intensity', () => {
    const color = new Vec3(0.2, 0.4, 0.6)
    const light = new Light(color, 3.5)
    expect(light.color).toBe(color)
    expect(light.color.x).toBeCloseTo(0.2)
    expect(light.color.y).toBeCloseTo(0.4)
    expect(light.color.z).toBeCloseTo(0.6)
    expect(light.intensity).toBe(3.5)
  })

  it('defaults castShadow to false and shadow to null', () => {
    const light = new Light()
    expect(light.castShadow).toBe(false)
    expect(light.shadow).toBeNull()
  })

  it('is an Object3D with a default position at origin', () => {
    const light = new Light()
    expect(light.position.x).toBe(0)
    expect(light.position.y).toBe(0)
    expect(light.position.z).toBe(0)
  })

  it('allows mutating intensity and color after construction', () => {
    const light = new Light()
    light.intensity = 10
    light.color.set(0.5, 0.5, 0.5)
    expect(light.intensity).toBe(10)
    expect(light.color.x).toBe(0.5)
  })
})

describe('AmbientLight', () => {
  it('uses default white color and intensity 1', () => {
    const light = new AmbientLight()
    expect(light.color.x).toBe(1)
    expect(light.color.y).toBe(1)
    expect(light.color.z).toBe(1)
    expect(light.intensity).toBe(1)
  })

  it('stores custom color and intensity', () => {
    const light = new AmbientLight(new Vec3(0.1, 0.2, 0.3), 0.25)
    expect(light.color.x).toBeCloseTo(0.1)
    expect(light.color.z).toBeCloseTo(0.3)
    expect(light.intensity).toBe(0.25)
  })

  it('is a Light instance', () => {
    expect(new AmbientLight()).toBeInstanceOf(Light)
  })
})

describe('DirectionalLight', () => {
  it('uses default color and intensity', () => {
    const light = new DirectionalLight()
    expect(light.color.x).toBe(1)
    expect(light.intensity).toBe(1)
  })

  it('creates a target Object3D at the origin', () => {
    const light = new DirectionalLight()
    expect(light.target).toBeDefined()
    expect(light.target.position.x).toBe(0)
    expect(light.target.position.y).toBe(0)
    expect(light.target.position.z).toBe(0)
  })

  it('creates a DirectionalLightShadow', () => {
    const light = new DirectionalLight()
    expect(light.shadow).toBeInstanceOf(DirectionalLightShadow)
  })

  it('stores custom color and intensity', () => {
    const light = new DirectionalLight(new Vec3(1, 0.9, 0.8), 2)
    expect(light.color.y).toBeCloseTo(0.9)
    expect(light.intensity).toBe(2)
  })

  it('allows repositioning the light and its target independently', () => {
    const light = new DirectionalLight()
    light.position.set(5, 10, 5)
    light.target.position.set(0, 0, -3)
    expect(light.position.y).toBe(10)
    expect(light.target.position.z).toBe(-3)
    // Independent objects
    expect(light.target).not.toBe(light)
  })
})

describe('PointLight', () => {
  it('uses default distance (0) and decay (2)', () => {
    const light = new PointLight()
    expect(light.distance).toBe(0)
    expect(light.decay).toBe(2)
    expect(light.intensity).toBe(1)
    expect(light.color.x).toBe(1)
  })

  it('stores custom distance and decay', () => {
    const light = new PointLight(new Vec3(1, 0, 0), 5, 100, 1)
    expect(light.color.x).toBe(1)
    expect(light.color.y).toBe(0)
    expect(light.intensity).toBe(5)
    expect(light.distance).toBe(100)
    expect(light.decay).toBe(1)
  })

  it('has a default position at origin (Object3D)', () => {
    const light = new PointLight()
    expect(light.position.x).toBe(0)
    expect(light.position.z).toBe(0)
  })

  it('is a Light instance', () => {
    expect(new PointLight()).toBeInstanceOf(Light)
  })
})

describe('SpotLight', () => {
  it('uses default angle (PI/4), penumbra (0), distance (0), decay (2)', () => {
    const light = new SpotLight()
    expect(light.angle).toBeCloseTo(Math.PI / 4)
    expect(light.penumbra).toBe(0)
    expect(light.distance).toBe(0)
    expect(light.decay).toBe(2)
  })

  it('creates a target Object3D at the origin', () => {
    const light = new SpotLight()
    expect(light.target.position.x).toBe(0)
    expect(light.target.position.y).toBe(0)
    expect(light.target.position.z).toBe(0)
  })

  it('stores custom parameters in the correct order', () => {
    const light = new SpotLight(new Vec3(0, 1, 0), 4, 50, Math.PI / 6, 0.3, 1.5)
    expect(light.color.y).toBe(1)
    expect(light.intensity).toBe(4)
    expect(light.distance).toBe(50)
    expect(light.angle).toBeCloseTo(Math.PI / 6)
    expect(light.penumbra).toBeCloseTo(0.3)
    expect(light.decay).toBe(1.5)
  })

  it('is a Light instance with a movable position and target', () => {
    const light = new SpotLight()
    expect(light).toBeInstanceOf(Light)
    light.position.set(1, 2, 3)
    light.target.position.set(-1, -2, -3)
    expect(light.position.x).toBe(1)
    expect(light.target.position.x).toBe(-1)
  })
})

describe('LightShadow', () => {
  it('applies default bias, normalBias, radius, and mapSize', () => {
    const shadow = new LightShadow({} as never)
    expect(shadow.bias).toBeCloseTo(-0.0005)
    expect(shadow.normalBias).toBe(0)
    expect(shadow.radius).toBe(1)
    expect(shadow.mapSize.width).toBe(1024)
    expect(shadow.mapSize.height).toBe(1024)
    expect(shadow.map).toBeNull()
  })

  it('stores the camera reference passed in', () => {
    const fakeCamera = { tag: 'cam' } as never
    const shadow = new LightShadow(fakeCamera)
    expect(shadow.camera).toBe(fakeCamera)
  })

  it('allows overriding mapSize', () => {
    const shadow = new LightShadow({} as never)
    shadow.mapSize = { width: 2048, height: 2048 }
    expect(shadow.mapSize.width).toBe(2048)
  })
})

describe('DirectionalLightShadow', () => {
  it('sets up an orthographic frustum with defaults', () => {
    const shadow = new DirectionalLightShadow()
    expect(shadow.left).toBe(-10)
    expect(shadow.right).toBe(10)
    expect(shadow.top).toBe(10)
    expect(shadow.bottom).toBe(-10)
    expect(shadow.csm).toBeNull()
  })

  it('inherits LightShadow defaults', () => {
    const shadow = new DirectionalLightShadow()
    expect(shadow).toBeInstanceOf(LightShadow)
    expect(shadow.bias).toBeCloseTo(-0.0005)
    expect(shadow.mapSize.width).toBe(1024)
  })

  it('creates an orthographic camera matching the frustum bounds', () => {
    const shadow = new DirectionalLightShadow()
    expect(shadow.camera.left).toBe(-10)
    expect(shadow.camera.right).toBe(10)
    expect(shadow.camera.top).toBe(10)
    expect(shadow.camera.bottom).toBe(-10)
    expect(shadow.camera.near).toBe(0.5)
    expect(shadow.camera.far).toBe(500)
  })

  it('updateFrustum() pushes frustum bounds into the camera', () => {
    const shadow = new DirectionalLightShadow()
    shadow.left = -20
    shadow.right = 20
    shadow.top = 15
    shadow.bottom = -15
    shadow.updateFrustum()
    expect(shadow.camera.left).toBe(-20)
    expect(shadow.camera.right).toBe(20)
    expect(shadow.camera.top).toBe(15)
    expect(shadow.camera.bottom).toBe(-15)
  })
})
