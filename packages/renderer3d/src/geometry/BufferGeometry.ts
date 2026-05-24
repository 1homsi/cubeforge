import { Vec3 } from '../math/Vec3';
import { Mat4 } from '../math/Mat4';

let _geometryIdCounter = 0;

export class BufferAttribute {
  data: Float32Array | Uint16Array | Uint32Array;
  itemSize: number;
  count: number;
  normalized: boolean;
  usage: number;
  version: number;

  constructor(
    data: Float32Array | Uint16Array | Uint32Array,
    itemSize: number,
    normalized = false,
  ) {
    this.data = data;
    this.itemSize = itemSize;
    this.count = data.length / itemSize;
    this.normalized = normalized;
    this.usage = 35044; // STATIC_DRAW
    this.version = 0;
  }

  set needsUpdate(value: boolean) {
    if (value) this.version++;
  }

  getX(index: number): number { return this.data[index * this.itemSize]; }
  getY(index: number): number { return this.data[index * this.itemSize + 1]; }
  getZ(index: number): number { return this.data[index * this.itemSize + 2]; }
  getW(index: number): number { return this.data[index * this.itemSize + 3]; }

  setX(index: number, x: number): this {
    this.data[index * this.itemSize] = x;
    return this;
  }
  setY(index: number, y: number): this {
    this.data[index * this.itemSize + 1] = y;
    return this;
  }
  setZ(index: number, z: number): this {
    this.data[index * this.itemSize + 2] = z;
    return this;
  }
  setW(index: number, w: number): this {
    this.data[index * this.itemSize + 3] = w;
    return this;
  }

  setXYZ(index: number, x: number, y: number, z: number): this {
    const i = index * this.itemSize;
    this.data[i]     = x;
    this.data[i + 1] = y;
    this.data[i + 2] = z;
    return this;
  }

  setXYZW(index: number, x: number, y: number, z: number, w: number): this {
    const i = index * this.itemSize;
    this.data[i]     = x;
    this.data[i + 1] = y;
    this.data[i + 2] = z;
    this.data[i + 3] = w;
    return this;
  }

  copyAt(index1: number, source: BufferAttribute, index2: number): this {
    const i1 = index1 * this.itemSize;
    const i2 = index2 * source.itemSize;
    for (let k = 0; k < this.itemSize; k++) {
      (this.data as Float32Array)[i1 + k] = (source.data as Float32Array)[i2 + k];
    }
    return this;
  }

  clone(): BufferAttribute {
    const DataCtor = this.data.constructor as new (n: number) => typeof this.data;
    const copy = new DataCtor(this.data.length);
    (copy as Float32Array).set(this.data as Float32Array);
    const attr = new BufferAttribute(copy, this.itemSize, this.normalized);
    attr.usage = this.usage;
    attr.version = this.version;
    return attr;
  }
}

export class BufferGeometry {
  readonly id: number;
  name: string;
  attributes: Map<string, BufferAttribute>;
  index: BufferAttribute | null;
  drawRange: { start: number; count: number };
  boundingBox: { min: Vec3; max: Vec3 } | null;
  boundingSphere: { center: Vec3; radius: number } | null;
  morphAttributes: Map<string, BufferAttribute[]>;
  groups: Array<{ start: number; count: number; materialIndex: number }>;

  constructor() {
    this.id = ++_geometryIdCounter;
    this.name = '';
    this.attributes = new Map();
    this.index = null;
    this.drawRange = { start: 0, count: Infinity };
    this.boundingBox = null;
    this.boundingSphere = null;
    this.morphAttributes = new Map();
    this.groups = [];
  }

  setAttribute(name: string, attribute: BufferAttribute): this {
    this.attributes.set(name, attribute);
    return this;
  }

  getAttribute(name: string): BufferAttribute | undefined {
    return this.attributes.get(name);
  }

  deleteAttribute(name: string): this {
    this.attributes.delete(name);
    return this;
  }

  setIndex(index: number[] | BufferAttribute): this {
    if (index instanceof BufferAttribute) {
      this.index = index;
    } else {
      const maxVal = index.length > 0 ? Math.max(...index) : 0;
      const data = maxVal > 65535
        ? new Uint32Array(index)
        : new Uint16Array(index);
      this.index = new BufferAttribute(data, 1);
    }
    return this;
  }

  addGroup(start: number, count: number, materialIndex = 0): void {
    this.groups.push({ start, count, materialIndex });
  }

