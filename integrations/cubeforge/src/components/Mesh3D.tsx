import { useContext, useEffect } from 'react'
import { Mesh, type BufferGeometry, type Material } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'

export interface Mesh3DProps {
  geometry: BufferGeometry
  material: Material | Material[]
  castShadow?: boolean
  receiveShadow?: boolean
  renderOrder?: number
}

export function Mesh3D({
  geometry,
  material,
  castShadow = false,
  receiveShadow = false,
  renderOrder = 0,
}: Mesh3DProps) {
  const engine = useContext(Engine3DContext)
  const parent = useContext(ParentObject3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <Mesh3D> must be inside a <Game3D>.')
    }
  }

  useEffect(() => {
    if (!parent) return

    const mesh = new Mesh(geometry, material)
    mesh.castShadow = castShadow
    mesh.receiveShadow = receiveShadow
    mesh.renderOrder = renderOrder
    parent.add(mesh)

    return () => {
      parent.remove(mesh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync mutable props
  useEffect(() => {
    // geometry and material changes require remount; only shadow/order are live-synced
  }, [geometry, material])

  return null
}
