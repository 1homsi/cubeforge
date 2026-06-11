import type { Vec3 } from './Vec3'
import type { Quat } from './Quat'

export class Mat4 {
  readonly elements: Float32Array

  constructor() {
    this.elements = new Float32Array(16)
    this.identity()
  }

  identity(): this {
    const e = this.elements
    e[0] = 1
    e[4] = 0
    e[8] = 0
    e[12] = 0
    e[1] = 0
    e[5] = 1
    e[9] = 0
    e[13] = 0
    e[2] = 0
    e[6] = 0
    e[10] = 1
    e[14] = 0
    e[3] = 0
    e[7] = 0
    e[11] = 0
    e[15] = 1
    return this
  }

  clone(): Mat4 {
    return new Mat4().fromArray(this.elements)
  }

  copy(m: Mat4): this {
    this.elements.set(m.elements)
    return this
  }

  multiply(m: Mat4): this {
    return this.multiplyMatrices(this, m)
  }

  premultiply(m: Mat4): this {
    return this.multiplyMatrices(m, this)
  }

  multiplyMatrices(a: Mat4, b: Mat4): this {
    const ae = a.elements
    const be = b.elements
    const e = this.elements

    const a00 = ae[0],
      a10 = ae[1],
      a20 = ae[2],
      a30 = ae[3]
    const a01 = ae[4],
      a11 = ae[5],
      a21 = ae[6],
      a31 = ae[7]
    const a02 = ae[8],
      a12 = ae[9],
      a22 = ae[10],
      a32 = ae[11]
    const a03 = ae[12],
      a13 = ae[13],
      a23 = ae[14],
      a33 = ae[15]

    const b00 = be[0],
      b10 = be[1],
      b20 = be[2],
      b30 = be[3]
    const b01 = be[4],
      b11 = be[5],
      b21 = be[6],
      b31 = be[7]
    const b02 = be[8],
      b12 = be[9],
      b22 = be[10],
      b32 = be[11]
    const b03 = be[12],
      b13 = be[13],
      b23 = be[14],
      b33 = be[15]

    e[0] = a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30
    e[1] = a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30
    e[2] = a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30
    e[3] = a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30

    e[4] = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31
    e[5] = a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31
    e[6] = a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31
    e[7] = a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31

    e[8] = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32
    e[9] = a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32
    e[10] = a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32
    e[11] = a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32

    e[12] = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33
    e[13] = a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33
    e[14] = a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33
    e[15] = a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33

    return this
  }

  static multiply(a: Mat4, b: Mat4): Mat4 {
    return new Mat4().multiplyMatrices(a, b)
  }

  transpose(): this {
    const e = this.elements
    let tmp: number
    tmp = e[1]
    e[1] = e[4]
    e[4] = tmp
    tmp = e[2]
    e[2] = e[8]
    e[8] = tmp
    tmp = e[3]
    e[3] = e[12]
    e[12] = tmp
    tmp = e[6]
    e[6] = e[9]
    e[9] = tmp
    tmp = e[7]
    e[7] = e[13]
    e[13] = tmp
    tmp = e[11]
    e[11] = e[14]
    e[14] = tmp
    return this
  }

  determinant(): number {
    const e = this.elements
    const n00 = e[0],
      n10 = e[1],
      n20 = e[2],
      n30 = e[3]
    const n01 = e[4],
      n11 = e[5],
      n21 = e[6],
      n31 = e[7]
    const n02 = e[8],
      n12 = e[9],
      n22 = e[10],
      n32 = e[11]
    const n03 = e[12],
      n13 = e[13],
      n23 = e[14],
      n33 = e[15]

    return (
      n30 *
        (n03 * n12 * n21 - n02 * n13 * n21 - n03 * n11 * n22 + n01 * n13 * n22 + n02 * n11 * n23 - n01 * n12 * n23) +
      n31 *
        (n00 * n12 * n23 - n00 * n13 * n22 + n03 * n10 * n22 - n02 * n10 * n23 + n02 * n13 * n20 - n03 * n12 * n20) +
      n32 *
        (n00 * n13 * n21 - n00 * n11 * n23 - n03 * n10 * n21 + n01 * n10 * n23 + n03 * n11 * n20 - n01 * n13 * n20) +
      n33 * (n00 * n11 * n22 - n00 * n12 * n21 - n01 * n10 * n22 + n02 * n10 * n21 + n01 * n12 * n20 - n02 * n11 * n20)
    )
  }

