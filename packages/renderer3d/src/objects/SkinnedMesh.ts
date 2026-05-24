import { Mat4 } from '../math';
import { BufferGeometry } from '../geometry';
import { Material } from '../material';
import { Mesh } from './Mesh';
import { Skeleton } from './Skeleton';

export class SkinnedMesh extends Mesh {
  readonly isSkinnedMesh = true as const;
  skeleton: Skeleton | null;
  bindMode: 'attached' | 'detached';
  bindMatrix: Mat4;
  bindMatrixInverse: Mat4;

  constructor(geometry: BufferGeometry, material: Material | Material[]) {
    super(geometry, material);
    this.skeleton = null;
    this.bindMode = 'attached';
    this.bindMatrix = new Mat4();
    this.bindMatrixInverse = new Mat4();
  }

  bind(skeleton: Skeleton, bindMatrix?: Mat4): void {
    this.skeleton = skeleton;

    if (bindMatrix === undefined) {
      this.updateMatrixWorld(true);
      bindMatrix = this.matrixWorld;
    }

    this.bindMatrix.copy(bindMatrix);
    this.bindMatrixInverse.copy(bindMatrix).invert();
  }

  pose(): void {
    this.skeleton?.pose();
  }

  normalizeSkinWeights(): void {
    const weightAttr = this.geometry.getAttribute('skinWeight');
    if (!weightAttr) return;

    for (let i = 0; i < weightAttr.count; i++) {
      const x = weightAttr.getX(i);
      const y = weightAttr.getY(i);
      const z = weightAttr.getZ(i);
      const w = weightAttr.getW(i);
      const sum = x + y + z + w;
      if (sum > 0) {
        const inv = 1 / sum;
        weightAttr.setXYZW(i, x * inv, y * inv, z * inv, w * inv);
      } else {
        // Degenerate vertex — assign all weight to first joint so the mesh
        // doesn't disappear rather than silently producing NaN.
        weightAttr.setXYZW(i, 1, 0, 0, 0);
      }
    }
    weightAttr.needsUpdate = true;
  }
}
