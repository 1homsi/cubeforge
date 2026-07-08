import { describe, it, expect } from 'vitest'

import { GLTFLoader } from '../loaders'
import type { GltfJson } from '../loaders'
import { Object3D } from '../scene'
import { PerspectiveCamera, OrthographicCamera } from '../scene/Camera'
import { Mesh, SkinnedMesh } from '../objects'
import { MeshStandardMaterial, MeshBasicMaterial } from '../material'
import { DirectionalLight, PointLight, SpotLight } from '../lights'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers for constructing minimal glTF JSON with embedded base64 buffers.
// ─────────────────────────────────────────────────────────────────────────────

/** Build a base64 `data:` URI from any typed-array view. */
function dataUri(view: ArrayBufferView): string {
  const u8 = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  return `data:application/octet-stream;base64,${Buffer.from(u8).toString('base64')}`
}

/** Fluent builder that appends buffers/bufferViews/accessors as it goes. */
class GltfBuilder {
  json: GltfJson

  constructor() {
    this.json = {
      asset: { version: '2.0' },
      buffers: [],
      bufferViews: [],
      accessors: [],
      nodes: [],
      meshes: [],
      scenes: [{ nodes: [] }],
      scene: 0,
    } as unknown as GltfJson
  }

  /** Store `view` as its own buffer + bufferView; returns the bufferView index. */
  addBufferView(view: ArrayBufferView, byteStride?: number): number {
    const u8 = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
    const bufIdx = this.json.buffers!.length
    this.json.buffers!.push({ uri: dataUri(u8), byteLength: u8.byteLength })
    const bvIdx = this.json.bufferViews!.length
    this.json.bufferViews!.push({ buffer: bufIdx, byteOffset: 0, byteLength: u8.byteLength, byteStride })
    return bvIdx
  }

  /** Store `view` and describe it with an accessor; returns the accessor index. */
  addAccessor(
    view: ArrayBufferView,
    componentType: number,
    type: string,
    count: number,
    extra: Record<string, unknown> = {},
    byteStride?: number,
  ): number {
    const bv = this.addBufferView(view, byteStride)
    const idx = this.json.accessors!.length
    this.json.accessors!.push({ bufferView: bv, componentType, type, count, ...extra } as never)
    return idx
  }
}

const FLOAT = 5126
const UNSIGNED_BYTE = 5121
const UNSIGNED_SHORT = 5123
const UNSIGNED_INT = 5125

/** A simple single-triangle mesh gltf with one node in the default scene. */
function triangleGltf(): { builder: GltfBuilder; posAcc: number } {
  const b = new GltfBuilder()
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
  const posAcc = b.addAccessor(positions, FLOAT, 'VEC3', 3)
  const indices = new Uint16Array([0, 1, 2])
  const idxAcc = b.addAccessor(indices, UNSIGNED_SHORT, 'SCALAR', 3)
  b.json.meshes = [{ primitives: [{ attributes: { POSITION: posAcc }, indices: idxAcc }] }]
  b.json.nodes = [{ mesh: 0, name: 'tri' }]
  b.json.scenes = [{ nodes: [0] }]
  return { builder: b, posAcc }
}

