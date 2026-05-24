import { useContext, useEffect, useState, useCallback } from 'react'
import { Engine3DContext } from '../context3d'

export interface UsePointerLockResult {
  isLocked: boolean
  lock(): void
  unlock(): void
}

export function usePointerLock(): UsePointerLockResult {
  const engine = useContext(Engine3DContext)
  const [isLocked, setIsLocked] = useState(false)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] usePointerLock must be called inside a <Game3D>.')
    }
  }

  useEffect(() => {
    const onPointerLockChange = () => {
      setIsLocked(document.pointerLockElement !== null)
    }

    document.addEventListener('pointerlockchange', onPointerLockChange)
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange)
    }
  }, [])

  const lock = useCallback(() => {
    engine?.canvas.requestPointerLock()
  }, [engine])

  const unlock = useCallback(() => {
    document.exitPointerLock()
  }, [])

  return { isLocked, lock, unlock }
}
