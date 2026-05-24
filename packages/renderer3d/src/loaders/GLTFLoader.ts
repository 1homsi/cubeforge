/**
 * GLTFLoader — full GLTF 2.0 / GLB loader, zero external dependencies.
 *
 * Supported:
 *   • .glb  (binary GLTF)
 *   • .gltf (JSON + external / embedded resources)
 *   • Sparse accessors
 *   • Morph targets
 *   • Skinning (joints + inverseBindMatrices → Skeleton)
 *   • PBR metallic-roughness materials
 *   • Animations (LINEAR / STEP / CUBICSPLINE)
 *   • Cameras (perspective + orthographic)
 *   • KHR_lights_punctual (directional / point / spot)
 *   • KHR_texture_transform (UV offset / scale / rotation)
 *   • KHR_materials_unlit (→ MeshBasicMaterial)
 */

import { Vec3 } from '../math'
import { Mat4 } from '../math'

import { Object3D } from '../scene'
import { BufferGeometry, BufferAttribute } from '../geometry'
import { MeshStandardMaterial } from '../material'
import { MeshBasicMaterial } from '../material'
import { DirectionalLight } from '../lights'
import { PointLight } from '../lights'
import { SpotLight } from '../lights'
import { Mesh } from '../objects'
import { SkinnedMesh } from '../objects'
import { Skeleton, Bone } from '../objects'
import { Texture } from '../core'

// Camera classes live in scene/Camera — import by path to avoid circular risk.
import { PerspectiveCamera, OrthographicCamera } from '../scene/Camera'
import type { Camera } from '../scene/Camera'

import { ImageLoader } from './ImageLoader'

// ─────────────────────────────────────────────────────────────────────────────
// Public animation interfaces (no AnimationClip dep — define inline and export)
// ─────────────────────────────────────────────────────────────────────────────

export interface GLTFKeyframeTrack {
  /** name of the Object3D this track targets */
  nodeName: string
  /** numeric node index as fallback when name is empty */
  nodeIndex: number
  property: 'position' | 'quaternion' | 'scale' | 'morphTargetInfluences'
  times: Float32Array
  values: Float32Array
  interpolation: 'LINEAR' | 'STEP' | 'CUBICSPLINE'
}

export interface GLTFAnimation {
  name: string
  tracks: GLTFKeyframeTrack[]
  /** maximum time value across all tracks */
  duration: number
}