describe('GLTFLoader — JSON parse pipeline', () => {
  it('parses a minimal triangle mesh into the scene graph', async () => {
    const { builder } = triangleGltf()
    const result = await new GLTFLoader().parseJSON(builder.json)

    expect(result.scene).toBeInstanceOf(Object3D)
    expect(result.scenes).toHaveLength(1)
    expect(result.asset.version).toBe('2.0')

    const node = result.scene.children[0]
    expect(node.name).toBe('tri')
    expect(node).toBeInstanceOf(Mesh)

    const mesh = node as Mesh
    const pos = mesh.geometry.getAttribute('position')!
    expect(pos.count).toBe(3)
    expect(pos.itemSize).toBe(3)
    expect(Array.from(pos.data)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0])
    expect(mesh.geometry.index!.count).toBe(3)
    expect(Array.from(mesh.geometry.index!.data)).toEqual([0, 1, 2])
  })

  it('routes ArrayBuffer JSON through parse()', async () => {
    const { builder } = triangleGltf()
    const text = JSON.stringify(builder.json)
    const bytes = new TextEncoder().encode(text)
    const result = await new GLTFLoader().parse(bytes.buffer)
    expect(result.scene.children[0]).toBeInstanceOf(Mesh)
  })

  it('defaults the default scene index to 0 and honors json.scene', async () => {
    const { builder } = triangleGltf()
    // Add a second scene and mark it default.
    builder.json.nodes!.push({ name: 'extra' })
    builder.json.scenes = [{ nodes: [0] }, { nodes: [1], name: 'second' }]
    builder.json.scene = 1
    const result = await new GLTFLoader().parseJSON(builder.json)
    expect(result.scenes).toHaveLength(2)
    expect(result.scene.name).toBe('second')
    expect(result.scene.children[0].name).toBe('extra')
  })

  it('names unnamed nodes node_<index>', async () => {
    const b = new GltfBuilder()
    b.json.nodes = [{}]
    b.json.scenes = [{ nodes: [0] }]
    const result = await new GLTFLoader().parseJSON(b.json)
    expect(result.scene.children[0].name).toBe('node_0')
  })
})

