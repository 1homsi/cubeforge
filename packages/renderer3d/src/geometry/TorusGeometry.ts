import { BufferGeometry, BufferAttribute } from './BufferGeometry'

export class TorusGeometry extends BufferGeometry {
  constructor(radius = 1, tube = 0.4, radialSegments = 12, tubularSegments = 48, arc = Math.PI * 2) {
    super()

    const vertexCount = (radialSegments + 1) * (tubularSegments + 1)
    const positions = new Float32Array(vertexCount * 3)
    const normals = new Float32Array(vertexCount * 3)
    const uvs = new Float32Array(vertexCount * 2)
    const indices: number[] = []

    let vi = 0
    let ni = 0
    let ui = 0

    for (let j = 0; j <= radialSegments; j++) {
      for (let i = 0; i <= tubularSegments; i++) {
        const u = (i / tubularSegments) * arc
        const v = (j / radialSegments) * Math.PI * 2

        const cosU = Math.cos(u)
        const sinU = Math.sin(u)
        const cosV = Math.cos(v)
        const sinV = Math.sin(v)

        const x = (radius + tube * cosV) * cosU
        const y = (radius + tube * cosV) * sinU
        const z = tube * sinV

        positions[vi++] = x
        positions[vi++] = y
        positions[vi++] = z

        // Center of the tube ring at angle u
        const cx = radius * cosU
        const cy = radius * sinU

        normals[ni++] = x - cx
        normals[ni++] = y - cy
        normals[ni++] = z

        uvs[ui++] = i / tubularSegments
        uvs[ui++] = j / radialSegments
      }
    }

    for (let j = 1; j <= radialSegments; j++) {
      for (let i = 1; i <= tubularSegments; i++) {
        const a = (tubularSegments + 1) * j + i - 1
        const b = (tubularSegments + 1) * (j - 1) + i - 1
        const c = (tubularSegments + 1) * (j - 1) + i
        const d = (tubularSegments + 1) * j + i
        indices.push(a, b, d)
        indices.push(b, c, d)
      }
    }

    // Normalize the normals attribute
    for (let i = 0; i < normals.length; i += 3) {
      const nx = normals[i],
        ny = normals[i + 1],
        nz = normals[i + 2]
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      if (len > 0) {
        normals[i] /= len
        normals[i + 1] /= len
        normals[i + 2] /= len
      }
    }

    this.setAttribute('position', new BufferAttribute(positions, 3))
    this.setAttribute('normal', new BufferAttribute(normals, 3))
    this.setAttribute('uv', new BufferAttribute(uvs, 2))
    this.setIndex(indices)
  }
}
