import { useContext, useEffect, useRef } from 'react'
import { Vec3 } from '@cubeforge/renderer3d'
import type { AudioSource3D as IAudioSource3D } from '@cubeforge/renderer3d'
import { Engine3DContext } from '../context3d'
import { AudioOcclusionContext } from '../context/AudioOcclusionContext'

export interface AudioSource3DProps {
  id: string
  position: [number, number, number]
  /** URL of the audio file to load and play. */
  src?: string
  loop?: boolean
  volume?: number
  autoplay?: boolean
}

/**
 * Registers a 3D spatial audio source with the AudioOcclusion singleton
 * provided by the nearest useAudioOcclusion() hook via AudioOcclusionContext.
 *
 * Returns null — renders nothing to the DOM.
 */
export function AudioSource3DComponent({ id, position, src, volume = 1, autoplay = true }: AudioSource3DProps): null {
  const engine = useContext(Engine3DContext)
  const occlusion = useContext(AudioOcclusionContext)

  const posRef = useRef(position)
  posRef.current = position

  const srcDescRef = useRef<IAudioSource3D | null>(null)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <AudioSource3D> must be inside a <Game3D>.')
    }
    if (!occlusion) {
      console.warn(
        '[CubeForge3D] <AudioSource3D> must be inside a component that provides AudioOcclusionContext ' +
          '(e.g. call useAudioOcclusion() in a parent and pass the instance via context).',
      )
    }
  }

  // Mount / unmount: register source
  useEffect(() => {
    if (!occlusion) return

    const [x, y, z] = posRef.current
    const pos = new Vec3(x, y, z)

    let cancelled = false

    const register = async () => {
      let buffer: AudioBuffer | undefined
      if (src && autoplay) {
        try {
          buffer = await occlusion.loadBuffer(src)
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[AudioSource3D] Failed to load "${src}":`, e)
          }
        }
      }
      if (cancelled) return

      const descriptor = occlusion.addSource(id, pos, buffer)
      descriptor.baseVolume = Math.max(0, Math.min(1, volume))
      descriptor.gainNode.gain.value = descriptor.baseVolume
      srcDescRef.current = descriptor
    }

    void register()

    return () => {
      cancelled = true
      occlusion.removeSource(id)
      srcDescRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, occlusion, src, autoplay])

  // Sync position changes
  useEffect(() => {
    if (!occlusion) return
    const [x, y, z] = position
    occlusion.moveSource(id, new Vec3(x, y, z))
  }, [id, occlusion, position])

  // Sync volume changes
  useEffect(() => {
    const desc = srcDescRef.current
    if (!desc) return
    desc.baseVolume = Math.max(0, Math.min(1, volume))
    // Apply immediately; occlusion will re-compute on next update
    desc.gainNode.gain.setTargetAtTime(desc.baseVolume, occlusion?.context.currentTime ?? 0, 0.02)
  }, [volume, occlusion])

  return null
}
