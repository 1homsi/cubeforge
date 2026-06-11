import { BufferGeometry, BufferAttribute } from './BufferGeometry'

// Vec3 and Mat4 are part of the ../math contract; used indirectly through BufferGeometry methods.
import type { Vec3 as _Vec3 } from '../math/Vec3'
import type { Mat4 as _Mat4 } from '../math/Mat4'

export interface TerrainOptions {
  width?: number
  height?: number
  widthSegments?: number
  heightSegments?: number
  maxElevation?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Simple seeded LCG – returns a closure that yields [0,1) floats */
function makeLCG(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/** Build a permutation table from a seeded RNG */
function buildPermTable(rng: () => number): Uint8Array {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = p[i]
    p[i] = p[j]
    p[j] = tmp
  }
  return p
}

/** Value-noise sample at grid integer (ix, iy) using a perm table */
function valueAt(p: Uint8Array, grad: Float32Array, ix: number, iy: number): number {
  const idx = p[(p[ix & 0xff]! + iy) & 0xff]!
  return grad[idx]!
}

/** 2-D value noise with bilinear interpolation and smoothstep */
function valueNoise2D(p: Uint8Array, grad: Float32Array, x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = smoothstep(fx)
  const uy = smoothstep(fy)

  const v00 = valueAt(p, grad, ix, iy)
  const v10 = valueAt(p, grad, ix + 1, iy)
  const v01 = valueAt(p, grad, ix, iy + 1)
  const v11 = valueAt(p, grad, ix + 1, iy + 1)

  return v00 * (1 - ux) * (1 - uy) + v10 * ux * (1 - uy) + v01 * (1 - ux) * uy + v11 * ux * uy
}

/** fBm (fractional Brownian motion) over 2-D value noise */
function fbm(
  p: Uint8Array,
  grad: Float32Array,
  x: number,
  y: number,
  octaves: number,
  lacunarity: number,
  persistence: number,
): number {
  let value = 0
  let amplitude = 1
  let frequency = 1
  let maxValue = 0

  for (let o = 0; o < octaves; o++) {
    value += valueNoise2D(p, grad, x * frequency, y * frequency) * amplitude
    maxValue += amplitude
    amplitude *= persistence
    frequency *= lacunarity
  }

  return value / maxValue // normalize to [0,1]
}

// ---------------------------------------------------------------------------
// TerrainGeometry
// ---------------------------------------------------------------------------

export class TerrainGeometry extends BufferGeometry {
  readonly terrainWidth: number
  readonly terrainHeight: number
  readonly widthSegments: number
  readonly heightSegments: number
  readonly maxElevation: number

  /** Raw height data, row-major, length = (wSegs+1)*(hSegs+1), values in [0,1] */
  private _heightData: Float32Array

  constructor(heightData: Float32Array | null, opts?: TerrainOptions) {
    super()

    this.terrainWidth = opts?.width ?? 256
    this.terrainHeight = opts?.height ?? 256
    this.widthSegments = opts?.widthSegments ?? 128
    this.heightSegments = opts?.heightSegments ?? 128
    this.maxElevation = opts?.maxElevation ?? 20

    const cols = this.widthSegments + 1
    const rows = this.heightSegments + 1
    const vertexCount = cols * rows

    if (heightData !== null) {
      if (heightData.length !== vertexCount) {
        throw new Error(
          `TerrainGeometry: heightData length ${heightData.length} does not match ` +
            `expected ${vertexCount} (widthSegments+1)*(heightSegments+1)`,
        )
      }
      this._heightData = heightData
    } else {
      this._heightData = new Float32Array(vertexCount) // all zeros → flat
    }

    this._build()
  }

  // -------------------------------------------------------------------------
  // Internal geometry build
  // -------------------------------------------------------------------------

  private _build(): void {
    const { terrainWidth, terrainHeight, widthSegments, heightSegments, maxElevation, _heightData } = this
    const cols = widthSegments + 1
    const rows = heightSegments + 1
    const vertexCount = cols * rows

    const positions = new Float32Array(vertexCount * 3)
    const uvs = new Float32Array(vertexCount * 2)
    const indexCount = widthSegments * heightSegments * 6
    const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount)