describe('GLTFLoader — accessor decoding', () => {
  it('preserves FLOAT VEC3 data and counts', async () => {
    const { builder } = triangleGltf()
    const result = await new GLTFLoader().parseJSON(builder.json)
    const mesh = result.scene.children[0] as Mesh
    expect(mesh.geometry.getAttribute('position')!.count).toBe(3)
  })

  it('promotes UNSIGNED_BYTE vertex colors to Float32 and keeps normalized flag', async () => {
    const b = new GltfBuilder()
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
    const posAcc = b.addAccessor(positions, FLOAT, 'VEC3', 3)
    const colors = new Uint8Array([255, 128, 0, 255, 10, 20, 30, 40, 1, 2, 3, 4])
    const colAcc = b.addAccessor(colors, UNSIGNED_BYTE, 'VEC4', 3, { normalized: true })
    b.json.meshes = [{ primitives: [{ attributes: { POSITION: posAcc, COLOR_0: colAcc } }] }]
    b.json.nodes = [{ mesh: 0 }]
    b.json.scenes = [{ nodes: [0] }]

    const result = await new GLTFLoader().parseJSON(b.json)
    const mesh = result.scene.children[0] as Mesh
    const color = mesh.geometry.getAttribute('color')!
    expect(color.itemSize).toBe(4)
    expect(color.count).toBe(3)
    expect(color.normalized).toBe(true)
    expect(color.data).toBeInstanceOf(Float32Array)
    // Raw values preserved (not divided by 255)
    expect(Array.from(color.data.slice(0, 4))).toEqual([255, 128, 0, 255])
  })

  it('keeps UNSIGNED_INT indices as Uint32Array', async () => {
    const b = new GltfBuilder()
    const positions = new Float32Array(9)
    const posAcc = b.addAccessor(positions, FLOAT, 'VEC3', 3)
    const indices = new Uint32Array([0, 1, 2])
    const idxAcc = b.addAccessor(indices, UNSIGNED_INT, 'SCALAR', 3)
    b.json.meshes = [{ primitives: [{ attributes: { POSITION: posAcc }, indices: idxAcc }] }]
    b.json.nodes = [{ mesh: 0 }]
    b.json.scenes = [{ nodes: [0] }]

    const result = await new GLTFLoader().parseJSON(b.json)
    const mesh = result.scene.children[0] as Mesh
    expect(mesh.geometry.index!.data).toBeInstanceOf(Uint32Array)
    expect(Array.from(mesh.geometry.index!.data)).toEqual([0, 1, 2])
  })

  it('de-interleaves a strided bufferView into packed data', async () => {
    const b = new GltfBuilder()
    // 2 vertices, VEC3 FLOAT (12 bytes) + 4 bytes padding => byteStride 16.
    const buf = new ArrayBuffer(32)
    const f = new Float32Array(buf)
    // vertex 0 at floats [0..2], vertex 1 at floats [4..6]
    f[0] = 1
    f[1] = 2
    f[2] = 3
    f[4] = 4
    f[5] = 5
    f[6] = 6
    const posAcc = b.addAccessor(f, FLOAT, 'VEC3', 2, {}, 16)
    b.json.meshes = [{ primitives: [{ attributes: { POSITION: posAcc } }] }]
    b.json.nodes = [{ mesh: 0 }]
    b.json.scenes = [{ nodes: [0] }]

    const result = await new GLTFLoader().parseJSON(b.json)
    const mesh = result.scene.children[0] as Mesh
    const pos = mesh.geometry.getAttribute('position')!
    expect(pos.count).toBe(2)
    expect(Array.from(pos.data)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('applies sparse accessor overlays onto a zero base', async () => {
    const b = new GltfBuilder()
    // Base accessor with no bufferView => zero-initialized (3 x VEC3 = zeros)
    const sparseIndices = new Uint16Array([1])
    const sparseValues = new Float32Array([5, 6, 7])
    const idxBv = b.addBufferView(sparseIndices)
    const valBv = b.addBufferView(sparseValues)
    const posAcc = b.json.accessors!.length
    b.json.accessors!.push({
      componentType: FLOAT,
      type: 'VEC3',
      count: 3,
      sparse: {
        count: 1,
        indices: { bufferView: idxBv, componentType: UNSIGNED_SHORT },
        values: { bufferView: valBv },
      },
    } as never)
    b.json.meshes = [{ primitives: [{ attributes: { POSITION: posAcc } }] }]
    b.json.nodes = [{ mesh: 0 }]
    b.json.scenes = [{ nodes: [0] }]

    const result = await new GLTFLoader().parseJSON(b.json)
    const mesh = result.scene.children[0] as Mesh
    const pos = mesh.geometry.getAttribute('position')!
    expect(Array.from(pos.data)).toEqual([0, 0, 0, 5, 6, 7, 0, 0, 0])
  })
})

describe('GLTFLoader — node transforms', () => {
  it('applies translation / rotation / scale to the object', async () => {
    const b = new GltfBuilder()
    b.json.nodes = [
      {
        name: 'xf',
        translation: [1, 2, 3],
        rotation: [0, 0, 0.7071, 0.7071],
        scale: [2, 3, 4],
      },
    ]
    b.json.scenes = [{ nodes: [0] }]

    const result = await new GLTFLoader().parseJSON(b.json)
    const obj = result.scene.children[0]
    expect(obj.position.x).toBeCloseTo(1)
    expect(obj.position.y).toBeCloseTo(2)
    expect(obj.position.z).toBeCloseTo(3)
    expect(obj.quaternion.z).toBeCloseTo(0.7071)
    expect(obj.quaternion.w).toBeCloseTo(0.7071)
    expect(obj.scale.x).toBeCloseTo(2)
    expect(obj.scale.y).toBeCloseTo(3)
    expect(obj.scale.z).toBeCloseTo(4)
    expect(obj.matrixAutoUpdate).toBe(true)
  })

  it('decomposes a column-major matrix and disables matrixAutoUpdate', async () => {
    const b = new GltfBuilder()
    // Column-major translation matrix (tx=5, ty=6, tz=7)
    b.json.nodes = [{ matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1] }]
    b.json.scenes = [{ nodes: [0] }]

    const result = await new GLTFLoader().parseJSON(b.json)
    const obj = result.scene.children[0]
    expect(obj.position.x).toBeCloseTo(5)
    expect(obj.position.y).toBeCloseTo(6)
    expect(obj.position.z).toBeCloseTo(7)
    expect(obj.matrixAutoUpdate).toBe(false)
  })
})

describe('GLTFLoader — hierarchy', () => {
  it('nests children under their parent node', async () => {
    const b = new GltfBuilder()
    b.json.nodes = [{ name: 'root', children: [1] }, { name: 'child', children: [2] }, { name: 'grandchild' }]
    b.json.scenes = [{ nodes: [0] }]

    const result = await new GLTFLoader().parseJSON(b.json)
    const root = result.scene.children[0]
    expect(root.name).toBe('root')
    expect(root.children).toHaveLength(1)
    const child = root.children[0]
    expect(child.name).toBe('child')
    expect(child.children[0].name).toBe('grandchild')
  })

  it('groups multi-primitive meshes under one Object3D', async () => {
    const b = new GltfBuilder()
    const positions = new Float32Array(9)
    const posAcc = b.addAccessor(positions, FLOAT, 'VEC3', 3)
    b.json.meshes = [
      {
        name: 'multi',
        primitives: [{ attributes: { POSITION: posAcc } }, { attributes: { POSITION: posAcc } }],
      },
    ]
    b.json.nodes = [{ mesh: 0, name: 'multi-node' }]
    b.json.scenes = [{ nodes: [0] }]

    const result = await new GLTFLoader().parseJSON(b.json)
    const group = result.scene.children[0]
    // NOTE: the node's name overrides the mesh's own name.
    expect(group.name).toBe('multi-node')
    expect(group.children).toHaveLength(2)
    expect(group.children[0]).toBeInstanceOf(Mesh)
    expect(group.children[1]).toBeInstanceOf(Mesh)
  })
})

describe('GLTFLoader — materials', () => {
  it('extracts baseColorFactor, metallic, roughness and emissive', async () => {
    const { builder } = triangleGltf()
    builder.json.materials = [
      {
        name: 'pbr',
        pbrMetallicRoughness: {
          baseColorFactor: [0.1, 0.2, 0.3, 0.5],
          metallicFactor: 0.25,
          roughnessFactor: 0.75,
        },
        emissiveFactor: [0.9, 0.8, 0.7],
        doubleSided: true,
        alphaMode: 'BLEND',
      },
    ]
    builder.json.meshes![0].primitives[0].material = 0

    const result = await new GLTFLoader().parseJSON(builder.json)
    const mesh = result.scene.children[0] as Mesh
    const mat = mesh.material as MeshStandardMaterial
    expect(mat).toBeInstanceOf(MeshStandardMaterial)
    expect(mat.name).toBe('pbr')
    expect(mat.color.x).toBeCloseTo(0.1)
    expect(mat.color.y).toBeCloseTo(0.2)
    expect(mat.color.z).toBeCloseTo(0.3)
    expect(mat.opacity).toBeCloseTo(0.5)
    expect(mat.metalness).toBeCloseTo(0.25)
    expect(mat.roughness).toBeCloseTo(0.75)
    expect(mat.emissive.x).toBeCloseTo(0.9)
    expect(mat.emissive.y).toBeCloseTo(0.8)
    expect(mat.emissive.z).toBeCloseTo(0.7)
    expect(mat.side).toBe('double')
    expect(mat.transparent).toBe(true)
    expect(mat.depthWrite).toBe(false)
  })

  it('defaults metallic and roughness to 1 when pbr block present without factors', async () => {
    const { builder } = triangleGltf()
    builder.json.materials = [{ pbrMetallicRoughness: {} }]
    builder.json.meshes![0].primitives[0].material = 0

    const result = await new GLTFLoader().parseJSON(builder.json)
    const mat = (result.scene.children[0] as Mesh).material as MeshStandardMaterial
    expect(mat.metalness).toBe(1)
    expect(mat.roughness).toBe(1)
  })

  it('maps KHR_materials_unlit to MeshBasicMaterial', async () => {
    const { builder } = triangleGltf()
    builder.json.materials = [
      {
        name: 'unlit',
        extensions: { KHR_materials_unlit: {} },
        pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 0.4] },
        alphaMode: 'BLEND',
      },
    ]
    builder.json.meshes![0].primitives[0].material = 0

    const result = await new GLTFLoader().parseJSON(builder.json)
    const mat = (result.scene.children[0] as Mesh).material as MeshBasicMaterial
    expect(mat).toBeInstanceOf(MeshBasicMaterial)
    expect(mat.color.x).toBeCloseTo(1)
    expect(mat.opacity).toBeCloseTo(0.4)
    expect(mat.transparent).toBe(true)
  })

  it('sets alphaCutoff for MASK alpha mode', async () => {
    const { builder } = triangleGltf()
    builder.json.materials = [{ alphaMode: 'MASK', alphaCutoff: 0.3 }]
    builder.json.meshes![0].primitives[0].material = 0

    const result = await new GLTFLoader().parseJSON(builder.json)
    const mat = (result.scene.children[0] as Mesh).material as MeshStandardMaterial & { alphaCutoff?: number }
    expect(mat.transparent).toBe(false)
    expect(mat.alphaCutoff).toBeCloseTo(0.3)
  })

  it('uses a default standard material when a primitive has no material index', async () => {
    const { builder } = triangleGltf()
    const result = await new GLTFLoader().parseJSON(builder.json)
    const mat = (result.scene.children[0] as Mesh).material
    expect(mat).toBeInstanceOf(MeshStandardMaterial)
  })
})

