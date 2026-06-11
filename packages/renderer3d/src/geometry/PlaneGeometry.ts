import { BufferAttribute, BufferGeometry } from './BufferGeometry'

export class PlaneGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, widthSegments = 1, heightSegments = 1) {
    super()

    widthSegments = Math.floor(widthSegments)
    heightSegments = Math.floor(heightSegments)

    const segW = width / widthSegments
    const segH = height / heightSegments
    const halfW = width / 2
    const halfH = height / 2

    const gridX1 = widthSegments + 1
    const gridY1 = heightSegments + 1

    const vertCount = gridX1 * gridY1
    const positions = new Float32Array(vertCount * 3)
    const normalsArr = new Float32Array(vertCount * 3)
    const uvsArr = new Float32Array(vertCount * 2)
    const indices: number[] = []

    let vi = 0
    let ui = 0
    for (let iy = 0; iy < gridY1; iy++) {
      const z = iy * segH - halfH
      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segW - halfW

        positions[vi] = x
        positions[vi + 1] = 0
        positions[vi + 2] = z

        normalsArr[vi] = 0
        normalsArr[vi + 1] = 1
        normalsArr[vi + 2] = 0

        uvsArr[ui] = ix / widthSegments
        uvsArr[ui + 1] = 1 - iy / heightSegments

        vi += 3
        ui += 2
      }
    }

    for (let iy = 0; iy < heightSegments; iy++) {
      for (let ix = 0; ix < widthSegments; ix++) {
        const a = ix + gridX1 * iy
        const b = ix + gridX1 * (iy + 1)
        const c = ix + 1 + gridX1 * (iy + 1)
        const d = ix + 1 + gridX1 * iy

        indices.push(a, b, d)
        indices.push(b, c, d)
      }
    }

    this.setAttribute('position', new BufferAttribute(positions, 3))
    this.setAttribute('normal', new BufferAttribute(normalsArr, 3))
    this.setAttribute('uv', new BufferAttribute(uvsArr, 2))
    this.setIndex(indices)
  }
}
