import { useContext, useEffect } from 'react'
import { PerspectiveCamera, Vec3 } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'

export interface Camera3DProps {
  fov?: number
  near?: number
  far?: number
  position?: [number, number, number]
  lookAt?: [number, number, number]
  /** When true, this camera becomes the active render camera */
  active?: boolean
}

export function Camera3D({ fov, near, far, position, lookAt, active = false }: Camera3DProps) {
  const engine = useContext(Engine3DContext)
  const parent = useContext(ParentObject3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <Camera3D> must be inside a <Game3D>.')
    }
  }

  useEffect(() => {
    if (!engine || !parent) return

    const cam = new PerspectiveCamera(
      fov ?? 60,
      engine.canvas.width / (engine.canvas.height || 1),
      near ?? 0.1,
      far ?? 2000,
    )

    if (position) cam.position.set(position[0], position[1], position[2])
    if (lookAt) cam.lookAt(new Vec3(lookAt[0], lookAt[1], lookAt[2]))

    parent.add(cam)

    if (active) {
      const prev = engine.camera
      // Swap active camera on the state object (shared reference, renderer reads state.camera)
      ;(engine as { camera: PerspectiveCamera }).camera = cam
      return () => {
        parent.remove(cam)
        ;(engine as { camera: PerspectiveCamera }).camera = prev
      }
    }

    return () => {
      parent.remove(cam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync projection props
  useEffect(() => {
    if (!engine) return
    if (active) {
      if (fov !== undefined) engine.camera.fov = fov
      if (near !== undefined) engine.camera.near = near
      if (far !== undefined) engine.camera.far = far
      engine.camera.updateProjectionMatrix()
    }
  }, [fov, near, far, active, engine])

  useEffect(() => {
    if (!engine || !active) return
    if (position) engine.camera.position.set(position[0], position[1], position[2])
    if (lookAt) engine.camera.lookAt(new Vec3(lookAt[0], lookAt[1], lookAt[2]))
  }, [position, lookAt, active, engine])

  return null
}
