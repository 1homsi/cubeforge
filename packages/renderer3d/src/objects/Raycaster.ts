import { Vec3, Mat4 } from '../math'
import { Camera } from '../scene'
import { Object3D } from '../scene'
import { Mesh } from './Mesh'
import { InstancedMesh } from './InstancedMesh'

export interface Intersection {
  distance: number
  point: Vec3
  object: Mesh
  face: { a: number; b: number; c: number; normal: Vec3 } | null
  uv: { x: number; y: number } | null
  instanceId: number | null
}

const _localOrigin = new Vec3()
const _localDirection = new Vec3()
const _inverseMatrix = new Mat4()
const _instanceMatrix = new Mat4()
const _combinedMatrix = new Mat4()

function computeFaceNormal(
  posAttr: { getX(i: number): number; getY(i: number): number; getZ(i: number): number },
  ai: number,
  bi: number,
  ci: number,
): Vec3 {
  const ax = posAttr.getX(ai),
    ay = posAttr.getY(ai),
    az = posAttr.getZ(ai)
  const bx = posAttr.getX(bi),
    by = posAttr.getY(bi),
    bz = posAttr.getZ(bi)
  const cx = posAttr.getX(ci),
    cy = posAttr.getY(ci),
    cz = posAttr.getZ(ci)
  const e1x = bx - ax,
    e1y = by - ay,
    e1z = bz - az
  const e2x = cx - ax,
    e2y = cy - ay,
    e2z = cz - az
  return new Vec3(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x).normalize()
}

function computeUV(
  uvAttr: { getX(i: number): number; getY(i: number): number } | undefined,
  ai: number,
  bi: number,
  ci: number,
  u: number,
  v: number,
): { x: number; y: number } | null {
  if (!uvAttr) return null
  const w = 1 - u - v
  return {
    x: uvAttr.getX(ai) * w + uvAttr.getX(bi) * u + uvAttr.getX(ci) * v,
    y: uvAttr.getY(ai) * w + uvAttr.getY(bi) * u + uvAttr.getY(ci) * v,
  }
}

function intersectMeshTriangles(
  mesh: Mesh,
  localOrigin: Vec3,
  localDirection: Vec3,
  near: number,
  far: number,
  instanceId: number | null,
  worldMatrix: Mat4,
): Intersection[] {
  const posAttr = mesh.geometry.getAttribute('position')
  if (!posAttr) return []

  const uvAttr = mesh.geometry.getAttribute('uv')
  const idx = mesh.geometry.index
  const EPSILON = 1e-8
  const results: Intersection[] = []

  const testTriangle = (ai: number, bi: number, ci: number): void => {
    const ax = posAttr.getX(ai),
      ay = posAttr.getY(ai),
      az = posAttr.getZ(ai)
    const bx = posAttr.getX(bi),
      by = posAttr.getY(bi),
      bz = posAttr.getZ(bi)
    const cx = posAttr.getX(ci),
      cy = posAttr.getY(ci),
      cz = posAttr.getZ(ci)

    const e1x = bx - ax,
      e1y = by - ay,
      e1z = bz - az
    const e2x = cx - ax,
      e2y = cy - ay,
      e2z = cz - az

    const hx = localDirection.y * e2z - localDirection.z * e2y
    const hy = localDirection.z * e2x - localDirection.x * e2z
    const hz = localDirection.x * e2y - localDirection.y * e2x

    const det = e1x * hx + e1y * hy + e1z * hz
    if (Math.abs(det) < EPSILON) return

    const invDet = 1 / det
    const sx = localOrigin.x - ax
    const sy = localOrigin.y - ay
    const sz = localOrigin.z - az

    const u = (sx * hx + sy * hy + sz * hz) * invDet
    if (u < 0 || u > 1) return

    const qx = sy * e1z - sz * e1y
    const qy = sz * e1x - sx * e1z
    const qz = sx * e1y - sy * e1x

    const v = (localDirection.x * qx + localDirection.y * qy + localDirection.z * qz) * invDet
    if (v < 0 || u + v > 1) return

    const t = (e2x * qx + e2y * qy + e2z * qz) * invDet
    if (t < EPSILON) return

    const worldPoint = new Vec3(
      localOrigin.x + localDirection.x * t,
      localOrigin.y + localDirection.y * t,
      localOrigin.z + localDirection.z * t,
    ).applyMat4(worldMatrix)

    // Transform local ray origin to world space to get a world-space distance measurement.
    const localOriginWorld = new Vec3(localOrigin.x, localOrigin.y, localOrigin.z).applyMat4(worldMatrix)
    const dist = localOriginWorld.distanceTo(worldPoint)

    results.push({
      distance: dist,
      point: worldPoint,
      object: mesh,
      face: {
        a: ai,
        b: bi,
        c: ci,
        normal: computeFaceNormal(posAttr, ai, bi, ci),
      },
      uv: computeUV(uvAttr, ai, bi, ci, u, v),
      instanceId,
    })
  }

  if (idx !== null) {
    for (let i = 0; i < idx.count; i += 3) {
      testTriangle(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2))
    }
  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      testTriangle(i, i + 1, i + 2)
    }
  }

  return results.filter((hit) => hit.distance >= near && hit.distance <= far)
}

