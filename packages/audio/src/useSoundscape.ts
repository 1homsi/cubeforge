import { useEffect, useRef, useCallback } from 'react'
import { getAudioCtx, getGroupGainNode, registerGroupSource } from './audioContext'
import type { AudioGroup } from './audioContext'

export interface SoundscapeLayer {
  /** Audio file path to loop. */
  src: string
  /** Layer volume 0–1. Default 1. */
  volume?: number
  /** Whether this layer is initially active. Default true. */
  active?: boolean
  /**
   * Random time offset in seconds applied to the loop start, so layers
   * don't all lock in phase. Set to the loop duration to fully randomize.
   * Default 0 (no offset).
   */
  randomOffset?: number
}

export interface SoundscapeOptions {
  /** Master volume for the whole soundscape (multiplied by layer volumes). Default 1. */
  volume?: number
  /** Fade-in duration in seconds on mount or when activated. Default 1. */
  fadeIn?: number
  /** Fade-out duration in seconds on unmount or when deactivated. Default 1. */
  fadeOut?: number
  /** Audio routing group. Default 'ambient'. */
  group?: AudioGroup
  /**
   * Whether the soundscape is active. Toggle to fade the entire soundscape
   * in or out at runtime without unmounting.
   */
  active?: boolean
}

export interface SoundscapeControls {
  /** Set the master volume of this soundscape (0–1). Fades over duration seconds. */
  setVolume(volume: number, duration?: number): void
  /** Set the volume of a specific layer (0–1). Fades over duration seconds. */
  setLayerVolume(src: string, volume: number, duration?: number): void
  /** Fade a layer to the target volume over duration seconds. */
  fadeLayer(src: string, targetVolume: number, duration: number): void
}

interface LayerState {
  src: string
  gainNode: GainNode
  source: AudioBufferSourceNode | null
  targetVolume: number
  unregister: (() => void) | null
}

const bufferCache = new Map<string, AudioBuffer>()

async function loadBuffer(src: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(src)
  if (cached) return cached
  const res = await fetch(src)
  const data = await res.arrayBuffer()
  const buf = await getAudioCtx().decodeAudioData(data)
  bufferCache.set(src, buf)
  return buf
}

/**
 * Plays multiple looping audio layers simultaneously — wind, rain, fire crackle,
 * forest ambience, etc. Layers fade in/out independently or as a unit.
 *
 * Layers start looping immediately (after buffer load). The whole soundscape
 * fades in on mount and fades out on unmount, respecting `prefers-reduced-motion`
 * isn't required here since audio doesn't involve visual motion.
 *
 * @example
 * ```tsx
 * const soundscape = useSoundscape([
 *   { src: '/audio/wind.ogg', volume: 0.6 },
 *   { src: '/audio/rain.ogg', volume: 0.8, randomOffset: 12 },
 *   { src: '/audio/thunder-distant.ogg', volume: 0.3, active: false },
 * ], { fadeIn: 2, fadeOut: 1.5 })
 *
 * // Dynamically mix layers based on gameplay
 * soundscape.setLayerVolume('/audio/thunder-distant.ogg', 0.7, 1.5)
 * soundscape.setVolume(0.5) // duck the whole soundscape
 * ```
 */