export interface GLTFLoadResult {
  /** root Object3D containing the default scene (scene[0] if none specified) */
  scene: Object3D
  /** all parsed scenes */
  scenes: Object3D[]
  cameras: Camera[]
  animations: GLTFAnimation[]
  asset: { version: string; generator?: string; copyright?: string }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal GLTF JSON schema types
// ─────────────────────────────────────────────────────────────────────────────

interface GltfAsset {
  version: string
  generator?: string
  copyright?: string
  minVersion?: string
}

interface GltfScene {
  name?: string
  nodes?: number[]
  extensions?: Record<string, unknown>
}

interface GltfNode {
  name?: string
  children?: number[]
  matrix?: number[]
  translation?: [number, number, number]
  rotation?: [number, number, number, number]
  scale?: [number, number, number]
  mesh?: number
  skin?: number
  camera?: number
  weights?: number[]
  extensions?: Record<string, unknown>
  extras?: Record<string, unknown>
}

interface GltfMesh {
  name?: string
  primitives: GltfPrimitive[]
  weights?: number[]
  extras?: Record<string, unknown>
}

interface GltfPrimitive {
  attributes: Record<string, number>
  indices?: number
  material?: number
  mode?: number // 0=POINTS 1=LINES 2=LINE_LOOP 3=LINE_STRIP 4=TRIANGLES 5=TRIANGLE_STRIP 6=TRIANGLE_FAN
  targets?: Array<Record<string, number>>
  extensions?: Record<string, unknown>
}

interface GltfAccessor {
  bufferView?: number
  byteOffset?: number
  componentType: number // 5120 BYTE … 5126 FLOAT
  normalized?: boolean
  count: number
  type: string // SCALAR VEC2 VEC3 VEC4 MAT2 MAT3 MAT4
  min?: number[]
  max?: number[]
  sparse?: GltfSparse
  name?: string
}

interface GltfSparse {
  count: number
  indices: { bufferView: number; byteOffset?: number; componentType: number }
  values: { bufferView: number; byteOffset?: number }
}

interface GltfBufferView {
  buffer: number
  byteOffset?: number
  byteLength: number
  byteStride?: number
  target?: number
  name?: string
}

interface GltfBuffer {
  uri?: string
  byteLength: number
  name?: string
}

interface GltfTexture {
  sampler?: number
  source?: number
  name?: string
  extensions?: Record<string, unknown>
}

interface GltfImage {
  uri?: string
  mimeType?: string
  bufferView?: number
  name?: string
}

interface GltfSampler {
  magFilter?: number
  minFilter?: number
  wrapS?: number
  wrapT?: number
}

interface GltfTextureInfo {
  index: number
  texCoord?: number
  extensions?: Record<string, unknown>
}

interface GltfNormalTextureInfo extends GltfTextureInfo {
  scale?: number
}

interface GltfOcclusionTextureInfo extends GltfTextureInfo {
  strength?: number
}

interface GltfPbrMetallicRoughness {
  baseColorFactor?: [number, number, number, number]
  baseColorTexture?: GltfTextureInfo
  metallicFactor?: number
  roughnessFactor?: number
  metallicRoughnessTexture?: GltfTextureInfo
}

interface GltfMaterial {
  name?: string
  pbrMetallicRoughness?: GltfPbrMetallicRoughness
  normalTexture?: GltfNormalTextureInfo
  occlusionTexture?: GltfOcclusionTextureInfo
  emissiveTexture?: GltfTextureInfo
  emissiveFactor?: [number, number, number]
  alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND'
  alphaCutoff?: number
  doubleSided?: boolean
  extensions?: Record<string, unknown>
}

interface GltfCamera {
  type: 'perspective' | 'orthographic'
  name?: string
  perspective?: {
    aspectRatio?: number
    yfov: number
    znear: number
    zfar?: number
  }
  orthographic?: {
    xmag: number
    ymag: number
    znear: number
    zfar: number
  }
}

interface GltfSkin {
  name?: string
  joints: number[]
  skeleton?: number
  inverseBindMatrices?: number
}

interface GltfAnimation {
  name?: string
  channels: GltfAnimationChannel[]
  samplers: GltfAnimationSampler[]
}

interface GltfAnimationChannel {
  sampler: number
  target: {
    node?: number
    path: 'translation' | 'rotation' | 'scale' | 'weights'
  }
}

interface GltfAnimationSampler {
  input: number // accessor index for times
  output: number // accessor index for values
  interpolation?: 'LINEAR' | 'STEP' | 'CUBICSPLINE'
}

// KHR_lights_punctual
interface KhrLightsPunctualExtension {
  lights?: KhrLight[]
}

interface KhrLight {
  type: 'directional' | 'point' | 'spot'
  name?: string
  color?: [number, number, number]
  intensity?: number
  range?: number
  spot?: { innerConeAngle?: number; outerConeAngle?: number }
}

// KHR_texture_transform — stored in material.userData under the slot name
// so that renderers can pick it up without this loader needing a UV transform API.
interface KhrTextureTransform {
  offset?: [number, number]
  rotation?: number
  scale?: [number, number]
  texCoord?: number
}

/** Extract KHR_texture_transform from a GltfTextureInfo extension bag. */
function readTextureTransform(info?: GltfTextureInfo): KhrTextureTransform | null {
  if (!info?.extensions) return null
  const raw = info.extensions['KHR_texture_transform']
  if (!raw || typeof raw !== 'object') return null
  return raw as KhrTextureTransform
}

export interface GltfJson {
  asset: GltfAsset
  scene?: number
  scenes?: GltfScene[]
  nodes?: GltfNode[]
  meshes?: GltfMesh[]
  materials?: GltfMaterial[]
  textures?: GltfTexture[]
  images?: GltfImage[]
  samplers?: GltfSampler[]
  buffers?: GltfBuffer[]
  bufferViews?: GltfBufferView[]
  accessors?: GltfAccessor[]
  animations?: GltfAnimation[]
  skins?: GltfSkin[]
  cameras?: GltfCamera[]
  extensionsUsed?: string[]
  extensionsRequired?: string[]
  extensions?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const COMPONENT_TYPE_SIZE: Record<number, number> = {
  5120: 1, // BYTE
  5121: 1, // UNSIGNED_BYTE
  5122: 2, // SHORT
  5123: 2, // UNSIGNED_SHORT
  5125: 4, // UNSIGNED_INT
  5126: 4, // FLOAT
}

const TYPE_ELEMENT_COUNT: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
}

// WebGL sampler constants
const GL_NEAREST = 9728
const GL_LINEAR = 9729
const GL_NEAREST_MIPMAP_NEAREST = 9984
const GL_LINEAR_MIPMAP_NEAREST = 9985
const GL_NEAREST_MIPMAP_LINEAR = 9986
const GL_LINEAR_MIPMAP_LINEAR = 9987
const GL_REPEAT = 10497
const GL_CLAMP_TO_EDGE = 33071
const GL_MIRRORED_REPEAT = 33648

const GLB_MAGIC = 0x46546c67 // "glTF"
const GLB_VERSION = 2
const GLB_CHUNK_JSON = 0x4e4f534a // "JSON"
const GLB_CHUNK_BIN = 0x004e4942 // "BIN\0"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith('data:') || relative.startsWith('blob:') || relative.startsWith('http')) {
    return relative
  }
  const baseDir = base.slice(0, base.lastIndexOf('/') + 1)
  return baseDir + relative
}

function makeTypedArrayView(
  buffer: ArrayBuffer,
  componentType: number,
  byteOffset: number,
  count: number,
  elementCount: number,
): Float32Array | Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array {
  const length = count * elementCount
  switch (componentType) {
    case 5120:
      return new Int8Array(buffer, byteOffset, length)
    case 5121:
      return new Uint8Array(buffer, byteOffset, length)
    case 5122:
      return new Int16Array(buffer, byteOffset, length)
    case 5123:
      return new Uint16Array(buffer, byteOffset, length)
    case 5125:
      return new Uint32Array(buffer, byteOffset, length)
    case 5126:
      return new Float32Array(buffer, byteOffset, length)
    default:
      throw new Error(`GLTFLoader: unknown componentType ${componentType}`)
  }
}

/**
 * Expand a potentially strided / offset bufferView slice into a flat, packed
 * typed array suitable for BufferAttribute, handling byteStride correctly.
 */