describe('GLTFLoader — cameras', () => {
  it('converts perspective yfov (radians) to degrees', async () => {
    const b = new GltfBuilder()
    b.json.cameras = [
      { type: 'perspective', name: 'cam', perspective: { yfov: Math.PI / 2, aspectRatio: 1.5, znear: 0.1, zfar: 100 } },
    ]
    b.json.nodes = [{ camera: 0 }]
    b.json.scenes = [{ nodes: [0] }]

    const result = await new GLTFLoader().parseJSON(b.json)
    expect(result.cameras).toHaveLength(1)
    const cam = result.cameras[0] as PerspectiveCamera
    expect(cam).toBeInstanceOf(PerspectiveCamera)
    expect(cam.fov).toBeCloseTo(90)
    expect(cam.aspect).toBeCloseTo(1.5)
    expect(cam.near).toBeCloseTo(0.1)
    expect(cam.far).toBeCloseTo(100)
  })

  it('builds an orthographic camera', async () => {
    const b = new GltfBuilder()
    b.json.cameras = [{ type: 'orthographic', orthographic: { xmag: 2, ymag: 3, znear: 0.1, zfar: 50 } }]
    b.json.nodes = [{ camera: 0 }]
    b.json.scenes = [{ nodes: [0] }]

    const result = await new GLTFLoader().parseJSON(b.json)
    const cam = result.cameras[0] as OrthographicCamera
    expect(cam).toBeInstanceOf(OrthographicCamera)
    expect(cam.left).toBeCloseTo(-2)
    expect(cam.right).toBeCloseTo(2)
    expect(cam.top).toBeCloseTo(3)
    expect(cam.bottom).toBeCloseTo(-3)
  })
})

