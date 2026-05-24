import { Vec3, Mat4 } from '../math';
import { BufferGeometry, BufferAttribute } from '../geometry';
import { Material } from '../material';
import { Mesh } from './Mesh';

export class InstancedMesh extends Mesh {
  readonly isInstancedMesh = true as const;
  count: number;
  instanceMatrix: BufferAttribute;
  instanceColor: BufferAttribute | null;

  constructor(geometry: BufferGeometry, material: Material | Material[], count: number) {
    super(geometry, material);
    this.count = count;

    const matrixData = new Float32Array(count * 16);
    // Initialise every instance to identity so unset instances are valid.
    for (let i = 0; i < count; i++) {
      matrixData[i * 16]      = 1;
      matrixData[i * 16 + 5]  = 1;
      matrixData[i * 16 + 10] = 1;
      matrixData[i * 16 + 15] = 1;
    }
    this.instanceMatrix = new BufferAttribute(matrixData, 16);
    this.instanceMatrix.usage = 35048; // DYNAMIC_DRAW

    this.instanceColor = null;
  }

  setMatrixAt(index: number, matrix: Mat4): void {
    (this.instanceMatrix.data as Float32Array).set(matrix.elements, index * 16);
  }

  getMatrixAt(index: number, target: Mat4): void {
    target.fromArray(this.instanceMatrix.data, index * 16);
  }

  setColorAt(index: number, color: Vec3): void {
    if (this.instanceColor === null) {
      const data = new Float32Array(this.count * 3);
      this.instanceColor = new BufferAttribute(data, 3);
      this.instanceColor.usage = 35048; // DYNAMIC_DRAW
    }
    this.instanceColor.setXYZ(index, color.x, color.y, color.z);
  }

  getColorAt(index: number, target: Vec3): void {
    if (this.instanceColor === null) {
      target.set(1, 1, 1);
      return;
    }
    target.set(
      this.instanceColor.getX(index),
      this.instanceColor.getY(index),
      this.instanceColor.getZ(index),
    );
  }
}