function extractAccessorData(
  json: GltfJson,
  buffers: ArrayBuffer[],
  accessorIndex: number,
): Float32Array | Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array {
  const acc = json.accessors![accessorIndex]
  const elemCount = TYPE_ELEMENT_COUNT[acc.type] ?? 1
  const compSize = COMPONENT_TYPE_SIZE[acc.componentType] ?? 4

  // --- Base array (without sparse overlay) ---
  let base: Float32Array | Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array

  if (acc.bufferView !== undefined) {
    const bv = json.bufferViews![acc.bufferView]
    const buf = buffers[bv.buffer]
    const bvOffset = bv.byteOffset ?? 0
    const accByteOffset = acc.byteOffset ?? 0
    const byteStride = bv.byteStride

    if (byteStride !== undefined && byteStride !== elemCount * compSize) {
      // Interleaved — must de-interleave manually
      const out = new Float32Array(acc.count * elemCount)
      for (let i = 0; i < acc.count; i++) {
        const srcByte = bvOffset + accByteOffset + i * byteStride
        const view = makeTypedArrayView(buf, acc.componentType, srcByte, 1, elemCount)
        for (let k = 0; k < elemCount; k++) {
          out[i * elemCount + k] = view[k]
        }
      }
      base = out
    } else {
      const startByte = bvOffset + accByteOffset
      // Ensure alignment by slicing if the offset is not aligned.
      // We copy into a fresh aligned buffer in that case.
      const requiredAlign = compSize
      if (startByte % requiredAlign !== 0) {
        const bytes = new Uint8Array(buf, startByte, acc.count * elemCount * compSize)
        const aligned = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        base = makeTypedArrayView(aligned, acc.componentType, 0, acc.count, elemCount)
      } else {
        base = makeTypedArrayView(buf, acc.componentType, startByte, acc.count, elemCount)
      }
    }
  } else {
    // No bufferView → zero-initialized
    switch (acc.componentType) {
      case 5120:
        base = new Int8Array(acc.count * elemCount)
        break
      case 5121:
        base = new Uint8Array(acc.count * elemCount)
        break
      case 5122:
        base = new Int16Array(acc.count * elemCount)
        break
      case 5123:
        base = new Uint16Array(acc.count * elemCount)
        break
      case 5125:
        base = new Uint32Array(acc.count * elemCount)
        break
      default:
        base = new Float32Array(acc.count * elemCount)
        break
    }
  }

  // --- Apply sparse overlay if present ---
  if (acc.sparse) {
    const sp = acc.sparse

    // Read sparse indices
    const idxBv = json.bufferViews![sp.indices.bufferView]
    const idxOffset = (idxBv.byteOffset ?? 0) + (sp.indices.byteOffset ?? 0)
    const idxBuf = buffers[idxBv.buffer]
    const indices = makeTypedArrayView(idxBuf, sp.indices.componentType, idxOffset, sp.count, 1) as
      | Uint16Array
      | Uint32Array
      | Uint8Array

    // Read sparse values
    const valBv = json.bufferViews![sp.values.bufferView]
    const valOffset = (valBv.byteOffset ?? 0) + (sp.values.byteOffset ?? 0)
    const valBuf = buffers[valBv.buffer]

    // Sparse values must always be interpreted with the accessor's componentType
    let values: Float32Array | Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array
    const valAligned =
      valOffset % compSize === 0
        ? valBuf
        : ((): ArrayBuffer => {
            const b = new Uint8Array(valBuf, valOffset, sp.count * elemCount * compSize)
            return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
          })()
    const valStart = valOffset % compSize === 0 ? valOffset : 0
    values = makeTypedArrayView(valAligned, acc.componentType, valStart, sp.count, elemCount)

    // Overlay sparse values onto base.
    // Base may be a view into a larger buffer — we need a writable copy.
    let writable: Float32Array | Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array
    const Ctor = base.constructor as new (n: number) => typeof base
    writable = new Ctor(acc.count * elemCount)
    ;(writable as Float32Array).set(base as Float32Array)

    for (let s = 0; s < sp.count; s++) {
      const idx = indices[s]
      for (let k = 0; k < elemCount; k++) {
        ;(writable as Float32Array)[idx * elemCount + k] = (values as Float32Array)[s * elemCount + k]
      }
    }
    return writable
  }

  return base
}

// ─────────────────────────────────────────────────────────────────────────────
// GLTFLoader
// ─────────────────────────────────────────────────────────────────────────────

export class GLTFLoader {
  private gl: WebGL2RenderingContext | null

  constructor(gl?: WebGL2RenderingContext) {
    this.gl = gl ?? null
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async load(url: string): Promise<GLTFLoadResult> {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`GLTFLoader: HTTP ${resp.status} loading "${url}"`)
    const data = await resp.arrayBuffer()
    return this.parse(data, url)
  }

  async parse(data: ArrayBuffer, baseUrl = ''): Promise<GLTFLoadResult> {
    const view32 = new DataView(data)
    const magic = view32.getUint32(0, true)

    if (magic === GLB_MAGIC) {
      return this._parseGlb(data, baseUrl)
    }

    // Assume JSON (GLTF)
    const text = new TextDecoder().decode(data)
    const json = JSON.parse(text) as GltfJson
    return this.parseJSON(json, baseUrl)
  }