describe('GLTFLoader — KHR_lights_punctual', () => {
  function lightGltf(light: Record<string, unknown>, nodeName?: string): GltfJson {
    const b = new GltfBuilder()
    b.json.extensions = { KHR_lights_punctual: { lights: [light] } }
    b.json.nodes = [{ name: nodeName, extensions: { KHR_lights_punctual: { light: 0 } } }]
    b.json.scenes = [{ nodes: [0] }]
    return b.json
  }

  it('builds a directional light with color and intensity', async () => {
    const result = await new GLTFLoader().parseJSON(
      lightGltf({ type: 'directional', name: 'sun', color: [1, 0.5, 0.25], intensity: 3 }, 'sun-node'),
    )
    const light = result.scene.children[0] as DirectionalLight
    expect(light).toBeInstanceOf(DirectionalLight)
    // NOTE: the node's name overrides the light's own name from the extension.
    expect(light.name).toBe('sun-node')
    expect(light.color.x).toBeCloseTo(1)
    expect(light.color.y).toBeCloseTo(0.5)
    expect(light.color.z).toBeCloseTo(0.25)
    expect(light.intensity).toBeCloseTo(3)
  })

  it('builds a point light with range mapped to distance', async () => {
    const result = await new GLTFLoader().parseJSON(lightGltf({ type: 'point', intensity: 2, range: 15 }))
    const light = result.scene.children[0] as PointLight
    expect(light).toBeInstanceOf(PointLight)
    expect(light.distance).toBeCloseTo(15)
    expect(light.intensity).toBeCloseTo(2)
  })

  it('builds a spot light with penumbra derived from cone angles', async () => {
    const result = await new GLTFLoader().parseJSON(
      lightGltf({ type: 'spot', spot: { innerConeAngle: Math.PI / 8, outerConeAngle: Math.PI / 4 } }),
    )
    const light = result.scene.children[0] as SpotLight
    expect(light).toBeInstanceOf(SpotLight)
    expect(light.angle).toBeCloseTo(Math.PI / 4)
    // penumbra = 1 - inner/outer = 1 - 0.5
    expect(light.penumbra).toBeCloseTo(0.5)
  })
})

