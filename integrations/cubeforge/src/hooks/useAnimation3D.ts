import { useContext, useEffect, useRef } from 'react'
import { AnimationMixer, type AnimationClip } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'
import type { Object3D } from '@cubeforge/renderer3d'

export interface Animation3DControls {
  mixer: AnimationMixer | null
  play(name: string): void
  stop(name: string): void
  crossFadeTo(from: string, to: string, duration: number): void
}

/**
 * Creates an AnimationMixer for the given clips on the nearest parent Object3D.
 * Registers mixer.update(dt) with the game loop automatically.
 *
 * @param clips  Array of AnimationClip objects to register.
 * @param root   Optional explicit root Object3D. Defaults to the nearest ParentObject3DContext.
 */
export function useAnimation3D(clips: AnimationClip[], root?: Object3D): Animation3DControls {
  const engine = useContext(Engine3DContext)
  const parentObj = useContext(ParentObject3DContext)
  const mixerRef = useRef<AnimationMixer | null>(null)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] useAnimation3D must be called inside a <Game3D>.')
    }
  }

  useEffect(() => {
    const obj = root ?? parentObj
    if (!engine || !obj) return

    const mixer = new AnimationMixer(obj)
    mixerRef.current = mixer

    // Pre-register all clips so they are ready to play
    for (const clip of clips) {
      mixer.clipAction(clip)
    }

    const frameListener = (dt: number) => mixer.update(dt)
    engine._frameListeners.add(frameListener)

    return () => {
      engine._frameListeners.delete(frameListener)
      mixer.stopAllAction()
      mixerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    get mixer() {
      return mixerRef.current
    },
    play(name: string) {
      const mixer = mixerRef.current
      if (!mixer) return
      const clip = clips.find((c) => c.name === name)
      if (!clip) {
        console.warn(`[CubeForge3D] useAnimation3D: clip "${name}" not found.`)
        return
      }
      mixer.clipAction(clip).play()
    },
    stop(name: string) {
      const mixer = mixerRef.current
      if (!mixer) return
      const clip = clips.find((c) => c.name === name)
      if (!clip) return
      mixer.clipAction(clip).stop()
    },
    crossFadeTo(from: string, to: string, duration: number) {
      const mixer = mixerRef.current
      if (!mixer) return
      const fromClip = clips.find((c) => c.name === from)
      const toClip = clips.find((c) => c.name === to)
      if (!fromClip || !toClip) {
        console.warn(`[CubeForge3D] useAnimation3D: crossFadeTo — clip "${from}" or "${to}" not found.`)
        return
      }
      mixer.clipAction(fromClip).crossFadeTo(mixer.clipAction(toClip), duration)
    },
  }
}