  invert(): this {
    const e = this.elements
    const n11 = e[0],
      n21 = e[1],
      n31 = e[2],
      n41 = e[3]
    const n12 = e[4],
      n22 = e[5],
      n32 = e[6],
      n42 = e[7]
    const n13 = e[8],
      n23 = e[9],
      n33 = e[10],
      n43 = e[11]
    const n14 = e[12],
      n24 = e[13],
      n34 = e[14],
      n44 = e[15]

    const t11 =
      n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44
    const t12 =
      n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44
    const t13 =
      n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44
    const t14 =
      n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34

    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14
    if (Math.abs(det) < 1e-16) return this
    const detInv = 1 / det

    e[0] = t11 * detInv
    e[1] =
      (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) *
      detInv
    e[2] =
      (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) *
      detInv
    e[3] =
      (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) *
      detInv
    e[4] = t12 * detInv
    e[5] =
      (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) *
      detInv
    e[6] =
      (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) *
      detInv
    e[7] =
      (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) *
      detInv
    e[8] = t13 * detInv
    e[9] =
      (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) *
      detInv
    e[10] =
      (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) *
      detInv
    e[11] =
      (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) *
      detInv
    e[12] = t14 * detInv
    e[13] =
      (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) *
      detInv
    e[14] =
      (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) *
      detInv
    e[15] =
      (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) *
      detInv

    return this
  }

  setPosition(x: number, y: number, z: number): this {
    this.elements[12] = x
    this.elements[13] = y
    this.elements[14] = z
    return this
  }

  getPosition(out: Vec3): Vec3 {
    out.x = this.elements[12]
    out.y = this.elements[13]
    out.z = this.elements[14]
    return out
  }

  makeTranslation(x: number, y: number, z: number): this {
    const e = this.elements
    e[0] = 1
    e[4] = 0
    e[8] = 0
    e[12] = x
    e[1] = 0
    e[5] = 1
    e[9] = 0
    e[13] = y
    e[2] = 0
    e[6] = 0
    e[10] = 1
    e[14] = z
    e[3] = 0
    e[7] = 0
    e[11] = 0
    e[15] = 1
    return this
  }

  makeRotationX(theta: number): this {
    const c = Math.cos(theta),
      s = Math.sin(theta)
    const e = this.elements
    e[0] = 1
    e[4] = 0
    e[8] = 0
    e[12] = 0
    e[1] = 0
    e[5] = c
    e[9] = -s
    e[13] = 0
    e[2] = 0
    e[6] = s
    e[10] = c
    e[14] = 0
    e[3] = 0
    e[7] = 0
    e[11] = 0
    e[15] = 1
    return this
  }

  makeRotationY(theta: number): this {
    const c = Math.cos(theta),
      s = Math.sin(theta)
    const e = this.elements
    e[0] = c
    e[4] = 0
    e[8] = s
    e[12] = 0
    e[1] = 0
    e[5] = 1
    e[9] = 0
    e[13] = 0
    e[2] = -s
    e[6] = 0
    e[10] = c
    e[14] = 0
    e[3] = 0
    e[7] = 0
    e[11] = 0
    e[15] = 1
    return this
  }

  makeRotationZ(theta: number): this {
    const c = Math.cos(theta),
      s = Math.sin(theta)
    const e = this.elements
    e[0] = c
    e[4] = -s
    e[8] = 0
    e[12] = 0
    e[1] = s
    e[5] = c
    e[9] = 0
    e[13] = 0
    e[2] = 0
    e[6] = 0
    e[10] = 1
    e[14] = 0
    e[3] = 0
    e[7] = 0
    e[11] = 0
    e[15] = 1
    return this
  }

  makeRotationFromQuaternion(q: Quat): this {
    const e = this.elements
    const x = q.x,
      y = q.y,
      z = q.z,
      w = q.w
    const x2 = x + x,
      y2 = y + y,
      z2 = z + z
    const xx = x * x2,
      xy = x * y2,
      xz = x * z2
    const yy = y * y2,
      yz = y * z2,
      zz = z * z2
    const wx = w * x2,
      wy = w * y2,
      wz = w * z2

    e[0] = 1 - (yy + zz)
    e[4] = xy - wz
    e[8] = xz + wy
    e[12] = 0
    e[1] = xy + wz
    e[5] = 1 - (xx + zz)
    e[9] = yz - wx
    e[13] = 0
    e[2] = xz - wy
    e[6] = yz + wx
    e[10] = 1 - (xx + yy)
    e[14] = 0
    e[3] = 0
    e[7] = 0
    e[11] = 0
    e[15] = 1
    return this
  }