describe('GLTFLoader — animations', () => {
  it('parses a translation channel into a position track with duration', async () => {
    const b = new GltfBuilder()
    b.json.nodes = [{ name: 'anim-node' }]
    b.json.scenes = [{ nodes: [0] }]
    const times = new Float32Array([0, 0.5, 1])
    const timeAcc = b.addAccessor(times, FLOAT, 'SCALAR', 3)
    const values = new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0])
    const valAcc = b.addAccessor(values, FLOAT, 'VEC3', 3)
    b.json.animations = [
      {
        name: 'move',
        samplers: [{ input: timeAcc, output: valAcc, interpolation: 'LINEAR' }],
        channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }],
      },
    ]

    const result = await new GLTFLoader().parseJSON(b.json)
    expect(result.animations).toHaveLength(1)
    const anim = result.animations[0]
    expect(anim.name).toBe('move')
    expect(anim.duration).toBeCloseTo(1)
    expect(anim.tracks).toHaveLength(1)
    const track = anim.tracks[0]
    expect(track.property).toBe('position')
    expect(track.nodeName).toBe('anim-node')
    expect(track.nodeIndex).toBe(0)
    expect(track.interpolation).toBe('LINEAR')
    expect(Array.from(track.times)).toEqual([0, 0.5, 1])
  })

  it('maps rotation/scale/weights paths to their properties', async () => {
    const b = new GltfBuilder()
    b.json.nodes = [{ name: 'n' }]
    b.json.scenes = [{ nodes: [0] }]
    const times = new Float32Array([0, 2])
    const t = b.addAccessor(times, FLOAT, 'SCALAR', 2)
    const rot = b.addAccessor(new Float32Array(8), FLOAT, 'VEC4', 2)
    const scl = b.addAccessor(new Float32Array(6), FLOAT, 'VEC3', 2)
    const wts = b.addAccessor(new Float32Array(2), FLOAT, 'SCALAR', 2)
    b.json.animations = [
      {
        samplers: [
          { input: t, output: rot },
          { input: t, output: scl },
          { input: t, output: wts },
        ],
        channels: [
          { sampler: 0, target: { node: 0, path: 'rotation' } },
          { sampler: 1, target: { node: 0, path: 'scale' } },
          { sampler: 2, target: { node: 0, path: 'weights' } },
        ],
      },
    ]

    const result = await new GLTFLoader().parseJSON(b.json)
    const props = result.animations[0].tracks.map((t) => t.property)
    expect(props).toEqual(['quaternion', 'scale', 'morphTargetInfluences'])
    expect(result.animations[0].name).toBe('animation_0')
    expect(result.animations[0].duration).toBeCloseTo(2)
  })
})

describe('GLTFLoader — skinning', () => {
  it('binds a skeleton with inverse bind matrices to a SkinnedMesh', async () => {
    const b = new GltfBuilder()
    const positions = new Float32Array(9)
    const posAcc = b.addAccessor(positions, FLOAT, 'VEC3', 3)
    // Two joints => two 4x4 inverse-bind matrices (identity).
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    const ibm = new Float32Array([...identity, ...identity])
    const ibmAcc = b.addAccessor(ibm, FLOAT, 'MAT4', 2)

    b.json.meshes = [{ primitives: [{ attributes: { POSITION: posAcc } }] }]
    b.json.skins = [{ joints: [1, 2], inverseBindMatrices: ibmAcc }]
    b.json.nodes = [{ name: 'skinned', mesh: 0, skin: 0 }, { name: 'jointA' }, { name: 'jointB' }]
    b.json.scenes = [{ nodes: [0, 1, 2] }]

    const result = await new GLTFLoader().parseJSON(b.json)
    const skinned = result.scene.children[0] as SkinnedMesh
    expect(skinned).toBeInstanceOf(SkinnedMesh)
    expect(skinned.skeleton).not.toBeNull()
    expect(skinned.skeleton!.bones).toHaveLength(2)
    expect(skinned.skeleton!.boneInverses).toHaveLength(2)
  })
})

