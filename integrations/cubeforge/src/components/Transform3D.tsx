import React, { useContext, useEffect, useRef, type ReactNode } from 'react'
import { Object3D, Quat } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'

export interface Transform3DProps {
  position?: [x: number, y: number, z: number]
  /** Euler XYZ angles in radians */
  rotation?: [x: number, y: number, z: number]
  scale?: [x: number, y: number, z: number] | number
  /** Quaternion — takes priority over rotation when provided */
  quaternion?: [x: number, y: number, z: number, w: number]
  visible?: boolean
  castShadow?: boolean
  receiveShadow?: boolean
  name?: string
  children?: ReactNode
}

export function Transform3D({
  position,
  rotation,
  scale,
  quaternion,
  visible = true,
  castShadow = false,
  receiveShadow = false,
  name,
  children,
}: Transform3DProps) {
  const engine = useContext(Engine3DContext)
  const parent = useContext(ParentObject3DContext)
  const obj3dRef = useRef<Object3D | null>(null)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <Transform3D> must be inside a <Game3D>.')
    }
  }

  // Create and attach the Object3D once
  useEffect(() => {
    if (!parent) return

    const obj = new Object3D()
    obj3dRef.current = obj
    parent.add(obj)

    return () => {
      parent.remove(obj)
      obj3dRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync transform props
  useEffect(() => {
    const obj = obj3dRef.current
    if (!obj) return
    if (position) obj.position.set(position[0], position[1], position[2])
  }, [position])

  useEffect(() => {
    const obj = obj3dRef.current
    if (!obj) return
    if (quaternion) {
      obj.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3])
    } else if (rotation) {
      // Compose from Euler XYZ
      const q = new Quat()
      q.setFromEuler(rotation[0], rotation[1], rotation[2], 'XYZ')
      obj.quaternion.set(q.x, q.y, q.z, q.w)
    }
  }, [rotation, quaternion])

  useEffect(() => {
    const obj = obj3dRef.current
    if (!obj) return
    if (scale !== undefined) {
      if (typeof scale === 'number') {
        obj.scale.set(scale, scale, scale)
      } else {
        obj.scale.set(scale[0], scale[1], scale[2])
      }
    }
  }, [scale])

  useEffect(() => {
    const obj = obj3dRef.current
    if (!obj) return
    obj.visible = visible
  }, [visible])

  useEffect(() => {
    const obj = obj3dRef.current
    if (!obj) return
    obj.castShadow = castShadow
    obj.receiveShadow = receiveShadow
  }, [castShadow, receiveShadow])

  useEffect(() => {
    const obj = obj3dRef.current
    if (!obj) return
    if (name !== undefined) obj.name = name
  }, [name])

  // Provide own Object3D as parent context for children
  // We use a wrapper that re-renders children once the object is created.
  // Since useEffect runs after render, we gate children on the ref being set —
  // but refs aren't reactive. We instead always render children and let them
  // read the context. The parent Object3D will be set by the time children mount.
  // We wrap in a deferred provider using a stable ref pattern.
  const [obj3d, setObj3d] = React.useState<Object3D | null>(null)

  useEffect(() => {
    if (obj3dRef.current) setObj3d(obj3dRef.current)
    return () => setObj3d(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!obj3d) return null

  return <ParentObject3DContext.Provider value={obj3d}>{children}</ParentObject3DContext.Provider>
}