    const halfW = terrainWidth * 0.5
    const halfH = terrainHeight * 0.5
    const segW = terrainWidth / widthSegments
    const segH = terrainHeight / heightSegments

    // Positions + UVs
    for (let row = 0; row < rows; row++) {
      const z = -halfH + row * segH
      for (let col = 0; col < cols; col++) {
        const x = -halfW + col * segW
        const h = _heightData[row * cols + col]! * maxElevation
        const vi = (row * cols + col) * 3
        positions[vi] = x
        positions[vi + 1] = h
        positions[vi + 2] = z

        const ui = (row * cols + col) * 2
        uvs[ui] = col / widthSegments
        uvs[ui + 1] = row / heightSegments
      }
    }

    // Indices (two triangles per quad)
    let idx = 0
    for (let row = 0; row < heightSegments; row++) {
      for (let col = 0; col < widthSegments; col++) {
        const a = row * cols + col
        const b = a + 1
        const c = a + cols
        const d = c + 1
        indices[idx++] = a
        indices[idx++] = c
        indices[idx++] = b
        indices[idx++] = b
        indices[idx++] = c
        indices[idx++] = d
      }
    }

    this.setAttribute('position', new BufferAttribute(positions, 3))
    this.setAttribute('uv', new BufferAttribute(uvs, 2))
    this.setIndex(new BufferAttribute(indices, 1))

    // Compute normals via central differences for better quality than
    // the generic face-average computeVertexNormals()
    this._computeNormalsCentralDiff(positions, cols, rows, widthSegments, heightSegments, segW, segH)
  }