export function useSoundscape(layers: SoundscapeLayer[], opts: SoundscapeOptions = {}): SoundscapeControls {
  const {
    volume: masterVolume = 1,
    fadeIn = 1,
    fadeOut = 1,
    group = 'ambient',
    active = true,
  } = opts

  const masterGainRef = useRef<GainNode | null>(null)
  const layerStatesRef = useRef<Map<string, LayerState>>(new Map())
  const activeRef = useRef(active)

  // Set up master gain node and start all layers
  useEffect(() => {
    const ctx = getAudioCtx()
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0, ctx.currentTime)
    masterGain.connect(getGroupGainNode(group))
    masterGainRef.current = masterGain

    const destroyed = { current: false }

    // Load and start each layer
    const layerStates = layerStatesRef.current
    const loadPromises: Promise<void>[] = []

    for (const layer of layers) {
      const layerGain = ctx.createGain()
      const targetVol = layer.active === false ? 0 : (layer.volume ?? 1)
      layerGain.gain.setValueAtTime(targetVol, ctx.currentTime)
      layerGain.connect(masterGain)

      const state: LayerState = {
        src: layer.src,
        gainNode: layerGain,
        source: null,
        targetVolume: targetVol,
        unregister: null,
      }
      layerStates.set(layer.src, state)

      const p = loadBuffer(layer.src).then((buf) => {
        if (destroyed.current) return
        const source = ctx.createBufferSource()
        source.buffer = buf
        source.loop = true
        source.connect(layerGain)

        const offset = layer.randomOffset && layer.randomOffset > 0
          ? Math.random() * layer.randomOffset
          : 0

        source.start(0, offset % buf.duration)
        state.source = source
        state.unregister = registerGroupSource(group, () => {
          try {
            source.stop()
          } catch {
            /* already stopped */
          }
        })
      })

      loadPromises.push(p)
    }

    // Fade in once all layers have started
    Promise.all(loadPromises).then(() => {
      if (destroyed.current) return
      if (!activeRef.current) return
      const now = ctx.currentTime
      if (fadeIn > 0) {
        masterGain.gain.cancelScheduledValues(now)
        masterGain.gain.setValueAtTime(0, now)
        masterGain.gain.linearRampToValueAtTime(masterVolume, now + fadeIn)
      } else {
        masterGain.gain.setValueAtTime(masterVolume, now)
      }
    })

    return () => {
      destroyed.current = true
      const now = ctx.currentTime
      const stopAll = () => {
        for (const state of layerStates.values()) {
          state.unregister?.()
          if (state.source) {
            try {
              state.source.stop()
            } catch {
              /* already stopped */
            }
          }
          state.gainNode.disconnect()
        }
        layerStates.clear()
        masterGain.disconnect()
      }

      if (fadeOut > 0) {
        masterGain.gain.cancelScheduledValues(now)
        masterGain.gain.setValueAtTime(masterGain.gain.value, now)
        masterGain.gain.linearRampToValueAtTime(0, now + fadeOut)
        setTimeout(stopAll, fadeOut * 1000 + 50)
      } else {
        stopAll()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync active state changes (fade in / out without unmounting)
  useEffect(() => {
    activeRef.current = active
    const masterGain = masterGainRef.current
    if (!masterGain) return
    const ctx = getAudioCtx()
    const now = ctx.currentTime
    const target = active ? masterVolume : 0
    const duration = active ? fadeIn : fadeOut

    masterGain.gain.cancelScheduledValues(now)
    masterGain.gain.setValueAtTime(masterGain.gain.value, now)
    if (duration > 0) {
      masterGain.gain.linearRampToValueAtTime(target, now + duration)
    } else {
      masterGain.gain.setValueAtTime(target, now)
    }
  }, [active, masterVolume, fadeIn, fadeOut])

  const setVolume = useCallback((volume: number, duration = 0) => {
    const masterGain = masterGainRef.current
    if (!masterGain) return
    const ctx = getAudioCtx()
    const now = ctx.currentTime
    const clamped = Math.max(0, Math.min(1, volume))
    masterGain.gain.cancelScheduledValues(now)
    masterGain.gain.setValueAtTime(masterGain.gain.value, now)
    if (duration > 0) {
      masterGain.gain.linearRampToValueAtTime(clamped, now + duration)
    } else {
      masterGain.gain.setValueAtTime(clamped, now)
    }
  }, [])

  const setLayerVolume = useCallback((src: string, volume: number, duration = 0) => {
    const state = layerStatesRef.current.get(src)
    if (!state) return
    const ctx = getAudioCtx()
    const now = ctx.currentTime
    const clamped = Math.max(0, Math.min(1, volume))
    state.targetVolume = clamped
    state.gainNode.gain.cancelScheduledValues(now)
    state.gainNode.gain.setValueAtTime(state.gainNode.gain.value, now)
    if (duration > 0) {
      state.gainNode.gain.linearRampToValueAtTime(clamped, now + duration)
    } else {
      state.gainNode.gain.setValueAtTime(clamped, now)
    }
  }, [])

  const fadeLayer = useCallback((src: string, targetVolume: number, duration: number) => {
    setLayerVolume(src, targetVolume, duration)
  }, [setLayerVolume])

  return { setVolume, setLayerVolume, fadeLayer }
}