  clearGroups(): void {
    this.groups = [];
  }

  computeBoundingBox(): void {
    const position = this.getAttribute('position');
    if (!position) {
      this.boundingBox = {
        min: new Vec3(0, 0, 0),
        max: new Vec3(0, 0, 0),
      };
      return;
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    this.boundingBox = {
      min: new Vec3(minX, minY, minZ),
      max: new Vec3(maxX, maxY, maxZ),
    };
  }

  computeBoundingSphere(): void {
    const position = this.getAttribute('position');
    if (!position) {
      this.boundingSphere = { center: new Vec3(), radius: 0 };
      return;
    }

    if (!this.boundingBox) this.computeBoundingBox();
    const box = this.boundingBox!;
    const center = new Vec3(
      (box.min.x + box.max.x) * 0.5,
      (box.min.y + box.max.y) * 0.5,
      (box.min.z + box.max.z) * 0.5,
    );

    let maxRadiusSq = 0;
    for (let i = 0; i < position.count; i++) {
      const dx = position.getX(i) - center.x;
      const dy = position.getY(i) - center.y;
      const dz = position.getZ(i) - center.z;
      const rSq = dx * dx + dy * dy + dz * dz;
      if (rSq > maxRadiusSq) maxRadiusSq = rSq;
    }

    this.boundingSphere = { center, radius: Math.sqrt(maxRadiusSq) };
  }

  computeVertexNormals(): void {
    const position = this.getAttribute('position');
    if (!position) return;

    const normalData = new Float32Array(position.count * 3);
    const normals = new BufferAttribute(normalData, 3);

    const pA = new Vec3(), pB = new Vec3(), pC = new Vec3();
    const cb = new Vec3(), ab = new Vec3();

    if (this.index) {
      const idx = this.index;
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i);
        const b = idx.getX(i + 1);
        const c = idx.getX(i + 2);

        pA.set(position.getX(a), position.getY(a), position.getZ(a));
        pB.set(position.getX(b), position.getY(b), position.getZ(b));
        pC.set(position.getX(c), position.getY(c), position.getZ(c));

        cb.set(pC.x - pB.x, pC.y - pB.y, pC.z - pB.z);
        ab.set(pA.x - pB.x, pA.y - pB.y, pA.z - pB.z);
        cb.cross(ab);

        normalData[a * 3]     += cb.x;
        normalData[a * 3 + 1] += cb.y;
        normalData[a * 3 + 2] += cb.z;
        normalData[b * 3]     += cb.x;
        normalData[b * 3 + 1] += cb.y;
        normalData[b * 3 + 2] += cb.z;
        normalData[c * 3]     += cb.x;
        normalData[c * 3 + 1] += cb.y;
        normalData[c * 3 + 2] += cb.z;
      }
    } else {
      for (let i = 0; i < position.count; i += 3) {
        pA.set(position.getX(i),     position.getY(i),     position.getZ(i));
        pB.set(position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1));
        pC.set(position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2));

        cb.set(pC.x - pB.x, pC.y - pB.y, pC.z - pB.z);
        ab.set(pA.x - pB.x, pA.y - pB.y, pA.z - pB.z);
        cb.cross(ab);

