import { Vec3 } from '../math'
import { BufferGeometry, BufferAttribute } from './BufferGeometry'

export class LatheGeometry extends BufferGeometry {
  constructor(points: Vec3[], segments = 12, phiStart = 0, phiLength = Math.PI * 2) {
    super()

    if (points.length < 2) throw new Error('LatheGeometry requires at least 2 profile points')

    const inverseSegments = 1 / segments
    const profileCount = points.length
    const vertexCount = (segments + 1) * profileCount

    const positions = new Float32Array(vertexCount * 3)
    const normals = new Float32Array(vertexCount * 3)
    const uvs = new Float32Array(vertexCount * 2)
    const indices: number[] = []

    // Pre-compute sin/cos for each segment angle
    const sinArr = new Float32Array(segments + 1)
    const cosArr = new Float32Array(segments + 1)
    for (let i = 0; i <= segments; i++) {
      const phi = phiStart + i * inverseSegments * phiLength
      sinArr[i] = Math.sin(phi)
      cosArr[i] = Math.cos(phi)
    }

    let vi = 0
    let ui = 0

    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j < profileCount; j++) {
        const r = points[j].x // profile x = radius, z ignored
        const y = points[j].y

        positions[vi] = r * cosArr[i]
        positions[vi + 1] = y
        positions[vi + 2] = r * sinArr[i]
        vi += 3

        uvs[ui] = i * inverseSegments
        uvs[ui + 1] = j / (profileCount - 1)
        ui += 2
      }
    }

    // Compute normals using finite differences along the profile for tangent,
    // then cross with the radial direction.
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j < profileCount; j++) {
        const base = (i * profileCount + j) * 3

        // Profile tangent (dr/dy direction along profile)
        const jPrev = Math.max(0, j - 1)
        const jNext = Math.min(profileCount - 1, j + 1)
        const dr = points[jNext].x - points[jPrev].x
        const dy = points[jNext].y - points[jPrev].y

        // Tangent along profile in world space (rotated by segment angle)
        const tx = dr * cosArr[i]
        const ty = dy
        const tz = dr * sinArr[i]

        // Tangent along the lathe ring (perpendicular to profile tangent in the XZ plane)
        const lx = -sinArr[i]
        const ly = 0
        const lz = cosArr[i]

        // Normal = cross(lathetangent, profiletangent)
        let nx = ly * tz - lz * ty
        let ny = lz * tx - lx * tz
        let nz = lx * ty - ly * tx
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
        if (len > 0) {
          nx /= len
          ny /= len
          nz /= len
        }

        normals[base] = nx
        normals[base + 1] = ny
        normals[base + 2] = nz
      }
    }

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < profileCount - 1; j++) {
        const a = i * profileCount + j
        const b = (i + 1) * profileCount + j
        const c = (i + 1) * profileCount + j + 1
        const d = i * profileCount + j + 1
        indices.push(a, b, d)
        indices.push(b, c, d)
      }
    }

    this.setAttribute('position', new BufferAttribute(positions, 3))
    this.setAttribute('normal', new BufferAttribute(normals, 3))
    this.setAttribute('uv', new BufferAttribute(uvs, 2))
    this.setIndex(indices)
  }
}
