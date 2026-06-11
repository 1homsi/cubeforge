import { useContext, useEffect, useRef } from 'react'
import { Sprite3D, Vec3 } from '@cubeforge/renderer3d'
import type { Texture } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'

export interface SpriteObjectProps {
  position?: [number, number, number]
  color?: [number, number, number]
  opacity?: number
  map?: Texture | null
  /** Uniform scale or [scaleX, scaleY]. */
  scale?: number | [number, number]
  /** Billboard rotation in radians. */
  rotation?: number
  depthTest?: boolean
  sizeAttenuation?: boolean
  blending?: 'normal' | 'additive'
  renderOrder?: number
}

export function SpriteObject({
  position,
  color,
  opacity = 1,
  map = null,
  scale,
  rotation = 0,
  depthTest = true,
  sizeAttenuation = true,
  blending = 'normal',
  renderOrder = 0,
}: SpriteObjectProps): null {
  const engine = useContext(Engine3DContext)
  const parent = useContext(ParentObject3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <SpriteObject> must be inside a <Game3D>.')
    }
  }

  const spriteRef = useRef<Sprite3D | null>(null)

  useEffect(() => {
    if (!parent) return

    const sprite = new Sprite3D({
      color: color ? new Vec3(color[0], color[1], color[2]) : new Vec3(1, 1, 1),
      opacity,
      map: map ?? null,
      rotation,
      depthTest,
      sizeAttenuation,
      blending,
    })

    if (position) sprite.position.set(position[0], position[1], position[2])

    if (scale !== undefined) {
      if (typeof scale === 'number') {
        sprite.scale.set(scale, scale, 1)
      } else {
        sprite.scale.set(scale[0], scale[1], 1)
      }
    }

    sprite.renderOrder = renderOrder
    parent.add(sprite)
    spriteRef.current = sprite

    return () => {
      parent.remove(sprite)
      spriteRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync position
  useEffect(() => {
    const sprite = spriteRef.current
    if (!sprite || !position) return
    sprite.position.set(position[0], position[1], position[2])
  }, [position])

  // Sync scale
  useEffect(() => {
    const sprite = spriteRef.current
    if (!sprite || scale === undefined) return
    if (typeof scale === 'number') {
      sprite.scale.set(scale, scale, 1)
    } else {
      sprite.scale.set(scale[0], scale[1], 1)
    }
  }, [scale])

  // Sync material properties
  useEffect(() => {
    const sprite = spriteRef.current
    if (!sprite) return
    if (color) sprite.material.color.set(color[0], color[1], color[2])
    sprite.material.opacity = opacity
    sprite.material.map = map ?? null
    sprite.material.rotation = rotation
    sprite.material.depthTest = depthTest
    sprite.material.sizeAttenuation = sizeAttenuation
    sprite.material.blending = blending
  }, [color, opacity, map, rotation, depthTest, sizeAttenuation, blending])

  // Sync renderOrder
  useEffect(() => {
    const sprite = spriteRef.current
    if (!sprite) return
    sprite.renderOrder = renderOrder
  }, [renderOrder])

  return null
}