  makeRotationFromEuler(ex: number, ey: number, ez: number, order = 'XYZ'): this {
    const cx = Math.cos(ex),
      sx = Math.sin(ex)
    const cy = Math.cos(ey),
      sy = Math.sin(ey)
    const cz = Math.cos(ez),
      sz = Math.sin(ez)
    const e = this.elements

    if (order === 'XYZ') {
      const ae = cx * cz,
        af = cx * sz,
        be = sx * cz,
        bf = sx * sz
      e[0] = cy * cz
      e[4] = cy * -sz
      e[8] = sy
      e[12] = 0
      e[1] = af + be * sy
      e[5] = ae - bf * sy
      e[9] = -sx * cy
      e[13] = 0
      e[2] = bf - ae * sy
      e[6] = be + af * sy
      e[10] = cx * cy
      e[14] = 0
    } else if (order === 'YXZ') {
      const ce = cy * cz,
        cf = cy * sz,
        de = sy * cz,
        df = sy * sz
      e[0] = ce + df * sx
      e[4] = de * sx - cf
      e[8] = cx * sy
      e[12] = 0
      e[1] = cx * sz
      e[5] = cx * cz
      e[9] = -sx
      e[13] = 0
      e[2] = cf * sx - de
      e[6] = df + ce * sx
      e[10] = cx * cy
      e[14] = 0
    } else if (order === 'ZXY') {
      const ce = cy * cz,
        cf = cy * sz,
        de = sy * cz,
        df = sy * sz
      e[0] = ce - df * sx
      e[4] = -cx * sz
      e[8] = de + cf * sx
      e[12] = 0
      e[1] = cf + de * sx
      e[5] = cx * cz
      e[9] = df - ce * sx
      e[13] = 0
      e[2] = -cx * sy
      e[6] = sx
      e[10] = cx * cy
      e[14] = 0
    } else if (order === 'ZYX') {
      const ae = cx * cz,
        af = cx * sz,
        be = sx * cz,
        bf = sx * sz
      e[0] = cy * cz
      e[4] = be * sy - af
      e[8] = ae * sy + bf
      e[12] = 0
      e[1] = cy * sz
      e[5] = bf * sy + ae
      e[9] = af * sy - be
      e[13] = 0
      e[2] = -sy
      e[6] = sx * cy
      e[10] = cx * cy
      e[14] = 0
    } else if (order === 'YZX') {
      const ac = cx * cy,
        ad = cx * sy,
        bc = sx * cy,
        bd = sx * sy
      e[0] = cy * cz
      e[4] = bd - ac * sz
      e[8] = bc * sz + ad
      e[12] = 0
      e[1] = sz
      e[5] = cx * cz
      e[9] = -sx * cz
      e[13] = 0
      e[2] = -sy * cz
      e[6] = ad * sz + bc
      e[10] = ac - bd * sz
      e[14] = 0
    } else {
      // XZY
      const ac = cx * cy,
        ad = cx * sy,
        bc = sx * cy,
        bd = sx * sy
      e[0] = cy * cz
      e[4] = -sz
      e[8] = sy * cz
      e[12] = 0
      e[1] = ac * sz + bd
      e[5] = cx * cz
      e[9] = ad * sz - bc
      e[13] = 0
      e[2] = bc * sz - ad
      e[6] = sx * cz
      e[10] = bd * sz + ac
      e[14] = 0
    }
    e[3] = 0
    e[7] = 0
    e[11] = 0
    e[15] = 1
    return this
  }

  makeScale(x: number, y: number, z: number): this {
    const e = this.elements
    e[0] = x
    e[4] = 0
    e[8] = 0
    e[12] = 0
    e[1] = 0
    e[5] = y
    e[9] = 0
    e[13] = 0
    e[2] = 0
    e[6] = 0
    e[10] = z
    e[14] = 0
    e[3] = 0
    e[7] = 0
    e[11] = 0
    e[15] = 1
    return this
  }

  makeOrthographic(left: number, right: number, top: number, bottom: number, near: number, far: number): this {
    const e = this.elements
    const w = 1 / (right - left)
    const h = 1 / (top - bottom)
    const p = 1 / (far - near)

    e[0] = 2 * w
    e[4] = 0
    e[8] = 0
    e[12] = -(right + left) * w
    e[1] = 0
    e[5] = 2 * h
    e[9] = 0
    e[13] = -(top + bottom) * h
    e[2] = 0
    e[6] = 0
    e[10] = -2 * p
    e[14] = -(far + near) * p
    e[3] = 0
    e[7] = 0
    e[11] = 0
    e[15] = 1
    return this
  }

  makePerspective(fov: number, aspect: number, near: number, far: number): this {
    const f = 1.0 / Math.tan(fov / 2)
    const nf = 1 / (near - far)
    const e = this.elements

    e[0] = f / aspect
    e[4] = 0
    e[8] = 0
    e[12] = 0
    e[1] = 0
    e[5] = f
    e[9] = 0
    e[13] = 0
    e[2] = 0
    e[6] = 0
    e[10] = (far + near) * nf
    e[14] = 2 * far * near * nf
    e[3] = 0
    e[7] = 0
    e[11] = -1
    e[15] = 0
    return this
  }

