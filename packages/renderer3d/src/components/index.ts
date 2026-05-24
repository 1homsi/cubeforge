import type { Mat4 } from '../math'

export interface Transform3DComponent {
  type: 'Transform3D'
  x: number
  y: number
  z: number
  qx: number
  qy: number
  qz: number
  qw: number
  sx: number
  sy: number
  sz: number
  matrix: Mat4 | null
}

export interface Camera3DComponent {
  type: 'Camera3D'
  fov: number
  near: number
  far: number
  isActive: boolean
}

export interface Mesh3DComponent {
  type: 'Mesh3D'
  geometryId: string
  materialId: string
  castShadow: boolean
  receiveShadow: boolean
}

export function createTransform3D(
  x = 0,
  y = 0,
  z = 0,
  qx = 0,
  qy = 0,
  qz = 0,
  qw = 1,
  sx = 1,
  sy = 1,
  sz = 1,
): Transform3DComponent {
  return { type: 'Transform3D', x, y, z, qx, qy, qz, qw, sx, sy, sz, matrix: null }
}