        normalData[i * 3]         = cb.x;
        normalData[i * 3 + 1]     = cb.y;
        normalData[i * 3 + 2]     = cb.z;
        normalData[(i + 1) * 3]   = cb.x;
        normalData[(i + 1) * 3 + 1] = cb.y;
        normalData[(i + 1) * 3 + 2] = cb.z;
        normalData[(i + 2) * 3]   = cb.x;
        normalData[(i + 2) * 3 + 1] = cb.y;
        normalData[(i + 2) * 3 + 2] = cb.z;
      }
    }

    for (let i = 0; i < position.count; i++) {
      const ix = i * 3;
      const nx = normalData[ix], ny = normalData[ix + 1], nz = normalData[ix + 2];
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len > 0) {
        normalData[ix]     /= len;
        normalData[ix + 1] /= len;
        normalData[ix + 2] /= len;
      }
    }

    this.setAttribute('normal', normals);
  }

  computeTangents(): void {
    const position = this.getAttribute('position');
    const normal   = this.getAttribute('normal');
    const uv       = this.getAttribute('uv');
    if (!position || !normal || !uv) return;

    const vertCount = position.count;
    const tan1 = new Float32Array(vertCount * 3);
    const tan2 = new Float32Array(vertCount * 3);

    const triangleCount = this.index ? this.index.count / 3 : vertCount / 3;

    for (let i = 0; i < triangleCount; i++) {
      let ia: number, ib: number, ic: number;
      if (this.index) {
        ia = this.index.getX(i * 3);
        ib = this.index.getX(i * 3 + 1);
        ic = this.index.getX(i * 3 + 2);
      } else {
        ia = i * 3;
        ib = i * 3 + 1;
        ic = i * 3 + 2;
      }

      const x1 = position.getX(ib) - position.getX(ia);
      const x2 = position.getX(ic) - position.getX(ia);
      const y1 = position.getY(ib) - position.getY(ia);
      const y2 = position.getY(ic) - position.getY(ia);
      const z1 = position.getZ(ib) - position.getZ(ia);
      const z2 = position.getZ(ic) - position.getZ(ia);

      const s1 = uv.getX(ib) - uv.getX(ia);
      const s2 = uv.getX(ic) - uv.getX(ia);
      const t1 = uv.getY(ib) - uv.getY(ia);
      const t2 = uv.getY(ic) - uv.getY(ia);

      const det = s1 * t2 - s2 * t1;
      const r = det !== 0 ? 1.0 / det : 0;

      const sdirX = (t2 * x1 - t1 * x2) * r;
      const sdirY = (t2 * y1 - t1 * y2) * r;
      const sdirZ = (t2 * z1 - t1 * z2) * r;

      const tdirX = (s1 * x2 - s2 * x1) * r;
      const tdirY = (s1 * y2 - s2 * y1) * r;
      const tdirZ = (s1 * z2 - s2 * z1) * r;

      tan1[ia * 3]     += sdirX; tan1[ia * 3 + 1] += sdirY; tan1[ia * 3 + 2] += sdirZ;
      tan1[ib * 3]     += sdirX; tan1[ib * 3 + 1] += sdirY; tan1[ib * 3 + 2] += sdirZ;
      tan1[ic * 3]     += sdirX; tan1[ic * 3 + 1] += sdirY; tan1[ic * 3 + 2] += sdirZ;

      tan2[ia * 3]     += tdirX; tan2[ia * 3 + 1] += tdirY; tan2[ia * 3 + 2] += tdirZ;
      tan2[ib * 3]     += tdirX; tan2[ib * 3 + 1] += tdirY; tan2[ib * 3 + 2] += tdirZ;
      tan2[ic * 3]     += tdirX; tan2[ic * 3 + 1] += tdirY; tan2[ic * 3 + 2] += tdirZ;
    }

    const tangentData = new Float32Array(vertCount * 4);

    for (let i = 0; i < vertCount; i++) {
      const nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i);

      const tx = tan1[i * 3], ty = tan1[i * 3 + 1], tz = tan1[i * 3 + 2];

      // Gram-Schmidt orthogonalization
      const dot = nx * tx + ny * ty + nz * tz;
      let ox = tx - dot * nx;
      let oy = ty - dot * ny;
      let oz = tz - dot * nz;
      const len = Math.sqrt(ox * ox + oy * oy + oz * oz);
      if (len > 0) { ox /= len; oy /= len; oz /= len; }

      // Handedness: (n x t) . t2 < 0 => -1
      const cx = ny * tz - nz * ty;
      const cy = nz * tx - nx * tz;
      const cz = nx * ty - ny * tx;
      const dot2 = cx * tan2[i * 3] + cy * tan2[i * 3 + 1] + cz * tan2[i * 3 + 2];
      const w = dot2 < 0 ? -1 : 1;

      tangentData[i * 4]     = ox;
      tangentData[i * 4 + 1] = oy;
      tangentData[i * 4 + 2] = oz;
      tangentData[i * 4 + 3] = w;
    }

    this.setAttribute('tangent', new BufferAttribute(tangentData, 4));
  }

  applyMatrix4(m: Mat4): this {
    const position = this.getAttribute('position');
    if (position) {
      for (let i = 0; i < position.count; i++) {
        const v = new Vec3(position.getX(i), position.getY(i), position.getZ(i));
        v.applyMat4(m);
        position.setXYZ(i, v.x, v.y, v.z);
      }
      position.needsUpdate = true;
    }

    const normalMatrix = new Mat4().copy(m).invert().transpose();

    const normalAttr = this.getAttribute('normal');
    if (normalAttr) {
      const e = normalMatrix.elements;
      for (let i = 0; i < normalAttr.count; i++) {
        const nx = normalAttr.getX(i), ny = normalAttr.getY(i), nz = normalAttr.getZ(i);
        let ox = e[0]*nx + e[4]*ny + e[8]*nz;
        let oy = e[1]*nx + e[5]*ny + e[9]*nz;
        let oz = e[2]*nx + e[6]*ny + e[10]*nz;
        const len = Math.sqrt(ox*ox + oy*oy + oz*oz);
        if (len > 0) { ox /= len; oy /= len; oz /= len; }
        normalAttr.setXYZ(i, ox, oy, oz);
      }
      normalAttr.needsUpdate = true;
    }

    const tangentAttr = this.getAttribute('tangent');
    if (tangentAttr) {
      const e = normalMatrix.elements;
      for (let i = 0; i < tangentAttr.count; i++) {
        const tx = tangentAttr.getX(i), ty = tangentAttr.getY(i), tz = tangentAttr.getZ(i);
        let ox = e[0]*tx + e[4]*ty + e[8]*tz;
        let oy = e[1]*tx + e[5]*ty + e[9]*tz;
        let oz = e[2]*tx + e[6]*ty + e[10]*tz;
        const len = Math.sqrt(ox*ox + oy*oy + oz*oz);
        if (len > 0) { ox /= len; oy /= len; oz /= len; }
        tangentAttr.setXYZ(i, ox, oy, oz);
      }
      tangentAttr.needsUpdate = true;
    }

    this.boundingBox = null;
    this.boundingSphere = null;
    return this;
  }

  translate(x: number, y: number, z: number): this {
    return this.applyMatrix4(new Mat4().makeTranslation(x, y, z));
  }

  scale(x: number, y: number, z: number): this {
    return this.applyMatrix4(new Mat4().makeScale(x, y, z));
  }

  rotateX(angle: number): this {
    return this.applyMatrix4(new Mat4().makeRotationX(angle));
  }

  rotateY(angle: number): this {
    return this.applyMatrix4(new Mat4().makeRotationY(angle));
  }

  rotateZ(angle: number): this {
    return this.applyMatrix4(new Mat4().makeRotationZ(angle));
  }

  center(): this {
    this.computeBoundingBox();
    const box = this.boundingBox!;
    const cx = -(box.min.x + box.max.x) * 0.5;
    const cy = -(box.min.y + box.max.y) * 0.5;
    const cz = -(box.min.z + box.max.z) * 0.5;
    return this.translate(cx, cy, cz);
  }

  dispose(): void {
    this.attributes.clear();
    this.morphAttributes.clear();
    this.index = null;
    this.groups = [];
    this.boundingBox = null;
    this.boundingSphere = null;
  }

  clone(): BufferGeometry {
    const geo = new BufferGeometry();
    geo.name = this.name;
    for (const [name, attr] of this.attributes) {
      geo.setAttribute(name, attr.clone());
    }
    if (this.index) geo.index = this.index.clone();
    geo.drawRange = { ...this.drawRange };
    for (const [name, attrs] of this.morphAttributes) {
      geo.morphAttributes.set(name, attrs.map(a => a.clone()));
    }
    geo.groups = this.groups.map(g => ({ ...g }));
    if (this.boundingBox) {
      geo.boundingBox = {
        min: this.boundingBox.min.clone(),
        max: this.boundingBox.max.clone(),
      };
    }
    if (this.boundingSphere) {
      geo.boundingSphere = {
        center: this.boundingSphere.center.clone(),
        radius: this.boundingSphere.radius,
      };
    }
    return geo;
  }

  merge(geometry: BufferGeometry, offset = 0): this {
    for (const [name, srcAttr] of geometry.attributes) {
      const dstAttr = this.getAttribute(name);
      if (!dstAttr) continue;

      const itemSize = dstAttr.itemSize;
      for (let i = 0; i < srcAttr.count; i++) {
        const dstIdx = offset + i;
        if (dstIdx >= dstAttr.count) break;
        for (let k = 0; k < itemSize; k++) {
          (dstAttr.data as Float32Array)[dstIdx * itemSize + k] =
            (srcAttr.data as Float32Array)[i * itemSize + k];
        }
      }
      dstAttr.needsUpdate = true;
    }
    return this;
  }
}
