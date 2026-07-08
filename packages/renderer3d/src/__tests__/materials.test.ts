import { describe, it, expect } from 'vitest'
import {
  Material,
  MeshStandardMaterial,
  MeshBasicMaterial,
  MeshDepthMaterial,
  ShaderMaterial,
  LineMaterial,
} from '../material'
import { Vec3 } from '../math'

describe('Material (base, via MeshBasicMaterial)', () => {
  it('applies default render state', () => {
    const mat = new MeshBasicMaterial()
    expect(mat.transparent).toBe(false)
    expect(mat.opacity).toBe(1)
    expect(mat.depthTest).toBe(true)
    expect(mat.depthWrite).toBe(true)
    expect(mat.side).toBe('front')
    expect(mat.blending).toBe('normal')
    expect(mat.wireframe).toBe(false)
    expect(mat.visible).toBe(true)
  })

  it('assigns unique auto-incrementing ids', () => {
    const a = new MeshBasicMaterial()
    const b = new MeshBasicMaterial()
    expect(typeof a.id).toBe('number')
    expect(b.id).toBeGreaterThan(a.id)
  })

  it('stores an optional name', () => {
    expect(new MeshBasicMaterial('grass').name).toBe('grass')
    expect(new MeshBasicMaterial().name).toBe('')
  })

  it('needsUpdate increments version each time it is set true', () => {
    const mat = new MeshBasicMaterial()
    expect(mat.version).toBe(0)
    expect(mat.needsUpdate).toBe(false)
    mat.needsUpdate = true
    expect(mat.version).toBe(1)
    expect(mat.needsUpdate).toBe(true)
    mat.needsUpdate = true
    expect(mat.version).toBe(2)
    mat.needsUpdate = false
    expect(mat.version).toBe(2)
  })

  it('dispose() does not throw', () => {
    const mat = new MeshBasicMaterial()
    expect(() => mat.dispose()).not.toThrow()
  })

  it('clone() gets a fresh id and reset version/needsUpdate', () => {
    const mat = new MeshBasicMaterial('src')
    mat.needsUpdate = true
    mat.opacity = 0.5
    const copy = mat.clone()
    expect(copy.id).not.toBe(mat.id)
    expect(copy.version).toBe(0)
    expect(copy.needsUpdate).toBe(false)
    expect(copy.opacity).toBe(0.5)
    expect(copy.name).toBe('src')
  })
})

describe('MeshBasicMaterial', () => {
  it('has correct type tag and default white color', () => {
    const mat = new MeshBasicMaterial()
    expect(mat.type).toBe('MeshBasicMaterial')
    expect(mat.color.x).toBe(1)
    expect(mat.color.y).toBe(1)
    expect(mat.color.z).toBe(1)
    expect(mat.map).toBeNull()
  })

  it('clone() produces an independent color object', () => {
    const mat = new MeshBasicMaterial()
    const copy = mat.clone()
    copy.color.x = 0.25
    expect(mat.color.x).toBe(1)
    expect(copy.color.x).toBe(0.25)
  })
})

describe('MeshStandardMaterial', () => {
  it('applies PBR defaults', () => {
    const mat = new MeshStandardMaterial()
    expect(mat.type).toBe('MeshStandardMaterial')
    expect(mat.metalness).toBe(0)
    expect(mat.roughness).toBe(0.5)
    expect(mat.emissiveIntensity).toBe(1)
    expect(mat.envMapIntensity).toBe(1)
    expect(mat.aoMapIntensity).toBe(1)
    expect(mat.flatShading).toBe(false)
  })

  it('defaults color to white and emissive to black', () => {
    const mat = new MeshStandardMaterial()
    expect(mat.color.x).toBe(1)
    expect(mat.color.y).toBe(1)
    expect(mat.color.z).toBe(1)
    expect(mat.emissive.x).toBe(0)
    expect(mat.emissive.y).toBe(0)
    expect(mat.emissive.z).toBe(0)
  })

  it('defaults all texture maps to null and normalScale to (1,1)', () => {
    const mat = new MeshStandardMaterial()
    expect(mat.map).toBeNull()
    expect(mat.normalMap).toBeNull()
    expect(mat.metalnessMap).toBeNull()
    expect(mat.roughnessMap).toBeNull()
    expect(mat.aoMap).toBeNull()
    expect(mat.emissiveMap).toBeNull()
    expect(mat.envMap).toBeNull()
    expect(mat.normalScale.x).toBe(1)
    expect(mat.normalScale.y).toBe(1)
  })

  it('stores mutated PBR scalars', () => {
    const mat = new MeshStandardMaterial()
    mat.metalness = 1
    mat.roughness = 0.1
    mat.color = new Vec3(0.8, 0.2, 0.1)
    expect(mat.metalness).toBe(1)
    expect(mat.roughness).toBeCloseTo(0.1)
    expect(mat.color.y).toBeCloseTo(0.2)
  })

  it('clone() deep-copies color, emissive, and normalScale', () => {
    const mat = new MeshStandardMaterial('pbr')
    mat.color = new Vec3(0.5, 0.5, 0.5)
    mat.emissive = new Vec3(0.1, 0.1, 0.1)
    const copy = mat.clone()
    expect(copy.name).toBe('pbr')

    copy.color.x = 0.9
    copy.emissive.y = 0.7
    copy.normalScale.x = 3

    expect(mat.color.x).toBe(0.5)
    expect(mat.emissive.y).toBeCloseTo(0.1)
    expect(mat.normalScale.x).toBe(1)
    expect(copy.color.x).toBe(0.9)
    expect(copy.normalScale.x).toBe(3)
  })

  it('clone() shares texture references (renderer owns them)', () => {
    const mat = new MeshStandardMaterial()
    const fakeTex = { id: 42 } as never
    mat.map = fakeTex
    const copy = mat.clone()
    expect(copy.map).toBe(fakeTex)
  })

  it('dispose() does not throw', () => {
    expect(() => new MeshStandardMaterial().dispose()).not.toThrow()
  })
})