  private _computeNormalsCentralDiff(
    positions: Float32Array,
    cols: number,
    rows: number,
    widthSegments: number,
    heightSegments: number,
    segW: number,
    segH: number,
  ): void {
    const normalData = new Float32Array(cols * rows * 3)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Sample neighbouring heights (clamp at boundaries)
        const colL = Math.max(0, col - 1)
        const colR = Math.min(widthSegments, col + 1)
        const rowD = Math.max(0, row - 1)
        const rowU = Math.min(heightSegments, row + 1)

        const hL = positions[(row * cols + colL) * 3 + 1]!
        const hR = positions[(row * cols + colR) * 3 + 1]!
        const hD = positions[(rowD * cols + col) * 3 + 1]!
        const hU = positions[(rowU * cols + col) * 3 + 1]!

        // Finite-difference gradient
        const dX = (hL - hR) / ((colR - colL) * segW)
        const dZ = (hD - hU) / ((rowU - rowD) * segH)

        // Normal = normalize(dX, 1, dZ)
        const len = Math.sqrt(dX * dX + 1 + dZ * dZ)
        const ni = (row * cols + col) * 3
        normalData[ni] = dX / len
        normalData[ni + 1] = 1 / len
        normalData[ni + 2] = dZ / len
      }
    }

    this.setAttribute('normal', new BufferAttribute(normalData, 3))
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Interpolated world-space Y at position (x, z) using bilinear interpolation */
  getHeightAt(x: number, z: number): number {
    const { terrainWidth, terrainHeight, widthSegments, heightSegments, maxElevation, _heightData } = this
    const halfW = terrainWidth * 0.5
    const halfH = terrainHeight * 0.5

    // Map world (x,z) → [0, widthSegments] x [0, heightSegments]
    const fx = ((x + halfW) / terrainWidth) * widthSegments
    const fz = ((z + halfH) / terrainHeight) * heightSegments

    const cols = widthSegments + 1
    const col0 = Math.max(0, Math.min(widthSegments - 1, Math.floor(fx)))
    const row0 = Math.max(0, Math.min(heightSegments - 1, Math.floor(fz)))
    const col1 = col0 + 1
    const row1 = row0 + 1

    const tx = Math.max(0, Math.min(1, fx - col0))
    const tz = Math.max(0, Math.min(1, fz - row0))

    const h00 = _heightData[row0 * cols + col0]!
    const h10 = _heightData[row0 * cols + col1]!
    const h01 = _heightData[row1 * cols + col0]!
    const h11 = _heightData[row1 * cols + col1]!

    const h = h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz

    return h * maxElevation
  }

  /**
   * Update a rectangular region of height values.
   * startX/startZ and endX/endZ are inclusive vertex indices.
   * newData must have length (endX-startX+1)*(endZ-startZ+1).
   */
  updateRegion(startX: number, startZ: number, endX: number, endZ: number, newData: Float32Array): void {
    const cols = this.widthSegments + 1
    const clampedStartX = Math.max(0, startX)
    const clampedEndX = Math.min(this.widthSegments, endX)
    const clampedStartZ = Math.max(0, startZ)
    const clampedEndZ = Math.min(this.heightSegments, endZ)

    let srcIdx = 0

    for (let row = clampedStartZ; row <= clampedEndZ; row++) {
      for (let col = clampedStartX; col <= clampedEndX; col++) {
        const v = newData[srcIdx++]
        if (v !== undefined) {
          this._heightData[row * cols + col] = Math.max(0, Math.min(1, v))
        }
      }
    }

    // Rebuild geometry to reflect changes
    this._build()
  }

  // -------------------------------------------------------------------------
  // Static factories
  // -------------------------------------------------------------------------

  /** Create a TerrainGeometry by reading the red channel of an HTMLImageElement */
  static fromImage(img: HTMLImageElement, opts?: TerrainOptions): TerrainGeometry {
    const wSegs = opts?.widthSegments ?? 128
    const hSegs = opts?.heightSegments ?? 128
    const cols = wSegs + 1
    const rows = hSegs + 1

    const canvas = document.createElement('canvas')
    canvas.width = cols
    canvas.height = rows
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, cols, rows)
    const imageData = ctx.getImageData(0, 0, cols, rows)
    const pixels = imageData.data // RGBA, 4 bytes per pixel

    const heightData = new Float32Array(cols * rows)
    for (let i = 0; i < cols * rows; i++) {
      // Red channel, normalized to [0, 1]
      heightData[i] = pixels[i * 4]! / 255
    }

    return new TerrainGeometry(heightData, opts)
  }

  /** Create procedural terrain via fBm (fractional Brownian motion) */
  static procedural(
    opts?: TerrainOptions & {
      octaves?: number
      lacunarity?: number
      persistence?: number
      seed?: number
    },
  ): TerrainGeometry {
    const wSegs = opts?.widthSegments ?? 128
    const hSegs = opts?.heightSegments ?? 128
    const octaves = opts?.octaves ?? 6
    const lacunarity = opts?.lacunarity ?? 2.0
    const persistence = opts?.persistence ?? 0.5
    const seed = opts?.seed ?? 42

    const cols = wSegs + 1
    const rows = hSegs + 1

    // Build value-noise tables from the seed
    const rng = makeLCG(seed)
    const p = buildPermTable(rng)
    const grad = new Float32Array(256)
    for (let i = 0; i < 256; i++) grad[i] = rng()

    const heightData = new Float32Array(cols * rows)
    // Sample fBm over [0,1]^2
    for (let row = 0; row < rows; row++) {
      const fy = row / hSegs
      for (let col = 0; col < cols; col++) {
        const fx = col / wSegs
        heightData[row * cols + col] = fbm(p, grad, fx * 4, fy * 4, octaves, lacunarity, persistence)
      }
    }

    // Remap to [0,1]
    let minH = Infinity,
      maxH = -Infinity
    for (let i = 0; i < heightData.length; i++) {
      if (heightData[i]! < minH) minH = heightData[i]!
      if (heightData[i]! > maxH) maxH = heightData[i]!
    }
    const range = maxH - minH
    if (range > 0) {
      for (let i = 0; i < heightData.length; i++) {
        heightData[i] = (heightData[i]! - minH) / range
      }
    }

    return new TerrainGeometry(heightData, opts)
  }
}