  async parseJSON(json: GltfJson, baseUrl = '', binaryChunk?: ArrayBuffer): Promise<GLTFLoadResult> {
    // Validate asset version
    const assetVersion = json.asset?.version ?? '2.0'
    if (!assetVersion.startsWith('2')) {
      console.warn(`GLTFLoader: asset version ${assetVersion} — only 2.x is fully supported`)
    }

    // --- 1. Load all buffers ---
    const buffers = await this._loadBuffers(json, baseUrl, binaryChunk)

    // --- 2. Load all textures ---
    const textures = await this._loadTextures(json, buffers, baseUrl)

    // --- 3. Parse cameras ---
    const cameras: Camera[] = this._parseCameras(json)

    // --- 4. Parse materials ---
    const materials = this._parseMaterials(json, textures)

    // --- 5. Build node objects (first pass — no hierarchy yet) ---
    const nodeCount = json.nodes?.length ?? 0
    const nodeObjects: Object3D[] = []

    for (let i = 0; i < nodeCount; i++) {
      const gNode = json.nodes![i]
      // Determine if this node will be a skinned mesh
      const hasSkin = gNode.skin !== undefined

      let obj: Object3D

      if (gNode.mesh !== undefined) {
        const gMesh = json.meshes![gNode.mesh]
        const meshResult = this._buildMesh(json, buffers, gMesh, materials, hasSkin, gNode.weights)
        obj = meshResult
      } else if (gNode.camera !== undefined) {
        obj = cameras[gNode.camera] ?? new Object3D()
      } else {
        // Check KHR_lights_punctual node extension
        const lightRef = (gNode.extensions?.['KHR_lights_punctual'] as { light?: number } | undefined)?.light
        if (lightRef !== undefined) {
          const lightDefs =
            (json.extensions?.['KHR_lights_punctual'] as KhrLightsPunctualExtension | undefined)?.lights ?? []
          obj = this._buildPunctualLight(lightDefs[lightRef])
        } else {
          obj = new Object3D()
        }
      }

      obj.name = gNode.name ?? `node_${i}`
      this._applyNodeTransform(obj, gNode)
      nodeObjects.push(obj)
    }

    // --- 6. Build node hierarchy (second pass) ---
    for (let i = 0; i < nodeCount; i++) {
      const gNode = json.nodes![i]
      if (gNode.children) {
        for (const childIdx of gNode.children) {
          nodeObjects[i].add(nodeObjects[childIdx])
        }
      }
    }

    // --- 7. Attach skeletons (third pass — after hierarchy is known) ---
    for (let i = 0; i < nodeCount; i++) {
      const gNode = json.nodes![i]
      if (gNode.skin !== undefined) {
        const skinned = nodeObjects[i]
        // skinned may be a Group containing multiple SkinnedMeshes
        skinned.traverse((obj) => {
          if (obj instanceof SkinnedMesh) {
            const skeleton = this._buildSkeleton(json, buffers, gNode.skin!, nodeObjects)
            obj.bind(skeleton)
          }
        })
      }
    }

    // --- 8. Build scenes ---
    const scenes: Object3D[] = []
    if (json.scenes) {
      for (let si = 0; si < json.scenes.length; si++) {
        const gScene = json.scenes[si]
        const sceneRoot = new Object3D()
        sceneRoot.name = gScene.name ?? `scene_${si}`
        if (gScene.nodes) {
          for (const ni of gScene.nodes) {
            sceneRoot.add(nodeObjects[ni])
          }
        }
        scenes.push(sceneRoot)
      }
    }

    // Default scene
    const defaultSceneIndex = json.scene ?? 0
    const scene = scenes[defaultSceneIndex] ?? scenes[0] ?? new Object3D()

    // --- 9. Parse animations ---
    const animations = this._parseAnimations(json, buffers, nodeObjects)

    // --- 10. Collect cameras from scene nodes ---
    const sceneCameras: Camera[] = []
    for (let i = 0; i < nodeCount; i++) {
      const gNode = json.nodes![i]
      if (gNode.camera !== undefined) {
        const cam = cameras[gNode.camera]
        if (cam) sceneCameras.push(cam)
      }
    }

    return {
      scene,
      scenes,
      cameras: sceneCameras,
      animations,
      asset: {
        version: json.asset.version,
        generator: json.asset.generator,
        copyright: json.asset.copyright,
      },
    }
  }

  // ── GLB parsing ─────────────────────────────────────────────────────────────

  private async _parseGlb(data: ArrayBuffer, baseUrl: string): Promise<GLTFLoadResult> {
    const view = new DataView(data)

    const magic = view.getUint32(0, true)
    const version = view.getUint32(4, true)
    const length = view.getUint32(8, true)

    if (magic !== GLB_MAGIC) throw new Error('GLTFLoader: not a valid GLB file (bad magic)')
    if (version !== GLB_VERSION) throw new Error(`GLTFLoader: unsupported GLB version ${version}`)
    if (length !== data.byteLength) {
      console.warn(`GLTFLoader: GLB declared length ${length} but buffer is ${data.byteLength} bytes`)
    }

    let offset = 12
    let json: GltfJson | null = null
    let binaryChunk: ArrayBuffer | undefined

    while (offset < data.byteLength) {
      if (offset + 8 > data.byteLength) break
      const chunkLen = view.getUint32(offset, true)
      const chunkType = view.getUint32(offset + 4, true)
      offset += 8

      if (chunkType === GLB_CHUNK_JSON) {
        const jsonBytes = new Uint8Array(data, offset, chunkLen)
        const text = new TextDecoder().decode(jsonBytes)
        json = JSON.parse(text) as GltfJson
      } else if (chunkType === GLB_CHUNK_BIN) {
        binaryChunk = data.slice(offset, offset + chunkLen)
      }
      // Skip unknown chunk types
      offset += chunkLen
    }

    if (!json) throw new Error('GLTFLoader: GLB contains no JSON chunk')

    return this.parseJSON(json, baseUrl, binaryChunk)
  }

  // ── Buffer loading ──────────────────────────────────────────────────────────

