import { useEffect, useRef } from 'react'
import { getAudioCtx, getGroupGainNode } from './audioContext'
import type { AudioGroup } from './audioContext'

// Re-export everything from audioContext for backwards compatibility
export {
  getAudioCtx,
  getGroupGainNode,
  setGroupVolume,
  setMasterVolume,
  getGroupVolume,
  setGroupMute,
  stopGroup,
  duck,
} from './audioContext'
export type { AudioGroup } from './audioContext'

// ─── Buffer cache with reference counting ────────────────────────────────────

const bufferCache = new Map<string, AudioBuffer>()
const bufferRefCount = new Map<string, number>()

/** @internal Exposed for testing. */
export function _getBufferCache(): Map<string, AudioBuffer> {
  return bufferCache
}
/** @internal Exposed for testing. */
export function _getBufferRefCount(): Map<string, number> {
  return bufferRefCount
}

async function loadBuffer(src: string): Promise<AudioBuffer> {
  // Increment ref count
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
  const count = bufferRefCount.get(src) ?? 0
  if (count <= 1) {
    bufferRefCount.delete(src)
    bufferCache.delete(src)
  } else {
    bufferRefCount.set(src, count - 1)
  }
}

// ─── Source pool ─────────────────────────────────────────────────────────────

interface PoolEntry {
  source: AudioBufferSourceNode
  gain: GainNode
}

