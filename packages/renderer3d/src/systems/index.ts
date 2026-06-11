import type { System, ECSWorld, EntityId, WorldQuery } from '@cubeforge/core'
import type { WebGLRenderer3D } from '../renderer'
import type { Scene, Camera } from '../scene'
import { Object3D } from '../scene'
import { Mesh } from '../objects'
import { BufferGeometry } from '../geometry'
import { Material } from '../material'
import type { Transform3DComponent, Camera3DComponent, Mesh3DComponent } from '../components'
import { PerspectiveCamera } from '../scene'

export interface RenderSystem3DOptions {
  renderer: WebGLRenderer3D
  scene: Scene
  camera: Camera
}

export class RenderSystem3D implements System {
  private readonly _transform3DQuery: WorldQuery = { key: 'Transform3D', types: ['Transform3D'] }
  private readonly _mesh3DQuery: WorldQuery = { key: 'Mesh3D\x00Transform3D', types: ['Mesh3D', 'Transform3D'] }
  private readonly _camera3DQuery: WorldQuery = { key: 'Camera3D', types: ['Camera3D'] }

  private _renderer: WebGLRenderer3D
  private _scene: Scene
  private _camera: Camera

  /** Maps entity ID → the Object3D tracked in the scene graph */
  private _objectMap = new Map<EntityId, Object3D>()

  /** Maps entity ID → the Mesh attached to its Object3D (when Mesh3DComponent present) */
  private _meshMap = new Map<EntityId, Mesh>()

  /** Named geometry registry — populated via registerGeometry() */
  private _geometryRegistry = new Map<string, BufferGeometry>()

  /** Named material registry — populated via registerMaterial() */
  private _materialRegistry = new Map<string, Material>()

  private readonly _transformEntityScratch = new Set<EntityId>()
  private readonly _meshEntityScratch = new Set<EntityId>()

  constructor(opts: RenderSystem3DOptions) {
    this._renderer = opts.renderer
    this._scene = opts.scene
    this._camera = opts.camera
  }

  // ── Registry ────────────────────────────────────────────────────────────────

  registerGeometry(id: string, geometry: BufferGeometry): void {
    this._geometryRegistry.set(id, geometry)
  }

  registerMaterial(id: string, material: Material): void {
    this._materialRegistry.set(id, material)
  }

  // ── System.update ───────────────────────────────────────────────────────────

  update(world: ECSWorld, _dt: number): void {
    // ── Step 1: Sync Transform3D entities to Object3D scene graph ─────────────
    const transformEntities = this._transformEntityScratch
    transformEntities.clear()
    for (const id of world.queryPrepared(this._transform3DQuery)) transformEntities.add(id)

    // Remove objects for destroyed entities
    for (const [id, obj] of this._objectMap) {
      if (!transformEntities.has(id)) {
        obj.removeFromParent()
        this._objectMap.delete(id)
        // Also clean up mesh tracking
        const mesh = this._meshMap.get(id)
        if (mesh) {
          mesh.removeFromParent()
          this._meshMap.delete(id)
        }
      }
    }

    // Create or update Object3Ds
    for (const id of transformEntities) {
      const transform = world.getComponent<Transform3DComponent>(id, 'Transform3D')
      if (!transform) continue

      let obj = this._objectMap.get(id)
      if (!obj) {
        obj = new Object3D()
        this._scene.add(obj)
        this._objectMap.set(id, obj)
      }

      obj.position.set(transform.x, transform.y, transform.z)
      obj.quaternion.set(transform.qx, transform.qy, transform.qz, transform.qw)
      obj.scale.set(transform.sx, transform.sy, transform.sz)
    }

    // ── Step 2: Sync Mesh3D components ────────────────────────────────────────
    const meshEntities = this._meshEntityScratch
    meshEntities.clear()
    for (const id of world.queryPrepared(this._mesh3DQuery)) meshEntities.add(id)

    // Remove meshes from entities that lost their Mesh3DComponent
    for (const [id, mesh] of this._meshMap) {
      if (!meshEntities.has(id)) {
        mesh.removeFromParent()
        this._meshMap.delete(id)
      }
    }

    for (const id of meshEntities) {
      const meshComp = world.getComponent<Mesh3DComponent>(id, 'Mesh3D')
      if (!meshComp) continue

      const parentObj = this._objectMap.get(id)
      if (!parentObj) continue

      const geometry = this._geometryRegistry.get(meshComp.geometryId)
      const material = this._materialRegistry.get(meshComp.materialId)

      if (!geometry || !material) continue

      let mesh = this._meshMap.get(id)

      if (!mesh) {
        mesh = new Mesh(geometry, material)
        parentObj.add(mesh)
        this._meshMap.set(id, mesh)
      } else {
        // Update geometry/material if they changed
        if (mesh.geometry !== geometry) mesh.geometry = geometry
        if (mesh.material !== material) mesh.material = material
      }

      mesh.castShadow = meshComp.castShadow
      mesh.receiveShadow = meshComp.receiveShadow
    }

    // ── Step 3: Check for active Camera3D override ─────────────────────────────
    const cameraEntities = world.queryPrepared(this._camera3DQuery)
    for (const id of cameraEntities) {
      const camComp = world.getComponent<Camera3DComponent>(id, 'Camera3D')
      if (!camComp?.isActive) continue

      // Look up the Object3D for this entity — it should be a PerspectiveCamera
      const obj = this._objectMap.get(id)
      if (obj instanceof PerspectiveCamera) {
        this._camera = obj
        break
      }
    }

    // ── Step 4: Render ────────────────────────────────────────────────────────
    this._renderer.render(this._scene, this._camera)
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  dispose(): void {
    for (const obj of this._objectMap.values()) {
      obj.removeFromParent()
    }
    this._objectMap.clear()
    this._meshMap.clear()
    this._geometryRegistry.clear()
    this._materialRegistry.clear()
  }
}
