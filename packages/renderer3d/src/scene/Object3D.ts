import { Vec3 } from '../math';
import { Quat } from '../math';
import { Mat4 } from '../math';

let _idCounter = 0;

const _xAxis = new Vec3(1, 0, 0);
const _yAxis = new Vec3(0, 1, 0);
const _zAxis = new Vec3(0, 0, 1);
const _m1 = new Mat4();
const _q1 = new Quat();
const _v1 = new Vec3();

export class Object3D {
  readonly id: number;
  name: string;

  position: Vec3;
  quaternion: Quat;
  scale: Vec3;

  matrix: Mat4;
  matrixWorld: Mat4;
  matrixAutoUpdate: boolean;
  matrixWorldNeedsUpdate: boolean;

  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  frustumCulled: boolean;
  renderOrder: number;

  parent: Object3D | null;
  children: Object3D[];

  userData: Record<string, unknown>;

  constructor() {
    this.id = _idCounter++;
    this.name = '';

    this.position = new Vec3(0, 0, 0);
    this.quaternion = new Quat();
    this.scale = new Vec3(1, 1, 1);

    this.matrix = new Mat4();
    this.matrixWorld = new Mat4();
    this.matrixAutoUpdate = true;
    this.matrixWorldNeedsUpdate = false;

    this.visible = true;
    this.castShadow = false;
    this.receiveShadow = false;
    this.frustumCulled = true;
    this.renderOrder = 0;

    this.parent = null;
    this.children = [];

    this.userData = {};
  }

  add(...objects: Object3D[]): this {
    for (const obj of objects) {
      if (obj === this) continue;
      if (obj.parent !== null) {
        obj.parent.remove(obj);
      }
      obj.parent = this;
      this.children.push(obj);
    }
    return this;
  }

  remove(...objects: Object3D[]): this {
    for (const obj of objects) {
      const idx = this.children.indexOf(obj);
      if (idx !== -1) {
        obj.parent = null;
        this.children.splice(idx, 1);
      }
    }
    return this;
  }

  removeFromParent(): this {
    if (this.parent !== null) {
      this.parent.remove(this);
    }
    return this;
  }

  clear(): this {
    for (const child of this.children) {
      child.parent = null;
    }
    this.children.length = 0;
    return this;
  }

  getObjectById(id: number): Object3D | undefined {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.getObjectById(id);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  getObjectByName(name: string): Object3D | undefined {
    if (this.name === name) return this;
    for (const child of this.children) {
      const found = child.getObjectByName(name);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  traverse(cb: (obj: Object3D) => void): void {
    cb(this);
    for (const child of this.children) {
      child.traverse(cb);
    }
  }

  traverseVisible(cb: (obj: Object3D) => void): void {
    if (!this.visible) return;
    cb(this);
    for (const child of this.children) {
      child.traverseVisible(cb);
    }
  }

  updateMatrix(): void {
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.matrixWorldNeedsUpdate = true;
  }

  updateMatrixWorld(force = false): void {
    if (this.matrixAutoUpdate) this.updateMatrix();

    if (this.matrixWorldNeedsUpdate || force) {
      if (this.parent === null) {
        this.matrixWorld.copy(this.matrix);
      } else {
        this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
      }
      this.matrixWorldNeedsUpdate = false;
      force = true;
    }

    for (const child of this.children) {
      child.updateMatrixWorld(force);
    }
  }

  updateWorldMatrix(updateParents: boolean, updateChildren: boolean): void {
    if (updateParents && this.parent !== null) {
      this.parent.updateWorldMatrix(true, false);
    }

    if (this.matrixAutoUpdate) this.updateMatrix();

    if (this.parent === null) {
      this.matrixWorld.copy(this.matrix);
    } else {
      this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    }
    this.matrixWorldNeedsUpdate = false;

    if (updateChildren) {
      for (const child of this.children) {
        child.updateWorldMatrix(false, true);
      }
    }
  }

  localToWorld(v: Vec3): Vec3 {
    return v.applyMat4(this.matrixWorld);
  }

  worldToLocal(v: Vec3): Vec3 {
    return v.applyMat4(_m1.copy(this.matrixWorld).invert());
  }

  lookAt(target: Vec3): void {
    this.updateWorldMatrix(true, false);

    const position = new Vec3();
    this.matrixWorld.getPosition(position);

    _m1.lookAt(position, target, Vec3.UP as Vec3);
    this.quaternion.setFromRotationMatrix(_m1);

    if (this.parent !== null) {
      _m1.extractRotation(this.parent.matrixWorld);
      _q1.setFromRotationMatrix(_m1);
      this.quaternion.premultiply(_q1.invert());
    }
  }

  rotateOnAxis(axis: Vec3, angle: number): this {
    _q1.setFromAxisAngle(axis, angle);
    this.quaternion.multiply(_q1);
    return this;
  }

  rotateX(angle: number): this {
    return this.rotateOnAxis(_xAxis, angle);
  }

  rotateY(angle: number): this {
    return this.rotateOnAxis(_yAxis, angle);
  }

  rotateZ(angle: number): this {
    return this.rotateOnAxis(_zAxis, angle);
  }

  translateOnAxis(axis: Vec3, dist: number): this {
    _v1.set(axis.x, axis.y, axis.z).applyQuat(this.quaternion);
    this.position.x += _v1.x * dist;
    this.position.y += _v1.y * dist;
    this.position.z += _v1.z * dist;
    return this;
  }

  translateX(dist: number): this {
    return this.translateOnAxis(_xAxis, dist);
  }

  translateY(dist: number): this {
    return this.translateOnAxis(_yAxis, dist);
  }

  translateZ(dist: number): this {
    return this.translateOnAxis(_zAxis, dist);
  }

  getWorldPosition(out: Vec3): Vec3 {
    this.updateWorldMatrix(true, false);
    return this.matrixWorld.getPosition(out);
  }

  getWorldQuaternion(out: Quat): Quat {
    this.updateWorldMatrix(true, false);
    this.matrixWorld.decompose(_v1, out, new Vec3());
    return out;
  }

  getWorldScale(out: Vec3): Vec3 {
    this.updateWorldMatrix(true, false);
    this.matrixWorld.decompose(new Vec3(), _q1, out);
    return out;
  }

  getWorldDirection(out: Vec3): Vec3 {
    this.updateWorldMatrix(true, false);
    const e = this.matrixWorld.elements;
    out.set(-e[8], -e[9], -e[10]).normalize();
    return out;
  }

  clone(recursive = true): this {
    const obj = new (this.constructor as new () => this)();
    obj.name = this.name;
    obj.position.set(this.position.x, this.position.y, this.position.z);
    obj.quaternion.set(this.quaternion.x, this.quaternion.y, this.quaternion.z, this.quaternion.w);
    obj.scale.set(this.scale.x, this.scale.y, this.scale.z);
    obj.matrix.copy(this.matrix);
    obj.matrixWorld.copy(this.matrixWorld);
    obj.matrixAutoUpdate = this.matrixAutoUpdate;
    obj.matrixWorldNeedsUpdate = this.matrixWorldNeedsUpdate;
    obj.visible = this.visible;
    obj.castShadow = this.castShadow;
    obj.receiveShadow = this.receiveShadow;
    obj.frustumCulled = this.frustumCulled;
    obj.renderOrder = this.renderOrder;
    obj.userData = JSON.parse(JSON.stringify(this.userData));

    if (recursive) {
      for (const child of this.children) {
        obj.add(child.clone(true));
      }
    }

    return obj;
  }
}
