import { useContext, useEffect } from 'react'
import { TerrainGeometry, Mesh, MeshStandardMaterial, type Material, type TerrainOptions } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'

export interface Terrain3DProps {
  heightData?: Float32Array
  width?: number
  /** Depth of the terrain (named height to match the 2D-terrain mental model) */
  height?: number
  widthSegments?: number
  heightSegments?: number
  maxElevation?: number
  material?: Material
  receiveShadow?: boolean
  /** Use TerrainGeometry.procedural() when no heightData is provided */
  procedural?: boolean
  proceduralOpts?: {
    octaves?: number
    lacunarity?: number
    persistence?: number
    seed?: number
  }
}

export function Terrain3D({
  heightData,
  width = 256,
  height = 256,
  widthSegments = 128,
  heightSegments = 128,
  maxElevation = 20,
  material,
  receiveShadow = false,
  procedural = false,
  proceduralOpts,
}: Terrain3DProps) {
  const engine = useContext(Engine3DContext)
  const parent = useContext(ParentObject3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <Terrain3D> must be inside a <Game3D>.')
    }
  }

  useEffect(() => {
    if (!parent) return

    const opts: TerrainOptions = { width, height, widthSegments, heightSegments, maxElevation }

    let geometry: TerrainGeometry
    if (heightData) {
      geometry = new TerrainGeometry(heightData, opts)
    } else if (procedural) {
      geometry = TerrainGeometry.procedural({ ...opts, ...proceduralOpts })
    } else {
      geometry = new TerrainGeometry(null, opts)
    }

    const mat = material ?? new MeshStandardMaterial()
    const mesh = new Mesh(geometry, mat)
    mesh.receiveShadow = receiveShadow
    parent.add(mesh)

    return () => {
      parent.remove(mesh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
