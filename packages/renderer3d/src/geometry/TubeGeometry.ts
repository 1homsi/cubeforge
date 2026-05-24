import { Vec3 } from '../math'
import { BufferGeometry, BufferAttribute } from './BufferGeometry'

// Builds an orthonormal frame (normal + binormal) along each path point using the
// Frenet-Serret method. When the tangent is parallel to Vec3.UP we fall back to
// Vec3.RIGHT so the frame never collapses.
function buildFrenetFrames(path: Vec3[], _closed: boolean): { tangents: Vec3[]; normals: Vec3[]; binormals: Vec3[] } {
  const n = path.length
  const tangents: Vec3[] = new Array(n)
  const normals: Vec3[] = new Array(n)
  const binormals: Vec3[] = new Array(n)

  for (let i = 0; i < n; i++) {
    const prev = path[Math.max(0, i - 1)]
    const next = path[Math.min(n - 1, i + 1)]
    const t = new Vec3(next.x - prev.x, next.y - prev.y, next.z - prev.z).normalize()
    tangents[i] = t
  }

  // Initial normal: choose an up vector not parallel to the first tangent
  const t0 = tangents[0]
  const up = Math.abs(t0.y) < 0.9 ? new Vec3(0, 1, 0) : new Vec3(1, 0, 0)
  const n0 = new Vec3(up.y * t0.z - up.z * t0.y, up.z * t0.x - up.x * t0.z, up.x * t0.y - up.y * t0.x).normalize()
  normals[0] = n0
  binormals[0] = new Vec3(t0.y * n0.z - t0.z * n0.y, t0.z * n0.x - t0.x * n0.z, t0.x * n0.y - t0.y * n0.x).normalize()

  for (let i = 1; i < n; i++) {
    const tPrev = tangents[i - 1]
    const tCurr = tangents[i]

    // Rotate previous normal by the angle between consecutive tangents
    const cross = new Vec3(
      tPrev.y * tCurr.z - tPrev.z * tCurr.y,
      tPrev.z * tCurr.x - tPrev.x * tCurr.z,
      tPrev.x * tCurr.y - tPrev.y * tCurr.x,
    )
    const sinLen = cross.length()
    const cosAngle = Math.max(-1, Math.min(1, tPrev.dot(tCurr)))

    let rotated: Vec3
    if (sinLen < 1e-8) {
      rotated = normals[i - 1].clone()
    } else {
      const axis = cross.scale(1 / sinLen)
      // Rodrigues rotation of the previous normal around `axis` by `angle`
      const angle = Math.atan2(sinLen, cosAngle)
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      const t = 1 - c
      const nPrev = normals[i - 1]
      const ax = axis.x,
        ay = axis.y,
        az = axis.z
      const nx = nPrev.x,
        ny = nPrev.y,
        nz = nPrev.z
      rotated = new Vec3(
        (t * ax * ax + c) * nx + (t * ax * ay - s * az) * ny + (t * ax * az + s * ay) * nz,
        (t * ax * ay + s * az) * nx + (t * ay * ay + c) * ny + (t * ay * az - s * ax) * nz,
        (t * ax * az - s * ay) * nx + (t * ay * az + s * ax) * ny + (t * az * az + c) * nz,
      ).normalize()
    }

    normals[i] = rotated
    const tc = tCurr
    binormals[i] = new Vec3(
      tc.y * rotated.z - tc.z * rotated.y,
      tc.z * rotated.x - tc.x * rotated.z,
      tc.x * rotated.y - tc.y * rotated.x,
    ).normalize()
  }

  return { tangents, normals, binormals }
}

export class TubeGeometry extends BufferGeometry {
  constructor(path: Vec3[], tubularSegments = 64, radius = 1, radialSegments = 8, closed = false) {
    super()

    if (path.length < 2) throw new Error('TubeGeometry requires at least 2 path points')

    const { normals, binormals } = buildFrenetFrames(path, closed)

    const vertexCount = (tubularSegments + 1) * (radialSegments + 1)
    const positions = new Float32Array(vertexCount * 3)
    const normalsArr = new Float32Array(vertexCount * 3)
    const uvs = new Float32Array(vertexCount * 2)
    const indices: number[] = []

    let vi = 0
    let ui = 0

    for (let i = 0; i <= tubularSegments; i++) {
      // Map tube segment index to path point index
      const pathIndex = closed ? i % path.length : Math.round((i / tubularSegments) * (path.length - 1))

      const center = path[pathIndex]
      const normal = normals[pathIndex]
      const binormal = binormals[pathIndex]

      for (let j = 0; j <= radialSegments; j++) {
        const angle = (j / radialSegments) * Math.PI * 2
        const cosA = Math.cos(angle)
        const sinA = Math.sin(angle)

        // Point on the tube cross-section circle
        const nx = normal.x * cosA + binormal.x * sinA
        const ny = normal.y * cosA + binormal.y * sinA
        const nz = normal.z * cosA + binormal.z * sinA

        positions[vi] = center.x + radius * nx
        positions[vi + 1] = center.y + radius * ny
        positions[vi + 2] = center.z + radius * nz
        vi += 3

        normalsArr[vi - 3] = nx
        normalsArr[vi - 2] = ny
        normalsArr[vi - 1] = nz

        uvs[ui++] = i / tubularSegments
        uvs[ui++] = j / radialSegments
      }
    }

    // Stitch quads between adjacent ring pairs
    for (let i = 0; i < tubularSegments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = (radialSegments + 1) * i + j
        const b = (radialSegments + 1) * (i + 1) + j
        const c = (radialSegments + 1) * (i + 1) + j + 1
        const d = (radialSegments + 1) * i + j + 1
        indices.push(a, b, d)
        indices.push(b, c, d)
      }
    }

    this.setAttribute('position', new BufferAttribute(positions, 3))
    this.setAttribute('normal', new BufferAttribute(normalsArr, 3))
    this.setAttribute('uv', new BufferAttribute(uvs, 2))
    this.setIndex(indices)
  }
}