export class Raycaster {
  ray: { origin: Vec3; direction: Vec3 }
  near: number
  far: number

  constructor(origin?: Vec3, direction?: Vec3, near = 0, far = Infinity) {
    this.ray = {
      origin: origin ? new Vec3(origin.x, origin.y, origin.z) : new Vec3(),
      direction: direction ? new Vec3(direction.x, direction.y, direction.z) : new Vec3(0, 0, -1),
    }
    this.near = near
    this.far = far
  }

  setFromCamera(ndc: { x: number; y: number }, camera: Camera): void {
    // Unproject NDC point at near-plane through the combined inverse(projection * view).
    const invProj = camera.projectionMatrixInverse
    const matWorld = camera.matrixWorld

    // Near-plane point in view space
    const nearVS = new Vec3(ndc.x, ndc.y, -1).applyMat4(invProj)
    // Far-plane point in view space
    const farVS = new Vec3(ndc.x, ndc.y, 1).applyMat4(invProj)

    // Transform to world space
    const nearWS = nearVS.clone().applyMat4(matWorld)
    const farWS = farVS.clone().applyMat4(matWorld)

    this.ray.origin.set(nearWS.x, nearWS.y, nearWS.z)
    this.ray.direction.set(farWS.x - nearWS.x, farWS.y - nearWS.y, farWS.z - nearWS.z).normalize()
  }

  setFromMouseEvent(event: MouseEvent, canvas: HTMLCanvasElement, camera: Camera): void {
    const rect = canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.setFromCamera({ x, y }, camera)
  }

  intersectObject(object: Object3D, recursive = true): Intersection[] {
    const results: Intersection[] = []
    this._intersectObject(object, recursive, results)
    return results.sort((a, b) => a.distance - b.distance)
  }

  intersectObjects(objects: Object3D[], recursive = true): Intersection[] {
    const results: Intersection[] = []
    for (const obj of objects) {
      this._intersectObject(obj, recursive, results)
    }
    return results.sort((a, b) => a.distance - b.distance)
  }

  private _intersectObject(object: Object3D, recursive: boolean, results: Intersection[]): void {
    if (!object.visible) return

    if ((object as Mesh).isMesh) {
      const mesh = object as Mesh

      if ((mesh as InstancedMesh).isInstancedMesh) {
        const instanced = mesh as InstancedMesh
        for (let i = 0; i < instanced.count; i++) {
          instanced.getMatrixAt(i, _instanceMatrix)
          // Instance world matrix = object.matrixWorld * instanceMatrix
          _combinedMatrix.multiplyMatrices(instanced.matrixWorld, _instanceMatrix)
          _inverseMatrix.copy(_combinedMatrix).invert()

          _localOrigin.set(this.ray.origin.x, this.ray.origin.y, this.ray.origin.z).applyMat4(_inverseMatrix)
          _localDirection
            .set(this.ray.direction.x, this.ray.direction.y, this.ray.direction.z)
            .transformDirection(_inverseMatrix)

          const hits = intersectMeshTriangles(
            mesh,
            _localOrigin,
            _localDirection,
            this.near,
            this.far,
            i,
            _combinedMatrix,
          )
          for (const h of hits) results.push(h)
        }
      } else {
        _inverseMatrix.copy(mesh.matrixWorld).invert()
        _localOrigin.set(this.ray.origin.x, this.ray.origin.y, this.ray.origin.z).applyMat4(_inverseMatrix)
        _localDirection
          .set(this.ray.direction.x, this.ray.direction.y, this.ray.direction.z)
          .transformDirection(_inverseMatrix)

        const hits = intersectMeshTriangles(
          mesh,
          _localOrigin,
          _localDirection,
          this.near,
          this.far,
          null,
          mesh.matrixWorld,
        )
        for (const h of hits) results.push(h)
      }
    }

    if (recursive) {
      for (const child of object.children) {
        this._intersectObject(child, true, results)
      }
    }
  }
}
