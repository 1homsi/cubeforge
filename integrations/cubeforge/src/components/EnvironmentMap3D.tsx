import { useContext, useEffect } from 'react'
import { EquirectangularLoader, MeshStandardMaterial, Mesh } from '@cubeforge/renderer3d'
import { Engine3DContext } from '../context3d'

export interface EnvironmentMap3DProps {
  /** URL to equirectangular HDR/LDR image */
  src?: string
  /** If true, also store the raw env map on scene.userData.envMap for skybox rendering */
  background?: boolean
  /** Intensity multiplier applied to all MeshStandardMaterial env reflections */
  intensity?: number
  onLoad?: () => void
  onError?: (err: Error) => void
}

export function EnvironmentMap3D({
  src,
  background = false,
  intensity = 1,
  onLoad,
  onError,
}: EnvironmentMap3DProps): null {
  const engine = useContext(Engine3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <EnvironmentMap3D> must be inside a <Game3D>.')
    }
  }

  useEffect(() => {
    if (!engine || !src) return

    const gl = engine.renderer.gl
    const loader = new EquirectangularLoader(gl)

    let cancelled = false
    let envMap: WebGLTexture | null = null
    let irradianceMap: WebGLTexture | null = null
    let prefilteredEnvMap: WebGLTexture | null = null
    let brdfLUT: WebGLTexture | null = null

    loader
      .load(src)
      .then((cubemap) => {
        if (cancelled) {
          gl.deleteTexture(cubemap)
          return
        }

        envMap = cubemap
        irradianceMap = loader.generateIrradianceMap(cubemap)
        prefilteredEnvMap = loader.generatePrefilteredEnvMap(cubemap)
        brdfLUT = loader.generateBRDFLUT()

        // Apply IBL maps to all MeshStandardMaterial instances in the scene
        engine.scene.traverse((obj) => {
          if (!(obj instanceof Mesh)) return
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          for (const mat of mats) {
            if (mat instanceof MeshStandardMaterial) {
              mat.irradianceMap = irradianceMap
              mat.prefilteredEnvMap = prefilteredEnvMap
              mat.brdfLUT = brdfLUT
              mat.envMapIntensity = intensity
            }
          }
        })

        if (background) {
          engine.scene.userData['envMap'] = envMap
        }

        onLoad?.()
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const error = err instanceof Error ? err : new Error(String(err))
        onError?.(error)
      })

    return () => {
      cancelled = true

      // Reset all MeshStandardMaterial env maps back to null
      engine.scene.traverse((obj) => {
        if (!(obj instanceof Mesh)) return
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        for (const mat of mats) {
          if (mat instanceof MeshStandardMaterial) {
            mat.irradianceMap = null
            mat.prefilteredEnvMap = null
            mat.brdfLUT = null
          }
        }
      })

      if (background) {
        delete engine.scene.userData['envMap']
      }

      loader.dispose()
      // Note: individual WebGLTextures (envMap, irradiance, etc.) are owned
      // and disposed by the EquirectangularLoader via dispose().
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  // Sync intensity live without remounting
  useEffect(() => {
    if (!engine) return
    engine.scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of mats) {
        if (mat instanceof MeshStandardMaterial) {
          mat.envMapIntensity = intensity
        }
      }
    })
  }, [engine, intensity])

  return null
}