describe('MeshDepthMaterial', () => {
  it('has correct type and depth-focused defaults', () => {
    const mat = new MeshDepthMaterial()
    expect(mat.type).toBe('MeshDepthMaterial')
    expect(mat.transparent).toBe(false)
    expect(mat.depthWrite).toBe(true)
    expect(mat.depthTest).toBe(true)
    expect(mat.alphaMap).toBeNull()
    expect(mat.alphaTest).toBe(0)
  })

  it('supports alpha masking config', () => {
    const mat = new MeshDepthMaterial()
    mat.alphaTest = 0.5
    mat.alphaMap = { id: 1 } as never
    expect(mat.alphaTest).toBe(0.5)
    expect(mat.alphaMap).not.toBeNull()
  })
})

describe('ShaderMaterial', () => {
  it('applies defaults when constructed with no options', () => {
    const mat = new ShaderMaterial()
    expect(mat.type).toBe('ShaderMaterial')
    expect(mat.glslVersion).toBe('300 es')
    expect(mat.drawMode).toBe('triangles')
    expect(mat.uniforms).toEqual({})
    expect(mat.defines).toEqual({})
    expect(mat.vertexShader).toContain('void main')
    expect(mat.fragmentShader).toContain('void main')
  })

  it('stores provided shader source, uniforms, defines, and options', () => {
    const mat = new ShaderMaterial({
      vertexShader: 'VERT',
      fragmentShader: 'FRAG',
      uniforms: { u_time: { value: 0 }, u_color: { value: [1, 0.5, 0] } },
      defines: { USE_FOG: true, MAX_LIGHTS: 4 },
      glslVersion: '100',
      drawMode: 'points',
      name: 'custom',
    })
    expect(mat.vertexShader).toBe('VERT')
    expect(mat.fragmentShader).toBe('FRAG')
    expect(mat.uniforms.u_time.value).toBe(0)
    expect(mat.uniforms.u_color.value).toEqual([1, 0.5, 0])
    expect(mat.glslVersion).toBe('100')
    expect(mat.drawMode).toBe('points')
    expect(mat.name).toBe('custom')
  })

  it('buildDefinesBlock() emits bare and valued defines, skipping false', () => {
    const mat = new ShaderMaterial({
      defines: { USE_FOG: true, MAX_LIGHTS: 4, DISABLED: false, MODE: 'HDR' },
    })
    const block = mat.buildDefinesBlock()
    expect(block).toContain('#define USE_FOG')
    expect(block).toContain('#define MAX_LIGHTS 4')
    expect(block).toContain('#define MODE HDR')
    expect(block).not.toContain('DISABLED')
  })

  it('injectDefines() inserts the block after the #version line', () => {
    const mat = new ShaderMaterial({ defines: { USE_FOG: true } })
    const src = '#version 300 es\nvoid main() {}'
    const injected = mat.injectDefines(src)
    const lines = injected.split('\n')
    expect(lines[0]).toBe('#version 300 es')
    expect(lines[1]).toBe('#define USE_FOG')
    expect(injected).toContain('void main')
  })

  it('injectDefines() returns source unchanged when there are no defines', () => {
    const mat = new ShaderMaterial()
    const src = '#version 300 es\nvoid main() {}'
    expect(mat.injectDefines(src)).toBe(src)
  })

  it('clone() deep-copies uniforms and defines independently', () => {
    const mat = new ShaderMaterial({
      uniforms: { u_time: { value: 1 } },
      defines: { A: 1 },
    })
    const copy = mat.clone()
    copy.uniforms.u_time.value = 99
    copy.defines.A = 2
    expect(mat.uniforms.u_time.value).toBe(1)
    expect(mat.defines.A).toBe(1)
    expect(copy.uniforms.u_time.value).toBe(99)
  })

  it('dispose() does not throw', () => {
    expect(() => new ShaderMaterial().dispose()).not.toThrow()
  })
})

describe('LineMaterial', () => {
  it('has correct type and default properties', () => {
    const mat = new LineMaterial()
    expect(mat.type).toBe('LineMaterial')
    expect(mat.color).toBeInstanceOf(Vec3)
    expect(mat.color.x).toBe(1)
    expect(mat.color.y).toBe(1)
    expect(mat.color.z).toBe(1)
    expect(mat.linewidth).toBe(1)
    expect(mat.dashed).toBe(false)
    expect(mat.dashSize).toBe(3)
    expect(mat.gapSize).toBe(1)
  })

  it('inherits base render-state defaults', () => {
    const mat = new LineMaterial()
    expect(mat).toBeInstanceOf(Material)
    expect(mat.opacity).toBe(1)
    expect(mat.transparent).toBe(false)
    expect(mat.visible).toBe(true)
  })

  it('supports dashed-line configuration', () => {
    const mat = new LineMaterial()
    mat.dashed = true
    mat.dashSize = 5
    mat.gapSize = 2
    mat.linewidth = 4
    expect(mat.dashed).toBe(true)
    expect(mat.dashSize).toBe(5)
    expect(mat.gapSize).toBe(2)
    expect(mat.linewidth).toBe(4)
  })

  it('dispose() does not throw', () => {
    expect(() => new LineMaterial().dispose()).not.toThrow()
  })
})
