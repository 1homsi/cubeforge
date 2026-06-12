import { useContext, useEffect, useRef } from 'react'
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
  const cameraRef = useRef<PerspectiveCamera | null>(null)

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

    cameraRef.current = cam
    parent.add(cam)

    return () => {
      parent.remove(cam)
      cameraRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync projection props
  useEffect(() => {
    if (!engine) return
    const cam = cameraRef.current
    if (!cam) return
    cam.fov = fov ?? 60
    cam.near = near ?? 0.1
    cam.far = far ?? 2000
    cam.aspect = engine.canvas.width / (engine.canvas.height || 1)
    cam.updateProjectionMatrix()
  }, [fov, near, far, engine])

  useEffect(() => {
    const cam = cameraRef.current
    if (!cam) return
    if (position) cam.position.set(position[0], position[1], position[2])
    if (lookAt) cam.lookAt(new Vec3(lookAt[0], lookAt[1], lookAt[2]))
  }, [position, lookAt])

  useEffect(() => {
    if (!engine || !active) return
    const cam = cameraRef.current
    if (!cam) return

    const prev = engine.camera
    ;(engine as { camera: PerspectiveCamera }).camera = cam

    return () => {
      if (engine.camera === cam) {
        ;(engine as { camera: PerspectiveCamera }).camera = prev
      }
    }
  }, [active, engine])

  return null
}
