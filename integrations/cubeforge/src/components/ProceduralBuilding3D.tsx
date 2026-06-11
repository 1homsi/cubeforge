import { useContext, useEffect } from 'react'
import {
  ProceduralBuilding,
  Mesh,
  MeshStandardMaterial,
  Quat,
  type Material,
  type ProceduralBuildingOptions,
} from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'

export interface ProceduralBuilding3DProps extends ProceduralBuildingOptions {
  position?: [x: number, y: number, z: number]
  /** Euler XYZ rotation in radians */
  rotation?: [x: number, y: number, z: number]
  /** Single material or array matching group indices (0=walls, 1=roof, 2=windows, 3=door) */
  material?: Material | Material[]
  castShadow?: boolean
  receiveShadow?: boolean
}

export function ProceduralBuilding3D({
  position,
  rotation,
  material,
  castShadow = false,
  receiveShadow = false,
  ...buildingOpts
}: ProceduralBuilding3DProps) {
  const engine = useContext(Engine3DContext)
  const parent = useContext(ParentObject3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <ProceduralBuilding3D> must be inside a <Game3D>.')
    }
  }

  useEffect(() => {
    if (!parent) return

    const geometry = new ProceduralBuilding(buildingOpts)
    const mat = material ?? new MeshStandardMaterial()
    const mesh = new Mesh(geometry, mat)
    mesh.castShadow = castShadow
    mesh.receiveShadow = receiveShadow

    if (position) mesh.position.set(position[0], position[1], position[2])
    if (rotation) {
      const q = new Quat()
      q.setFromEuler(rotation[0], rotation[1], rotation[2], 'XYZ')
      mesh.quaternion.set(q.x, q.y, q.z, q.w)
    }

    parent.add(mesh)

    return () => {
      parent.remove(mesh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
