import { BufferAttribute, BufferGeometry } from './BufferGeometry';

export class BoxGeometry extends BufferGeometry {
  constructor(
    width  = 1,
    height = 1,
    depth  = 1,
    widthSegments  = 1,
    heightSegments = 1,
    depthSegments  = 1,
  ) {
    super();

    widthSegments  = Math.floor(widthSegments);
    heightSegments = Math.floor(heightSegments);
    depthSegments  = Math.floor(depthSegments);

    const positions: number[] = [];
    const normals:   number[] = [];
    const uvs:       number[] = [];
    const indices:   number[] = [];

    let vertexOffset = 0;
    let groupStart   = 0;

    const buildFace = (
      u: 'x' | 'y' | 'z',
      v: 'x' | 'y' | 'z',
      w: 'x' | 'y' | 'z',
      uDir: number,
      vDir: number,
      width: number,
      height: number,
      depth: number,
      gridX: number,
      gridY: number,
    ) => {
      const segmentWidth  = width  / gridX;
      const segmentHeight = height / gridY;
      const widthHalf  = width  / 2;
      const heightHalf = height / 2;
      const depthHalf  = depth  / 2;

      const gridX1 = gridX + 1;
      const gridY1 = gridY + 1;
      let vertexCount = 0;

      for (let iy = 0; iy < gridY1; iy++) {
        const y = iy * segmentHeight - heightHalf;
        for (let ix = 0; ix < gridX1; ix++) {
          const x = ix * segmentWidth - widthHalf;

          const pos: Record<string, number> = { x: 0, y: 0, z: 0 };
          pos[u] = x * uDir;
          pos[v] = y * vDir;
          pos[w] = depthHalf;

          positions.push(pos['x'], pos['y'], pos['z']);

          const n: Record<string, number> = { x: 0, y: 0, z: 0 };
          n[w] = depth > 0 ? 1 : -1;
          normals.push(n['x'], n['y'], n['z']);

          uvs.push(ix / gridX, 1 - iy / gridY);

          vertexCount++;
        }
      }

      for (let iy = 0; iy < gridY; iy++) {
        for (let ix = 0; ix < gridX; ix++) {
          const a = vertexOffset + ix + gridX1 * iy;
          const b = vertexOffset + ix + gridX1 * (iy + 1);
          const c = vertexOffset + (ix + 1) + gridX1 * (iy + 1);
          const d = vertexOffset + (ix + 1) + gridX1 * iy;

          indices.push(a, b, d);
          indices.push(b, c, d);
        }
      }

      const indexCount = gridX * gridY * 6;
      this.addGroup(groupStart, indexCount, this.groups.length);
      groupStart += indexCount;
      vertexOffset += vertexCount;
    };

    // +x, -x, +y, -y, +z, -z faces
    buildFace('z', 'y', 'x',  -1, -1, depth,  height, width,  depthSegments,  heightSegments);
    buildFace('z', 'y', 'x',   1, -1, depth,  height, -width, depthSegments,  heightSegments);
    buildFace('x', 'z', 'y',   1,  1, width,  depth,  height, widthSegments,  depthSegments);
    buildFace('x', 'z', 'y',   1, -1, width,  depth,  -height, widthSegments, depthSegments);
    buildFace('x', 'y', 'z',   1, -1, width,  height, depth,  widthSegments,  heightSegments);
    buildFace('x', 'y', 'z',  -1, -1, width,  height, -depth, widthSegments,  heightSegments);

    this.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    this.setAttribute('normal',   new BufferAttribute(new Float32Array(normals),   3));
    this.setAttribute('uv',       new BufferAttribute(new Float32Array(uvs),       2));
    this.setIndex(indices);
  }
}
