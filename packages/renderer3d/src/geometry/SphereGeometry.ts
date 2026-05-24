import { BufferAttribute, BufferGeometry } from './BufferGeometry';

export class SphereGeometry extends BufferGeometry {
  constructor(
    radius         = 1,
    widthSegments  = 32,
    heightSegments = 16,
    phiStart       = 0,
    phiLength      = Math.PI * 2,
    thetaStart     = 0,
    thetaLength    = Math.PI,
  ) {
    super();

    widthSegments  = Math.max(3, Math.floor(widthSegments));
    heightSegments = Math.max(2, Math.floor(heightSegments));

    const thetaEnd = Math.min(thetaStart + thetaLength, Math.PI);

    const positions: number[] = [];
    const normals:   number[] = [];
    const uvs:       number[] = [];
    const indices:   number[] = [];

    // grid[iy][ix] = vertex index
    const grid: number[][] = [];

    let index = 0;

    for (let iy = 0; iy <= heightSegments; iy++) {
      const row: number[] = [];
      const v = iy / heightSegments;
      let uOffset = 0;
      if (iy === 0 && thetaStart === 0) uOffset = 0.5 / widthSegments;
      else if (iy === heightSegments && thetaEnd === Math.PI) uOffset = -0.5 / widthSegments;

      for (let ix = 0; ix <= widthSegments; ix++) {
        const u = ix / widthSegments;
        const phi   = phiStart   + u * phiLength;
        const theta = thetaStart + v * thetaLength;

        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        const sinPhi   = Math.sin(phi);
        const cosPhi   = Math.cos(phi);

        const nx = cosPhi * sinTheta;
        const ny = cosTheta;
        const nz = sinPhi * sinTheta;

        positions.push(radius * nx, radius * ny, radius * nz);
        normals.push(nx, ny, nz);
        uvs.push(u + uOffset, 1 - v);

        row.push(index++);
      }
      grid.push(row);
    }

    for (let iy = 0; iy < heightSegments; iy++) {
      for (let ix = 0; ix < widthSegments; ix++) {
        const a = grid[iy][ix + 1];
        const b = grid[iy][ix];
        const c = grid[iy + 1][ix];
        const d = grid[iy + 1][ix + 1];

        if (iy !== 0 || thetaStart > 0) indices.push(a, b, d);
        if (iy !== heightSegments - 1 || thetaEnd < Math.PI) indices.push(b, c, d);
      }
    }

    this.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    this.setAttribute('normal',   new BufferAttribute(new Float32Array(normals),   3));
    this.setAttribute('uv',       new BufferAttribute(new Float32Array(uvs),       2));
    this.setIndex(indices);
  }
}
