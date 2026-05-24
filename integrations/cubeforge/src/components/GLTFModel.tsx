import { useContext, useEffect, useRef } from 'react'
import { GLTFLoader, AnimationMixer, Quat, type GLTFLoadResult, type AnimationClip } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext } from '../context3d'

export interface GLTFModelProps {
  /** URL to .glb or .gltf file */
  src: string
  position?: [number, number, number]
  /** Euler XYZ rotation in radians */
  rotation?: [number, number, number]
  scale?: [number, number, number] | number
  castShadow?: boolean
  receiveShadow?: boolean
  /** Name of animation clip to auto-play on load */
  animationName?: string
  onLoad?: (result: GLTFLoadResult) => void
  onError?: (err: Error) => void
}

export function GLTFModel({
  src,
  position,
  rotation,
  scale,
  castShadow = false,
  receiveShadow = false,
  animationName,
  onLoad,
  onError,
}: GLTFModelProps) {
  const engine = useContext(Engine3DContext)
  const parent = useContext(ParentObject3DContext)
  // Memoize src via ref to avoid re-fetching when other props change
  const srcRef = useRef(src)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <GLTFModel> must be inside a <Game3D>.')
    }
  }

  useEffect(() => {
    if (!engine || !parent) return

    let cancelled = false
    let addedRoot: import('@cubeforge/renderer3d').Object3D | null = null
    let frameListener: ((dt: number) => void) | null = null

    const loader = new GLTFLoader(engine.renderer.gl)

    loader
      .load(srcRef.current)
      .then((result) => {
        if (cancelled) return

        const root = result.scene

        if (position) root.position.set(position[0], position[1], position[2])
        if (rotation) {
          const q = new Quat()
          q.setFromEuler(rotation[0], rotation[1], rotation[2], 'XYZ')
          root.quaternion.set(q.x, q.y, q.z, q.w)
        }
        if (scale !== undefined) {
          if (typeof scale === 'number') {
            root.scale.set(scale, scale, scale)
          } else {
            root.scale.set(scale[0], scale[1], scale[2])
          }
        }

        // Apply shadow flags recursively
        root.traverse((obj) => {
          obj.castShadow = castShadow
          obj.receiveShadow = receiveShadow
        })

        parent.add(root)
        addedRoot = root

        // Auto-play animation
        if (animationName && result.animations.length > 0) {
          const clip = result.animations.find((a) => a.name === animationName) ?? result.animations[0]
          if (clip) {
            const mixer = new AnimationMixer(root)
            mixer.clipAction(clip as unknown as AnimationClip).play()
            frameListener = (dt: number) => mixer.update(dt)
            engine._frameListeners.add(frameListener)
          }
        }

        onLoad?.(result)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        onError?.(err instanceof Error ? err : new Error(String(err)))
      })

    return () => {
      cancelled = true
      if (frameListener) engine._frameListeners.delete(frameListener)
      if (addedRoot) parent.remove(addedRoot)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
