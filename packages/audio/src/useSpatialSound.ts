import { useEffect, useRef } from 'react'
import { getAudioCtx, getGroupGainNode } from './audioContext'
import type { AudioGroup } from './audioContext'

// Re-use the shared buffer cache via loadBuffer from useSound
// We import internally to share the cache + ref counting
import { _getBufferCache, _getBufferRefCount } from './useSound'

// ─── Buffer helpers (shared cache) ──────────────────────────────────────────

async function loadBuffer(src: string): Promise<AudioBuffer> {
  const bufferCache = _getBufferCache()
  const bufferRefCount = _getBufferRefCount()

  bufferRefCount.set(src, (bufferRefCount.get(src) ?? 0) + 1)

  const cached = bufferCache.get(src)
  if (cached) return cached

  const res = await fetch(src)
  const data = await res.arrayBuffer()
  const buf = await getAudioCtx().decodeAudioData(data)
  bufferCache.set(src, buf)
  return buf
}

function releaseBuffer(src: string): void {
  const bufferCache = _getBufferCache()
  const bufferRefCount = _getBufferRefCount()

  const count = bufferRefCount.get(src) ?? 0
  if (count <= 1) {
    bufferRefCount.delete(src)
    bufferCache.delete(src)
  } else {
    bufferRefCount.set(src, count - 1)
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SpatialSoundControls {
  play(): void
  stop(): void
  /** Update the position of this sound source (call each frame). */
  setPosition(x: number, y: number): void
  setVolume(v: number): void
}

export interface SpatialSoundOptions {
  volume?: number
  loop?: boolean
  group?: AudioGroup
  /** Maximum distance at which sound is audible. @default 1000 */
  maxDistance?: number
  /** Distance model for attenuation. @default 'linear' */
  distanceModel?: DistanceModelType
  /** Reference distance for attenuation calculations. @default 1 */
  refDistance?: number
  /** How quickly volume falls off with distance. @default 1 */
  rolloffFactor?: number
}

/**
 * Positional audio that attenuates based on distance from the listener.
 * The listener position is typically the camera position — set it with
 * `setListenerPosition(x, y)` each frame.
 *
 * Uses Web Audio API PannerNode for spatial positioning.
 *
 * @example
 * const sfx = useSpatialSound('/explosion.wav', { maxDistance: 800 })
 * sfx.setPosition(enemy.x, enemy.y) // call each frame
 * sfx.play()
 */
export function useSpatialSound(src: string, opts: SpatialSoundOptions = {}): SpatialSoundControls {
  const bufferRef = useRef<AudioBuffer | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const pannerRef = useRef<PannerNode | null>(null)
  const volRef = useRef(opts.volume ?? 1)
  const loopRef = useRef(opts.loop ?? false)
  const groupRef = useRef(opts.group)

  const maxDistance = opts.maxDistance ?? 1000
  const distModel = opts.distanceModel ?? 'linear'
  const refDistance = opts.refDistance ?? 1
  const rolloffFactor = opts.rolloffFactor ?? 1

  useEffect(() => {
    let cancelled = false
    loadBuffer(src)
      .then((buf) => {
        if (!cancelled) bufferRef.current = buf
      })
      .catch(console.error)

    return () => {
      cancelled = true
      if (sourceRef.current) {
        try {
          sourceRef.current.stop()
        } catch {
          /* already stopped */
        }
        sourceRef.current = null
      }
      if (gainRef.current) {
        gainRef.current.disconnect()
        gainRef.current = null
      }
      if (pannerRef.current) {
        pannerRef.current.disconnect()
        pannerRef.current = null
      }
      bufferRef.current = null
      releaseBuffer(src)
    }
  }, [src])

  const getDestination = (): GainNode =>
    groupRef.current ? getGroupGainNode(groupRef.current) : getGroupGainNode('master')

  const ensurePanner = (): PannerNode => {
    if (pannerRef.current) return pannerRef.current

    const ctx = getAudioCtx()
    const panner = ctx.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = distModel
    panner.maxDistance = maxDistance
    panner.refDistance = refDistance
    panner.rolloffFactor = rolloffFactor

    // Connect panner → gain → group/master
    const gain = ctx.createGain()
    gain.gain.value = volRef.current
    panner.connect(gain)
    gain.connect(getDestination())

    pannerRef.current = panner
    gainRef.current = gain
    return panner
  }

  const play = (): void => {
    if (!bufferRef.current) return
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') void ctx.resume()

    // Stop previous
    if (sourceRef.current) {
      try {
        sourceRef.current.stop()
      } catch {
        /* already stopped */
      }
      sourceRef.current = null
    }

    const panner = ensurePanner()
    const source = ctx.createBufferSource()
    source.buffer = bufferRef.current
    source.loop = loopRef.current
    source.connect(panner)
    source.start()
    source.onended = () => {
      sourceRef.current = null
    }
    sourceRef.current = source
  }

  const stop = (): void => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop()
      } catch {
        /* already stopped */
      }
      sourceRef.current = null
    }
  }

  const setPosition = (x: number, y: number): void => {
    const panner = pannerRef.current ?? ensurePanner()
    if (panner.positionX) {
      const ctx = getAudioCtx()
      panner.positionX.setValueAtTime(x, ctx.currentTime)
      panner.positionY.setValueAtTime(y, ctx.currentTime)
      panner.positionZ.setValueAtTime(0, ctx.currentTime)
    } else {
      ;(panner as any).setPosition(x, y, 0)
    }
  }

  const setVolume = (v: number): void => {
    volRef.current = v
    if (gainRef.current) gainRef.current.gain.value = v
  }

  return { play, stop, setPosition, setVolume }
}
