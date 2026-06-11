import { useContext, useRef } from 'react'
import { Raycaster } from '@cubeforge/renderer3d'
import type { Intersection } from '@cubeforge/renderer3d'
import type { Object3D } from '@cubeforge/renderer3d'
import { Engine3DContext } from '../context3d'

export interface UseRaycasterResult {
  /** Fire a ray from a MouseEvent, test against provided objects. */
  castFromEvent(e: MouseEvent, objects: Object3D[], recursive?: boolean): Intersection[]
  /** Fire a ray from NDC coords (-1 to 1). */
  castFromNDC(x: number, y: number, objects: Object3D[], recursive?: boolean): Intersection[]
  /** The underlying Raycaster instance for direct use. */
  raycaster: Raycaster
}

export function useRaycaster(): UseRaycasterResult {
  const engine = useContext(Engine3DContext)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] useRaycaster must be called inside a <Game3D>.')
    }
  }

  const raycasterRef = useRef<Raycaster | null>(null)
  if (raycasterRef.current === null) {
    raycasterRef.current = new Raycaster()
  }
  const raycaster = raycasterRef.current

  return {
    castFromEvent(e: MouseEvent, objects: Object3D[], recursive = true): Intersection[] {
      if (!engine) return []
      raycaster.setFromMouseEvent(e, engine.canvas, engine.camera)
      return raycaster.intersectObjects(objects, recursive)
    },

    castFromNDC(x: number, y: number, objects: Object3D[], recursive = true): Intersection[] {
      if (!engine) return []
      raycaster.setFromCamera({ x, y }, engine.camera)
      return raycaster.intersectObjects(objects, recursive)
    },

    raycaster,
  }
}