  lookAt(eye: Vec3, target: Vec3, up: Vec3): this {
    const e = this.elements
    let fx = eye.x - target.x
    let fy = eye.y - target.y
    let fz = eye.z - target.z
    let len = Math.sqrt(fx * fx + fy * fy + fz * fz)
    if (len > 0) {
      fx /= len
      fy /= len
      fz /= len
    }

    let rx = up.y * fz - up.z * fy
    let ry = up.z * fx - up.x * fz
    let rz = up.x * fy - up.y * fx
    len = Math.sqrt(rx * rx + ry * ry + rz * rz)
    if (len > 0) {
      rx /= len
      ry /= len
      rz /= len
    }

    const ux = fy * rz - fz * ry
    const uy = fz * rx - fx * rz
    const uz = fx * ry - fy * rx

    e[0] = rx
    e[4] = ux
    e[8] = fx
    e[12] = eye.x
    e[1] = ry
    e[5] = uy
    e[9] = fy
    e[13] = eye.y
    e[2] = rz
    e[6] = uz
    e[10] = fz
    e[14] = eye.z
    e[3] = 0
    e[7] = 0
    e[11] = 0
    e[15] = 1
    return this
  }

  compose(position: Vec3, quaternion: Quat, scale: Vec3): this {
    this.makeRotationFromQuaternion(quaternion)
    const e = this.elements
    const sx = scale.x,
      sy = scale.y,
      sz = scale.z
    e[0] *= sx
    e[1] *= sx
    e[2] *= sx
    e[4] *= sy
    e[5] *= sy
    e[6] *= sy
    e[8] *= sz
    e[9] *= sz
    e[10] *= sz
    e[12] = position.x
    e[13] = position.y
    e[14] = position.z
    return this
  }

  decompose(position: Vec3, quaternion: Quat, scale: Vec3): this {
    const e = this.elements

    let sx = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2])
    const sy = Math.sqrt(e[4] * e[4] + e[5] * e[5] + e[6] * e[6])
    const sz = Math.sqrt(e[8] * e[8] + e[9] * e[9] + e[10] * e[10])

    if (this.determinant() < 0) sx = -sx

    position.x = e[12]
    position.y = e[13]
    position.z = e[14]

    scale.x = sx
    scale.y = sy
    scale.z = sz

    const isx = 1 / sx,
      isy = 1 / sy,
      isz = 1 / sz
    const tmp = new Mat4()
    const te = tmp.elements
    te[0] = e[0] * isx
    te[1] = e[1] * isx
    te[2] = e[2] * isx
    te[3] = 0
    te[4] = e[4] * isy
    te[5] = e[5] * isy
    te[6] = e[6] * isy
    te[7] = 0
    te[8] = e[8] * isz
    te[9] = e[9] * isz
    te[10] = e[10] * isz
    te[11] = 0
    te[12] = 0
    te[13] = 0
    te[14] = 0
    te[15] = 1

    quaternion.setFromRotationMatrix(tmp)
    return this
  }

  extractRotation(m: Mat4): this {
    const e = this.elements
    const me = m.elements
    const isx = 1 / Math.sqrt(me[0] * me[0] + me[1] * me[1] + me[2] * me[2])
    const isy = 1 / Math.sqrt(me[4] * me[4] + me[5] * me[5] + me[6] * me[6])
    const isz = 1 / Math.sqrt(me[8] * me[8] + me[9] * me[9] + me[10] * me[10])
    e[0] = me[0] * isx
    e[1] = me[1] * isx
    e[2] = me[2] * isx
    e[3] = 0
    e[4] = me[4] * isy
    e[5] = me[5] * isy
    e[6] = me[6] * isy
    e[7] = 0
    e[8] = me[8] * isz
    e[9] = me[9] * isz
    e[10] = me[10] * isz
    e[11] = 0
    e[12] = 0
    e[13] = 0
    e[14] = 0
    e[15] = 1
    return this
  }

  toArray(): number[] {
    return Array.from(this.elements)
  }

  fromArray(arr: ArrayLike<number>, offset = 0): this {
    for (let i = 0; i < 16; i++) {
      this.elements[i] = arr[offset + i]
    }
    return this
  }

  toString(): string {
    const e = this.elements
    return (
      `Mat4[\n` +
      `  ${e[0]}, ${e[4]}, ${e[8]},  ${e[12]}\n` +
      `  ${e[1]}, ${e[5]}, ${e[9]},  ${e[13]}\n` +
      `  ${e[2]}, ${e[6]}, ${e[10]}, ${e[14]}\n` +
      `  ${e[3]}, ${e[7]}, ${e[11]}, ${e[15]}\n]`
    )
  }
}
