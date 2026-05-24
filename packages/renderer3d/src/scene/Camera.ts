import { Mat4 } from '../math';
import { Object3D } from './Object3D';

function _makeFrustum(
  m: Mat4,
  left: number, right: number,
  bottom: number, top: number,
  near: number, far: number,
): void {
  const e = m.elements;
  const rl = 1 / (right - left);
  const tb = 1 / (top - bottom);
  const nf = 1 / (near - far);
  e[0]  = 2 * near * rl; e[4]  = 0;             e[8]  =  (right + left) * rl; e[12] = 0;
  e[1]  = 0;             e[5]  = 2 * near * tb; e[9]  =  (top + bottom) * tb; e[13] = 0;
  e[2]  = 0;             e[6]  = 0;             e[10] =  (far + near) * nf;   e[14] = 2 * far * near * nf;
  e[3]  = 0;             e[7]  = 0;             e[11] = -1;                    e[15] = 0;
}

export abstract class Camera extends Object3D {
  projectionMatrix: Mat4;
  projectionMatrixInverse: Mat4;
  matrixWorldInverse: Mat4;

  constructor() {
    super();
    this.projectionMatrix = new Mat4();
    this.projectionMatrixInverse = new Mat4();
    this.matrixWorldInverse = new Mat4();
  }

  abstract updateProjectionMatrix(): void;

  updateMatrixWorld(force = false): void {
    super.updateMatrixWorld(force);
    this.matrixWorldInverse.copy(this.matrixWorld).invert();
  }

  getViewMatrix(): Mat4 {
    return this.matrixWorldInverse;
  }

  getProjectionMatrix(): Mat4 {
    return this.projectionMatrix;
  }
}

export class PerspectiveCamera extends Camera {
  fov: number;
  aspect: number;
  near: number;
  far: number;

  private _viewOffset: {
    fullWidth: number;
    fullHeight: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null = null;

  constructor(fov = 60, aspect = 1, near = 0.1, far = 2000) {
    super();
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.updateProjectionMatrix();
  }

  updateProjectionMatrix(): void {
    const fovRad = (this.fov * Math.PI) / 180;

    if (this._viewOffset !== null) {
      const vo = this._viewOffset;
      const fullFovTop = Math.tan(fovRad / 2) * this.near;
      const fullFovRight = fullFovTop * (vo.fullWidth / vo.fullHeight);
      const left   = -fullFovRight + (vo.offsetX / vo.fullWidth)  * 2 * fullFovRight;
      const right  =  left         + (vo.width    / vo.fullWidth)  * 2 * fullFovRight;
      const top    =  fullFovTop   - (vo.offsetY / vo.fullHeight) * 2 * fullFovTop;
      const bottom =  top          - (vo.height   / vo.fullHeight) * 2 * fullFovTop;
      _makeFrustum(this.projectionMatrix, left, right, bottom, top, this.near, this.far);
    } else {
      this.projectionMatrix.makePerspective(fovRad, this.aspect, this.near, this.far);
    }

    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }

  setViewOffset(
    fullWidth: number,
    fullHeight: number,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number,
  ): void {
    this._viewOffset = { fullWidth, fullHeight, offsetX, offsetY, width, height };
    this.aspect = fullWidth / fullHeight;
    this.updateProjectionMatrix();
  }

  clearViewOffset(): void {
    this._viewOffset = null;
    this.updateProjectionMatrix();
  }
}

export class OrthographicCamera extends Camera {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;

  constructor(left: number, right: number, top: number, bottom: number, near = 0.1, far = 2000) {
    super();
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
    this.near = near;
    this.far = far;
    this.updateProjectionMatrix();
  }

  updateProjectionMatrix(): void {
    this.projectionMatrix.makeOrthographic(
      this.left, this.right,
      this.top, this.bottom,
      this.near, this.far,
    );
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
}
