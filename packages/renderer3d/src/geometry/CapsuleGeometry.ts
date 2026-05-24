import { BufferGeometry, BufferAttribute } from './BufferGeometry'

export class CapsuleGeometry extends BufferGeometry {
  constructor(radius = 0.5, length = 1, capSegments = 4, radialSegments = 8) {
    super()

    // Total latitude bands: capSegments for bottom cap, capSegments for top cap.
    // The cylinder body is represented by a single band between the two hemispheres.
    // Vertex rows: bottom pole + capSegments rows for bottom hemisphere,
    //              1 row cylinder seam, capSegments rows for top hemisphere + top pole.
    // We generate both hemispheres as uniform latitude slices and the cylinder body
    // as a zero-height (but separate UV) band in between.

    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    const halfLen = length / 2

    function pushVertex(
      x: number,
      y: number,
      z: number,
      nx: number,
      ny: number,
      nz: number,
      u: number,
      v: number,
    ): void {
      positions.push(x, y, z)
      normals.push(nx, ny, nz)
      uvs.push(u, v)
    }

    // Total rows: capSegments bottom + 1 cylinder body + capSegments top
    // Each ring is a full circle of (radialSegments + 1) vertices
    // Poles are single vertices

    let index = 0
    const ringStart: number[] = []

    // --- Bottom hemisphere ---
    // Bottom pole
    ringStart.push(index)
    pushVertex(0, -halfLen - radius, 0, 0, -1, 0, 0.5, 0)
    index++

    for (let j = 1; j <= capSegments; j++) {
      const polar = (Math.PI / 2) * (j / capSegments) // 0..PI/2
      const sinP = Math.sin(polar)
      const cosP = Math.cos(polar)
      ringStart.push(index)
      for (let i = 0; i <= radialSegments; i++) {
        const azimuth = (i / radialSegments) * Math.PI * 2
        const nx = sinP * Math.cos(azimuth)
        const ny = -cosP
        const nz = sinP * Math.sin(azimuth)
        const x = radius * nx
        const y = -halfLen + radius * ny // hemisphere center at -halfLen
        const z = radius * nz
        const u = i / radialSegments
        const v = j / (capSegments * 2 + 1)
        pushVertex(x, y, z, nx, ny, nz, u, v)
        index++
      }
    }

    // --- Cylinder body: two rings (equator of bottom cap, equator of top cap) ---
    // Bottom equator ring (y = -halfLen)
    ringStart.push(index)
    for (let i = 0; i <= radialSegments; i++) {
      const azimuth = (i / radialSegments) * Math.PI * 2
      const nx = Math.cos(azimuth)
      const nz = Math.sin(azimuth)
      pushVertex(radius * nx, -halfLen, radius * nz, nx, 0, nz, i / radialSegments, capSegments / (capSegments * 2 + 1))
      index++
    }

    // Top equator ring (y = +halfLen)
    ringStart.push(index)
    for (let i = 0; i <= radialSegments; i++) {
      const azimuth = (i / radialSegments) * Math.PI * 2
      const nx = Math.cos(azimuth)
      const nz = Math.sin(azimuth)
      pushVertex(
        radius * nx,
        halfLen,
        radius * nz,
        nx,
        0,
        nz,
        i / radialSegments,
        (capSegments + 1) / (capSegments * 2 + 1),
      )
      index++
    }

    // --- Top hemisphere ---
    for (let j = capSegments - 1; j >= 0; j--) {
      const polar = (Math.PI / 2) * (j / capSegments)
      const sinP = Math.sin(polar)
      const cosP = Math.cos(polar)
      ringStart.push(index)
      for (let i = 0; i <= radialSegments; i++) {
        const azimuth = (i / radialSegments) * Math.PI * 2
        const nx = sinP * Math.cos(azimuth)
        const ny = cosP
        const nz = sinP * Math.sin(azimuth)
        const x = radius * nx
        const y = halfLen + radius * ny
        const z = radius * nz
        const row = capSegments + 2 + (capSegments - 1 - j)
        const v = row / (capSegments * 2 + 1)
        pushVertex(x, y, z, nx, ny, nz, i / radialSegments, v)
        index++
      }
    }

    // Top pole
    ringStart.push(index)
    pushVertex(0, halfLen + radius, 0, 0, 1, 0, 0.5, 1)
    index++

    // --- Indices ---
    // Bottom pole cap: fan from pole (index 0) to first ring
    const firstRingStart = 1 // after pole vertex
    for (let i = 0; i < radialSegments; i++) {
      indices.push(0, firstRingStart + i + 1, firstRingStart + i)
    }

    // Quad bands between all consecutive full rings
    // ringStart[0] = bottom pole (skip)
    // ringStart[1..capSegments] = bottom hemisphere rings
    // ringStart[capSegments+1] = bottom cylinder equator
    // ringStart[capSegments+2] = top cylinder equator
    // ringStart[capSegments+3..capSegments*2+2] = top hemisphere rings
    // ringStart[capSegments*2+3] = top pole (skip)

    const allRings: number[] = []
    for (let k = 1; k < ringStart.length - 1; k++) {
      allRings.push(ringStart[k])
    }

    for (let r = 0; r < allRings.length - 1; r++) {
      const rowA = allRings[r]
      const rowB = allRings[r + 1]
      for (let i = 0; i < radialSegments; i++) {
        const a = rowA + i
        const b = rowA + i + 1
        const c = rowB + i + 1
        const d = rowB + i
        indices.push(a, b, c)
        indices.push(a, c, d)
      }
    }

    // Top pole cap: fan from last full ring to top pole
    const lastRingStart = allRings[allRings.length - 1]
    const topPole = ringStart[ringStart.length - 1]
    for (let i = 0; i < radialSegments; i++) {
      indices.push(lastRingStart + i, lastRingStart + i + 1, topPole)
    }

    this.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    this.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
    this.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
    this.setIndex(indices)
  }
}
