import { BufferAttribute, BufferGeometry } from './BufferGeometry'

export class CylinderGeometry extends BufferGeometry {
  constructor(
    radiusTop = 1,
    radiusBottom = 1,
    height = 2,
    radialSegments = 32,
    heightSegments = 1,
    openEnded = false,
    thetaStart = 0,
    thetaLength = Math.PI * 2,
  ) {
    super()

    radialSegments = Math.floor(radialSegments)
    heightSegments = Math.floor(heightSegments)

    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    let index = 0
    let groupStart = 0

    // index[iy][ix]
    const indexArray: number[][] = []

    const halfHeight = height / 2

    const buildTorso = () => {
      const slope = (radiusBottom - radiusTop) / height

      for (let iy = 0; iy <= heightSegments; iy++) {
        const row: number[] = []
        const v = iy / heightSegments
        const radius = v * (radiusBottom - radiusTop) + radiusTop

        for (let ix = 0; ix <= radialSegments; ix++) {
          const u = ix / radialSegments
          const theta = thetaStart + u * thetaLength
          const sinT = Math.sin(theta)
          const cosT = Math.cos(theta)

          positions.push(radius * sinT, -v * height + halfHeight, radius * cosT)

          const nx = sinT,
            nz = cosT
          // Normal for cone/cylinder side: perpendicular accounting for slope
          const nLen = Math.sqrt(nx * nx + slope * slope + nz * nz)
          normals.push(nx / (nLen || 1), slope / (nLen || 1), nz / (nLen || 1))

          uvs.push(u, 1 - v)
          row.push(index++)
        }
        indexArray.push(row)
      }

      for (let iy = 0; iy < heightSegments; iy++) {
        for (let ix = 0; ix < radialSegments; ix++) {
          const a = indexArray[iy][ix]
          const b = indexArray[iy + 1][ix]
          const c = indexArray[iy + 1][ix + 1]
          const d = indexArray[iy][ix + 1]

          indices.push(a, b, d)
          indices.push(b, c, d)
        }
      }

      const faceCount = radialSegments * heightSegments * 6
      this.addGroup(groupStart, faceCount, 0)
      groupStart += faceCount
    }

    const buildCap = (top: boolean) => {
      const radius = top ? radiusTop : radiusBottom
      if (radius === 0) return

      const sign = top ? 1 : -1
      const centerY = halfHeight * sign
      const centerIndex = index

      positions.push(0, centerY, 0)
      normals.push(0, sign, 0)
      uvs.push(0.5, 0.5)
      index++

      for (let ix = 0; ix <= radialSegments; ix++) {
        const u = ix / radialSegments
        const theta = thetaStart + u * thetaLength
        const sinT = Math.sin(theta)
        const cosT = Math.cos(theta)

        positions.push(radius * sinT, centerY, radius * cosT)
        normals.push(0, sign, 0)
        uvs.push(cosT * 0.5 + 0.5, sinT * 0.5 * sign + 0.5)
        index++
      }

      for (let ix = 0; ix < radialSegments; ix++) {
        const c = centerIndex
        const j = centerIndex + 1 + ix

        if (top) {
          indices.push(j, j + 1, c)
        } else {
          indices.push(j + 1, j, c)
        }
      }

      const faceCount = radialSegments * 3
      this.addGroup(groupStart, faceCount, top ? 1 : 2)
      groupStart += faceCount
    }

    buildTorso()

    if (!openEnded) {
      if (radiusTop > 0) buildCap(true)
      if (radiusBottom > 0) buildCap(false)
    }

    this.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    this.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
    this.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
    this.setIndex(indices)
  }
}