function createPoolEntry(
  ctx: AudioContext,
  buffer: AudioBuffer,
  loop: boolean,
  volume: number,
  destination: GainNode,
): PoolEntry {
  const gain = ctx.createGain()
  gain.gain.value = volume
  gain.connect(destination)

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = loop
  source.connect(gain)

  return { source, gain }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface SoundControls {
  /**
   * Start playing. If already playing and loop=false, restarts from the beginning.
   * @param opts.delay — optional delay in seconds before playback begins
   *   (uses AudioContext.currentTime scheduling for sample-accurate timing)
   */
  play(opts?: { delay?: number }): void
  /** Stop the current playback. */
  stop(): void
  /** Change this sound's volume (0–1). Does not affect the group or master volume. */
  setVolume(v: number): void
  /**
   * Fade in: ramp gain from 0 to the current volume over `duration` seconds.
   * Starts playback if not already playing.
   */
  fadeIn(duration: number): void
  /**
   * Fade out: ramp gain to 0 over `duration` seconds, then stop.
   */
  fadeOut(duration: number): void
  /**
   * Cross-fade to a different sound source over `duration` seconds.
   * Fades out the current sound while fading in the new one.
   */
  crossfadeTo(src: string, duration: number): void
}

export interface SoundOptions {
  volume?: number
  loop?: boolean
  group?: AudioGroup
  /**
   * Maximum number of concurrent instances of this sound.
   * When exceeded, the oldest instance is stopped to make room.
   * @default 4
   */
  maxInstances?: number
}

/**
 * Loads and plays an audio file via the Web Audio API.
 *
 * The AudioContext is created lazily — the first call to `play()` resumes it
 * if the browser suspended it before a user gesture.
 *
 * Assign a `group` to route through the shared volume mixer:
 * - `'sfx'`   — sound effects (use `setGroupVolume('sfx', v)`)
 * - `'music'` — background music (use `setGroupVolume('music', v)`)
 * - `undefined` — connects directly to the master gain node
 *
 * @example
 * const { play, fadeIn, fadeOut } = useSound('/music.ogg', { group: 'music', loop: true })
 */
export function useSound(src: string, opts: SoundOptions = {}): SoundControls {
  const bufferRef = useRef<AudioBuffer | null>(null)
  const activeInstances = useRef<PoolEntry[]>([])
  const volRef = useRef(opts.volume ?? 1)
  const loopRef = useRef(opts.loop ?? false)
  const groupRef = useRef(opts.group)
  const maxInstances = opts.maxInstances ?? 4

  useEffect(() => {
    let cancelled = false
    loadBuffer(src)
      .then((buf) => {
        if (!cancelled) bufferRef.current = buf
      })
      .catch(console.error)

    return () => {
      cancelled = true
      // Stop all active playback
      for (const entry of activeInstances.current) {
        try {
          entry.source.stop()
        } catch {
          /* already stopped */
        }
        entry.gain.disconnect()
      }
      activeInstances.current = []
      bufferRef.current = null
      releaseBuffer(src)
    }
  }, [src])

  const getDestination = (): GainNode =>
    groupRef.current ? getGroupGainNode(groupRef.current) : getGroupGainNode('master')

  const removeInstance = (entry: PoolEntry): void => {
    const idx = activeInstances.current.indexOf(entry)
    if (idx !== -1) activeInstances.current.splice(idx, 1)
  }

  const stopOldestIfNeeded = (): void => {
    while (activeInstances.current.length >= maxInstances) {
      const oldest = activeInstances.current.shift()
      if (oldest) {
        try {
          oldest.source.stop()
        } catch {
          /* already stopped */
        }
        oldest.gain.disconnect()
      }
    }
  }

  const play = (playOpts?: { delay?: number }): void => {
    if (!bufferRef.current) return
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') void ctx.resume()

    stopOldestIfNeeded()

    const entry = createPoolEntry(ctx, bufferRef.current, loopRef.current, volRef.current, getDestination())

    entry.source.onended = () => {
      removeInstance(entry)
      entry.gain.disconnect()
    }

    const delay = playOpts?.delay
    if (delay && delay > 0) {
      entry.source.start(ctx.currentTime + delay)
    } else {
      entry.source.start()
    }

    activeInstances.current.push(entry)
  }

  const stop = (): void => {
    for (const entry of activeInstances.current) {
      try {
        entry.source.stop()
      } catch {
        /* already stopped */
      }
      entry.gain.disconnect()
    }
    activeInstances.current = []
  }

  const setVolume = (v: number): void => {
    volRef.current = v
    for (const entry of activeInstances.current) {
      entry.gain.gain.value = v
    }
  }

  const fadeIn = (duration: number): void => {
    if (!bufferRef.current) return
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') void ctx.resume()

    // Stop existing
    stop()

    const entry = createPoolEntry(ctx, bufferRef.current, loopRef.current, 0, getDestination())
    entry.gain.gain.setValueAtTime(0, ctx.currentTime)
    entry.gain.gain.linearRampToValueAtTime(volRef.current, ctx.currentTime + duration)

    entry.source.onended = () => {
      removeInstance(entry)
      entry.gain.disconnect()
    }

    entry.source.start()
    activeInstances.current.push(entry)
  }

  const fadeOut = (duration: number): void => {
    if (activeInstances.current.length === 0) return
    const ctx = getAudioCtx()
    const now = ctx.currentTime

    for (const entry of [...activeInstances.current]) {
      entry.gain.gain.cancelScheduledValues(now)
      entry.gain.gain.setValueAtTime(entry.gain.gain.value, now)
      entry.gain.gain.linearRampToValueAtTime(0, now + duration)
      setTimeout(
        () => {
          try {
            entry.source.stop()
          } catch {
            /* already stopped */
          }
          removeInstance(entry)
          entry.gain.disconnect()
        },
        duration * 1000 + 50,
      )
    }
  }

  const crossfadeTo = (newSrc: string, duration: number): void => {
    fadeOut(duration)
    loadBuffer(newSrc)
      .then((buf) => {
        if (!buf) return
        const ctx = getAudioCtx()
        if (ctx.state === 'suspended') void ctx.resume()

        const entry = createPoolEntry(ctx, buf, loopRef.current, 0, getDestination())
        entry.gain.gain.setValueAtTime(0, ctx.currentTime)
        entry.gain.gain.linearRampToValueAtTime(volRef.current, ctx.currentTime + duration)

        entry.source.onended = () => {
          removeInstance(entry)
          entry.gain.disconnect()
        }

        entry.source.start()
        activeInstances.current.push(entry)
        bufferRef.current = buf
      })
      .catch(console.error)
  }

  return { play, stop, setVolume, fadeIn, fadeOut, crossfadeTo }
}