  private async _loadBuffers(json: GltfJson, baseUrl: string, binaryChunk?: ArrayBuffer): Promise<ArrayBuffer[]> {
    const buffers: ArrayBuffer[] = []
    const defs = json.buffers ?? []

    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]

      if (!def.uri) {
        // GLB embedded binary chunk (buffer index 0)
        if (i === 0 && binaryChunk !== undefined) {
          buffers.push(binaryChunk)
        } else {
          buffers.push(new ArrayBuffer(def.byteLength))
        }
        continue
      }

      if (def.uri.startsWith('data:')) {
        // data URI — find the base64 payload
        const commaIdx = def.uri.indexOf(',')
        if (commaIdx === -1) throw new Error('GLTFLoader: malformed data URI')
        const b64 = def.uri.slice(commaIdx + 1)
        buffers.push(base64ToArrayBuffer(b64))
      } else {
        const url = resolveUrl(baseUrl, def.uri)
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`GLTFLoader: HTTP ${resp.status} loading buffer "${url}"`)
        buffers.push(await resp.arrayBuffer())
      }
    }

    return buffers
  }

  // ── Texture loading ─────────────────────────────────────────────────────────

  private async _loadTextures(json: GltfJson, buffers: ArrayBuffer[], baseUrl: string): Promise<(Texture | null)[]> {
    const texDefs = json.textures ?? []
    const imgDefs = json.images ?? []
    const samplers = json.samplers ?? []

    const textures: (Texture | null)[] = []

    for (const texDef of texDefs) {
      const imageIndex = texDef.source
      if (imageIndex === undefined) {
        textures.push(null)
        continue
      }

      const imgDef = imgDefs[imageIndex]
      const sampler = texDef.sampler !== undefined ? samplers[texDef.sampler] : undefined

      let bitmap: ImageBitmap
      try {
        if (imgDef.bufferView !== undefined) {
          const bv = json.bufferViews![imgDef.bufferView]
          const buf = buffers[bv.buffer]
          const start = bv.byteOffset ?? 0
          const slice = buf.slice(start, start + bv.byteLength)
          const mime = imgDef.mimeType ?? 'image/png'
          bitmap = await ImageLoader.fromArrayBuffer(slice, mime)
        } else if (imgDef.uri) {
          if (imgDef.uri.startsWith('data:')) {
            const commaIdx = imgDef.uri.indexOf(',')
            const header = imgDef.uri.slice(5, commaIdx) // e.g. "image/png;base64"
            const mime = header.split(';')[0]
            const b64 = imgDef.uri.slice(commaIdx + 1)
            const ab = base64ToArrayBuffer(b64)
            bitmap = await ImageLoader.fromArrayBuffer(ab, mime)
          } else {
            const url = resolveUrl(baseUrl, imgDef.uri)
            bitmap = await new ImageLoader().loadBitmap(url)
          }
        } else {
          textures.push(null)
          continue
        }
      } catch (err) {
        console.warn('GLTFLoader: failed to load image', imgDef.uri ?? imgDef.bufferView, err)
        textures.push(null)
        continue
      }

      if (this.gl) {
        const tex = Texture.fromImage(this.gl, bitmap, {
          wrapS: this._glWrap(sampler?.wrapS),
          wrapT: this._glWrap(sampler?.wrapT),
          magFilter: this._glMagFilter(sampler?.magFilter),
          minFilter: this._glMinFilter(sampler?.minFilter),
          generateMipmaps: this._needsMipmaps(sampler?.minFilter),
          flipY: false,
        })
        textures.push(tex)
      } else {
        // No GL context — store null; caller can upload later
        textures.push(null)
      }

      bitmap.close()
    }

    return textures
  }

  private _glWrap(gltfWrap?: number): number {
    if (gltfWrap === undefined) return GL_REPEAT
    if (gltfWrap === GL_CLAMP_TO_EDGE) return GL_CLAMP_TO_EDGE
    if (gltfWrap === GL_MIRRORED_REPEAT) return GL_MIRRORED_REPEAT
    return GL_REPEAT
  }

  private _glMagFilter(f?: number): number {
    return f === GL_NEAREST ? GL_NEAREST : GL_LINEAR
  }

  private _glMinFilter(f?: number): number {
    switch (f) {
      case GL_NEAREST:
        return GL_NEAREST
      case GL_NEAREST_MIPMAP_NEAREST:
        return GL_NEAREST_MIPMAP_NEAREST
      case GL_LINEAR_MIPMAP_NEAREST:
        return GL_LINEAR_MIPMAP_NEAREST
      case GL_NEAREST_MIPMAP_LINEAR:
        return GL_NEAREST_MIPMAP_LINEAR
      case GL_LINEAR_MIPMAP_LINEAR:
        return GL_LINEAR_MIPMAP_LINEAR
      default:
        return GL_LINEAR_MIPMAP_LINEAR
    }
  }

  private _needsMipmaps(f?: number): boolean {
    if (f === undefined) return true // default linear_mipmap_linear
    return (
      f === GL_NEAREST_MIPMAP_NEAREST ||
      f === GL_LINEAR_MIPMAP_NEAREST ||
      f === GL_NEAREST_MIPMAP_LINEAR ||
      f === GL_LINEAR_MIPMAP_LINEAR
    )
  }

  // ── Camera parsing ──────────────────────────────────────────────────────────

  private _parseCameras(json: GltfJson): Camera[] {
    const cameras: Camera[] = []
    for (const gCam of json.cameras ?? []) {
      let cam: Camera
      if (gCam.type === 'perspective' && gCam.perspective) {
        const p = gCam.perspective
        const fov = (p.yfov * 180) / Math.PI // convert radians → degrees
        cam = new PerspectiveCamera(fov, p.aspectRatio ?? 1, p.znear, p.zfar ?? 100000)
      } else if (gCam.type === 'orthographic' && gCam.orthographic) {
        const o = gCam.orthographic
        cam = new OrthographicCamera(-o.xmag, o.xmag, o.ymag, -o.ymag, o.znear, o.zfar)
      } else {
        cam = new PerspectiveCamera()
      }
      cam.name = gCam.name ?? ''
      cameras.push(cam)
    }
    return cameras
  }

  // ── Material parsing ────────────────────────────────────────────────────────

  private _parseMaterials(json: GltfJson, textures: (Texture | null)[]): (MeshStandardMaterial | MeshBasicMaterial)[] {
    const materials: (MeshStandardMaterial | MeshBasicMaterial)[] = []

    for (const gMat of json.materials ?? []) {
      // KHR_materials_unlit → MeshBasicMaterial
      if (gMat.extensions?.['KHR_materials_unlit'] !== undefined) {
        const mat = new MeshBasicMaterial(gMat.name ?? '')
        const pbr = gMat.pbrMetallicRoughness
        if (pbr?.baseColorFactor) {
          mat.color.x = pbr.baseColorFactor[0]
          mat.color.y = pbr.baseColorFactor[1]
          mat.color.z = pbr.baseColorFactor[2]
          mat.opacity = pbr.baseColorFactor[3] ?? 1
        }
        if (pbr?.baseColorTexture) {
          mat.map = textures[pbr.baseColorTexture.index] ?? null
          const xf = readTextureTransform(pbr.baseColorTexture)
          if (xf) (mat as unknown as Record<string, unknown>)['mapTransform'] = xf
        }
        mat.side = gMat.doubleSided ? 'double' : 'front'
        if (gMat.alphaMode === 'BLEND') {
          mat.transparent = true
          mat.depthWrite = false
        }
        materials.push(mat)
        continue
      }

      // Standard PBR material
      const mat = new MeshStandardMaterial(gMat.name ?? '')
      const pbr = gMat.pbrMetallicRoughness

      if (pbr) {
        if (pbr.baseColorFactor) {
          mat.color.x = pbr.baseColorFactor[0]
          mat.color.y = pbr.baseColorFactor[1]
          mat.color.z = pbr.baseColorFactor[2]
          mat.opacity = pbr.baseColorFactor[3] ?? 1
        }
        mat.metalness = pbr.metallicFactor ?? 1
        mat.roughness = pbr.roughnessFactor ?? 1

        if (pbr.baseColorTexture) {
          mat.map = textures[pbr.baseColorTexture.index] ?? null
          const xf = readTextureTransform(pbr.baseColorTexture)
          if (xf) (mat as unknown as Record<string, unknown>)['mapTransform'] = xf
        }
        if (pbr.metallicRoughnessTexture) {
          const tex = textures[pbr.metallicRoughnessTexture.index] ?? null
          mat.metalnessMap = tex
          mat.roughnessMap = tex
          const xf = readTextureTransform(pbr.metallicRoughnessTexture)
          if (xf) (mat as unknown as Record<string, unknown>)['metalnessRoughnessTransform'] = xf
        }
      }

      if (gMat.normalTexture) {
        mat.normalMap = textures[gMat.normalTexture.index] ?? null
        const s = gMat.normalTexture.scale ?? 1
        mat.normalScale = { x: s, y: s }
        const xf = readTextureTransform(gMat.normalTexture)
        if (xf) (mat as unknown as Record<string, unknown>)['normalMapTransform'] = xf
      }
      if (gMat.occlusionTexture) {
        mat.aoMap = textures[gMat.occlusionTexture.index] ?? null
        mat.aoMapIntensity = gMat.occlusionTexture.strength ?? 1
        const xf = readTextureTransform(gMat.occlusionTexture)
        if (xf) (mat as unknown as Record<string, unknown>)['aoMapTransform'] = xf
      }
      if (gMat.emissiveTexture) {
        mat.emissiveMap = textures[gMat.emissiveTexture.index] ?? null
        const xf = readTextureTransform(gMat.emissiveTexture)
        if (xf) (mat as unknown as Record<string, unknown>)['emissiveMapTransform'] = xf
      }

      const ef = gMat.emissiveFactor
      if (ef) {
        mat.emissive.x = ef[0]
        mat.emissive.y = ef[1]
        mat.emissive.z = ef[2]
      }

      mat.side = gMat.doubleSided ? 'double' : 'front'

      switch (gMat.alphaMode ?? 'OPAQUE') {
        case 'BLEND':
          mat.transparent = true
          mat.depthWrite = false
          break
        case 'MASK':
          // Cutout — renderer must handle alphaCutoff via a uniform
          mat.transparent = false
          ;(mat as MeshStandardMaterial & { alphaCutoff?: number }).alphaCutoff = gMat.alphaCutoff ?? 0.5
          break
        default: // OPAQUE
          break
      }

      materials.push(mat)
    }

    return materials
  }

  // ── Mesh building ───────────────────────────────────────────────────────────

  private _buildMesh(
    json: GltfJson,
    buffers: ArrayBuffer[],
    gMesh: GltfMesh,
    materials: (MeshStandardMaterial | MeshBasicMaterial)[],
    isSkinned: boolean,
    nodeWeights?: number[],
  ): Object3D {
    const primitives = gMesh.primitives

    if (primitives.length === 1) {
      return this._buildPrimitive(json, buffers, primitives[0], materials, isSkinned, gMesh.weights ?? nodeWeights)
    }

    // Multiple primitives → group
    const group = new Object3D()
    group.name = gMesh.name ?? ''
    for (const prim of primitives) {
      const child = this._buildPrimitive(json, buffers, prim, materials, isSkinned, gMesh.weights ?? nodeWeights)
      group.add(child)
    }
    return group
  }

  private _buildPrimitive(
    json: GltfJson,
    buffers: ArrayBuffer[],
    prim: GltfPrimitive,
    materials: (MeshStandardMaterial | MeshBasicMaterial)[],
    isSkinned: boolean,
    morphWeights?: number[],
  ): Mesh | SkinnedMesh {
    const geo = new BufferGeometry()

    // --- Vertex attributes ---
    const attrMap: Record<string, string> = {
      POSITION: 'position',
      NORMAL: 'normal',
      TANGENT: 'tangent',
      TEXCOORD_0: 'uv',
      TEXCOORD_1: 'uv2',
      COLOR_0: 'color',
      JOINTS_0: 'skinIndex',
      WEIGHTS_0: 'skinWeight',
    }

    for (const [gltfName, attrName] of Object.entries(attrMap)) {
      const accIdx = prim.attributes[gltfName]
      if (accIdx === undefined) continue
      const data = extractAccessorData(json, buffers, accIdx)
      const acc = json.accessors![accIdx]
      const items = TYPE_ELEMENT_COUNT[acc.type] ?? 1
      const norm = acc.normalized ?? false
      geo.setAttribute(attrName, this._toBufferAttribute(data, items, norm))
    }

    // Extra TEXCOORD_* channels
    for (const key of Object.keys(prim.attributes)) {
      if (!key.startsWith('TEXCOORD_') || key === 'TEXCOORD_0' || key === 'TEXCOORD_1') continue
      const n = key.slice('TEXCOORD_'.length)
      const accIdx = prim.attributes[key]
      const data = extractAccessorData(json, buffers, accIdx)
      const acc = json.accessors![accIdx]
      geo.setAttribute(`uv${n}`, this._toBufferAttribute(data, TYPE_ELEMENT_COUNT[acc.type] ?? 2, false))
    }

    // --- Indices ---
    if (prim.indices !== undefined) {
      const idxData = extractAccessorData(json, buffers, prim.indices)
      const acc = json.accessors![prim.indices]
      let indexArray: Uint16Array | Uint32Array
      if (acc.componentType === 5125) {
        // UNSIGNED_INT
        indexArray = idxData instanceof Uint32Array ? idxData : new Uint32Array(idxData)
      } else {
        // UNSIGNED_SHORT (or UNSIGNED_BYTE — promote to Uint16)
        indexArray = idxData instanceof Uint16Array ? idxData : new Uint16Array(idxData)
      }
      geo.index = new BufferAttribute(indexArray, 1)
    }

    // --- Morph targets ---
    if (prim.targets && prim.targets.length > 0) {
      for (const [targetIndex, target] of prim.targets.entries()) {
        for (const [gltfKey, accIdx] of Object.entries(target)) {
          const mapKey =
            gltfKey === 'POSITION'
              ? 'position'
              : gltfKey === 'NORMAL'
                ? 'normal'
                : gltfKey === 'TANGENT'
                  ? 'tangent'
                  : gltfKey.toLowerCase()
          const data = extractAccessorData(json, buffers, accIdx)
          const acc = json.accessors![accIdx]
          const items = TYPE_ELEMENT_COUNT[acc.type] ?? 3
          const attr = this._toBufferAttribute(data, items, false)

          let list = geo.morphAttributes.get(mapKey)
          if (!list) {
            list = []
            geo.morphAttributes.set(mapKey, list)
          }
          list[targetIndex] = attr
        }
      }
    }

    // --- Material ---
    const mat: MeshStandardMaterial | MeshBasicMaterial =
      prim.material !== undefined ? materials[prim.material] : new MeshStandardMaterial('default')

    // --- Create mesh ---
    const mesh = isSkinned ? new SkinnedMesh(geo, mat) : new Mesh(geo, mat)

    // Morph weights
    if (morphWeights && morphWeights.length > 0) {
      ;(mesh as Mesh & { morphTargetInfluences?: number[] }).morphTargetInfluences = [...morphWeights]
    }

    return mesh
  }

  /** Convert any typed array to a Float32Array-backed BufferAttribute (or 16/32 int for indices). */
  private _toBufferAttribute(
    data: Float32Array | Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array,
    itemSize: number,
    normalized: boolean,
  ): BufferAttribute {
    // BufferAttribute only accepts Float32Array | Uint16Array | Uint32Array.
    // Promote byte / short types to float.
    let arr: Float32Array | Uint16Array | Uint32Array
    if (data instanceof Float32Array || data instanceof Uint16Array || data instanceof Uint32Array) {
      arr = data
    } else {
      // Int8, Uint8, Int16 → Float32
      arr = new Float32Array(data.length)
      for (let i = 0; i < data.length; i++) arr[i] = data[i]
    }
    return new BufferAttribute(arr, itemSize, normalized)
  }

  // ── Node transform ──────────────────────────────────────────────────────────

  private _applyNodeTransform(obj: Object3D, gNode: GltfNode): void {
    if (gNode.matrix) {
      // Column-major matrix
      const m = new Mat4()
      m.fromArray(gNode.matrix)
      m.decompose(obj.position, obj.quaternion, obj.scale)
      obj.matrix.copy(m)
      obj.matrixAutoUpdate = false
    } else {
      if (gNode.translation) {
        obj.position.set(gNode.translation[0], gNode.translation[1], gNode.translation[2])
      }
      if (gNode.rotation) {
        obj.quaternion.set(gNode.rotation[0], gNode.rotation[1], gNode.rotation[2], gNode.rotation[3])
      }
      if (gNode.scale) {
        obj.scale.set(gNode.scale[0], gNode.scale[1], gNode.scale[2])
      }
    }
  }

  // ── Skeleton building ────────────────────────────────────────────────────────

  private _buildSkeleton(json: GltfJson, buffers: ArrayBuffer[], skinIndex: number, nodeObjects: Object3D[]): Skeleton {
    const gSkin = json.skins![skinIndex]
    const bones: Bone[] = []

    for (const jointIndex of gSkin.joints) {
      const node = nodeObjects[jointIndex]
      // Ensure the node is a Bone (promote if needed)
      let bone: Bone
      if (node instanceof Bone) {
        bone = node
      } else {
        // Replace the node in the hierarchy with a Bone proxy
        bone = new Bone()
        bone.name = node.name
        bone.position.set(node.position.x, node.position.y, node.position.z)
        bone.quaternion.set(node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w)
        bone.scale.set(node.scale.x, node.scale.y, node.scale.z)
        bone.matrix.copy(node.matrix)
        bone.matrixAutoUpdate = node.matrixAutoUpdate
        // Re-attach children
        for (const child of [...node.children]) {
          bone.add(child)
        }
        // Replace in parent
        if (node.parent) {
          const parent = node.parent
          const idx = parent.children.indexOf(node)
          parent.children[idx] = bone
          bone.parent = parent
          node.parent = null
        }
        nodeObjects[jointIndex] = bone
      }
      bones.push(bone)
    }

    // Inverse bind matrices
    let inverses: Mat4[] | undefined
    if (gSkin.inverseBindMatrices !== undefined) {
      const ibmData = extractAccessorData(json, buffers, gSkin.inverseBindMatrices)
      inverses = []
      for (let i = 0; i < bones.length; i++) {
        const mat = new Mat4()
        mat.fromArray(ibmData, i * 16)
        inverses.push(mat)
      }
    }

    return new Skeleton(bones, inverses)
  }

  // ── KHR_lights_punctual ─────────────────────────────────────────────────────

  private _buildPunctualLight(lightDef?: KhrLight): Object3D {
    if (!lightDef) return new Object3D()

    const color = lightDef.color ? new Vec3(lightDef.color[0], lightDef.color[1], lightDef.color[2]) : new Vec3(1, 1, 1)
    const intensity = lightDef.intensity ?? 1

    let light: DirectionalLight | PointLight | SpotLight

    switch (lightDef.type) {
      case 'directional':
        light = new DirectionalLight(color, intensity)
        break
      case 'point':
        light = new PointLight(color, intensity, lightDef.range ?? 0)
        break
      case 'spot': {
        const inner = lightDef.spot?.innerConeAngle ?? 0
        const outer = lightDef.spot?.outerConeAngle ?? Math.PI / 4
        const penumbra = 1 - inner / outer
        light = new SpotLight(color, intensity, lightDef.range ?? 0, outer, penumbra)
        break
      }
      default:
        return new Object3D()
    }

    light.name = lightDef.name ?? ''
    return light
  }

  // ── Animation parsing ────────────────────────────────────────────────────────

  private _parseAnimations(json: GltfJson, buffers: ArrayBuffer[], nodeObjects: Object3D[]): GLTFAnimation[] {
    const animations: GLTFAnimation[] = []

    for (let ai = 0; ai < (json.animations ?? []).length; ai++) {
      const gAnim = json.animations![ai]
      const tracks: GLTFKeyframeTrack[] = []

      for (const channel of gAnim.channels) {
        const gSampler = gAnim.samplers[channel.sampler]
        const nodeIndex = channel.target.node

        if (nodeIndex === undefined) continue // pointer to scene — skip

        const node = nodeObjects[nodeIndex]
        const interp = gSampler.interpolation ?? 'LINEAR'

        // Read times (input accessor)
        const timesRaw = extractAccessorData(json, buffers, gSampler.input)
        const times = timesRaw instanceof Float32Array ? timesRaw : new Float32Array(timesRaw)

        // Read values (output accessor)
        const valRaw = extractAccessorData(json, buffers, gSampler.output)
        const values = valRaw instanceof Float32Array ? valRaw : new Float32Array(valRaw)

        const pathMap: Record<string, GLTFKeyframeTrack['property']> = {
          translation: 'position',
          rotation: 'quaternion',
          scale: 'scale',
          weights: 'morphTargetInfluences',
        }

        const property = pathMap[channel.target.path]
        if (!property) continue

        tracks.push({
          nodeName: node?.name ?? `node_${nodeIndex}`,
          nodeIndex,
          property,
          times,
          values,
          interpolation: interp as 'LINEAR' | 'STEP' | 'CUBICSPLINE',
        })
      }

      // Compute duration from the max time across all tracks
      let duration = 0
      for (const t of tracks) {
        if (t.times.length > 0) {
          duration = Math.max(duration, t.times[t.times.length - 1])
        }
      }

      animations.push({
        name: gAnim.name ?? `animation_${ai}`,
        tracks,
        duration,
      })
    }

    return animations
  }
}