describe('GLTFLoader — GLB binary parsing', () => {
  /** Assemble a GLB from a glTF JSON object and an optional binary chunk. */
  function makeGlb(json: GltfJson, bin?: ArrayBuffer): ArrayBuffer {
    const enc = new TextEncoder()
    let jsonBytes = enc.encode(JSON.stringify(json))
    // pad JSON chunk to 4-byte boundary with spaces (0x20)
    const jsonPad = (4 - (jsonBytes.length % 4)) % 4
    if (jsonPad) {
      const padded = new Uint8Array(jsonBytes.length + jsonPad)
      padded.set(jsonBytes)
      padded.fill(0x20, jsonBytes.length)
      jsonBytes = padded
    }

    let binBytes: Uint8Array | null = null
    if (bin) {
      const raw = new Uint8Array(bin)
      const binPad = (4 - (raw.length % 4)) % 4
      binBytes = new Uint8Array(raw.length + binPad)
      binBytes.set(raw)
    }

    const total = 12 + 8 + jsonBytes.length + (binBytes ? 8 + binBytes.length : 0)
    const out = new ArrayBuffer(total)
    const view = new DataView(out)
    const u8 = new Uint8Array(out)

    view.setUint32(0, 0x46546c67, true) // magic "glTF"
    view.setUint32(4, 2, true) // version
    view.setUint32(8, total, true) // length

    let offset = 12
    view.setUint32(offset, jsonBytes.length, true)
    view.setUint32(offset + 4, 0x4e4f534a, true) // "JSON"
    u8.set(jsonBytes, offset + 8)
    offset += 8 + jsonBytes.length

    if (binBytes) {
      view.setUint32(offset, binBytes.length, true)
      view.setUint32(offset + 4, 0x004e4942, true) // "BIN\0"
      u8.set(binBytes, offset + 8)
    }

    return out
  }

  it('parses a GLB with embedded BIN chunk geometry', async () => {
    // Binary chunk holds positions (36 bytes) then indices (6 bytes).
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
    const indices = new Uint16Array([0, 1, 2])
    const bin = new ArrayBuffer(positions.byteLength + indices.byteLength)
    new Uint8Array(bin).set(new Uint8Array(positions.buffer), 0)
    new Uint8Array(bin).set(new Uint8Array(indices.buffer), positions.byteLength)

    const json = {
      asset: { version: '2.0' },
      buffers: [{ byteLength: bin.byteLength }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
        { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength },
      ],
      accessors: [
        { bufferView: 0, componentType: FLOAT, type: 'VEC3', count: 3 },
        { bufferView: 1, componentType: UNSIGNED_SHORT, type: 'SCALAR', count: 3 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      nodes: [{ mesh: 0, name: 'glb-tri' }],
      scenes: [{ nodes: [0] }],
      scene: 0,
    } as unknown as GltfJson

    const glb = makeGlb(json, bin)
    const result = await new GLTFLoader().parse(glb)
    const mesh = result.scene.children[0] as Mesh
    expect(mesh.name).toBe('glb-tri')
    expect(Array.from(mesh.geometry.getAttribute('position')!.data)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0])
    expect(Array.from(mesh.geometry.index!.data)).toEqual([0, 1, 2])
  })

  it('rejects a GLB with an unsupported version', async () => {
    const json = { asset: { version: '2.0' }, scenes: [{ nodes: [] }] } as unknown as GltfJson
    const glb = makeGlb(json)
    const view = new DataView(glb)
    view.setUint32(4, 3, true) // corrupt the version to 3
    await expect(new GLTFLoader().parse(glb)).rejects.toThrow(/unsupported GLB version/)
  })
})
