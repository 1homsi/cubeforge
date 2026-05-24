import { Mat4 } from '../math'
import { Object3D } from '../scene'

export class Bone extends Object3D {
  readonly isBone = true as const
}

const _mat = new Mat4()

export class Skeleton {
  bones: Bone[]
  boneInverses: Mat4[]
  boneMatrices: Float32Array
  boneTexture: WebGLTexture | null
  boneTextureSize: number

  constructor(bones: Bone[], boneInverses?: Mat4[]) {
    this.bones = bones.slice()
    this.boneMatrices = new Float32Array(bones.length * 16)
    this.boneTexture = null

    if (boneInverses !== undefined) {
      this.boneInverses = boneInverses
    } else {
      this.boneInverses = []
      this.calculateInverses()
    }

    this.boneTextureSize = this._computeTextureSize(bones.length)
  }

  private _computeTextureSize(boneCount: number): number {
    // Each bone needs 4 RGBA pixels (= 1 mat4 of 16 floats).
    // The texture is square, so find the smallest power-of-2 side length
    // such that side * side >= boneCount * 4.
    const needed = boneCount * 4
    let size = 1
    while (size * size < needed) size <<= 1
    return size
  }

  calculateInverses(): void {
    this.boneInverses = this.bones.map((bone) => new Mat4().copy(bone.matrixWorld).invert())
  }

  pose(): void {
    for (const bone of this.bones) {
      bone.position.set(0, 0, 0)
      bone.quaternion.set(0, 0, 0, 1)
      bone.scale.set(1, 1, 1)
    }
  }

  update(gl: WebGL2RenderingContext): void {
    const { bones, boneInverses, boneMatrices } = this

    for (let i = 0; i < bones.length; i++) {
      _mat.multiplyMatrices(bones[i].matrixWorld, boneInverses[i])
      boneMatrices.set(_mat.elements, i * 16)
    }

    if (this.boneTexture === null) {
      this.boneTexture = this._createBoneTexture(gl)
    }

    gl.bindTexture(gl.TEXTURE_2D, this.boneTexture)
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.boneTextureSize,
      this.boneTextureSize,
      gl.RGBA,
      gl.FLOAT,
      boneMatrices,
    )
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  private _createBoneTexture(gl: WebGL2RenderingContext): WebGLTexture {
    const size = this.boneTextureSize
    const tex = gl.createTexture()
    if (!tex) throw new Error('Failed to create bone texture')

    const data = new Float32Array(size * size * 4)
    data.set(this.boneMatrices)

    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, data)
    gl.bindTexture(gl.TEXTURE_2D, null)

    return tex
  }

  dispose(gl: WebGL2RenderingContext): void {
    if (this.boneTexture !== null) {
      gl.deleteTexture(this.boneTexture)
      this.boneTexture = null
    }
  }

  clone(): Skeleton {
    const bones = this.bones.map((b) => b.clone() as Bone)
    const inverses = this.boneInverses.map((m) => m.clone())
    return new Skeleton(bones, inverses)
  }
}
