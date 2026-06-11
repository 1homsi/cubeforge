import { useContext, useEffect } from 'react'
import { InstancedMesh, type BufferGeometry, type Material } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'

export interface InstancedMesh3DProps {
  geometry: BufferGeometry
  material: Material | Material[]
  count: number
  /** Called after the InstancedMesh is created so callers can set instance matrices */
  onReady?: (mesh: InstancedMesh) => void
  castShadow?: boolean
  receiveShadow?: boolean
}

export function InstancedMesh3D({
  geometry,
  material,
  count,
  onReady,
  castShadow = false,
  receiveShadow = false,
}: InstancedMesh3DProps) {
  const engine = useContext(Engine3DContext)
  const parent = useContext(ParentObject3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <InstancedMesh3D> must be inside a <Game3D>.')
    }
  }

  useEffect(() => {
    if (!parent) return

    const mesh = new InstancedMesh(geometry, material, count)
    mesh.castShadow = castShadow
    mesh.receiveShadow = receiveShadow
    parent.add(mesh)
    onReady?.(mesh)

    return () => {
      parent.remove(mesh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
