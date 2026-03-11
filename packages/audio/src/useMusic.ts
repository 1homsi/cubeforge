import { useEffect, useRef } from 'react'
import { getAudioCtx, getGroupGainNode, registerGroupSource } from './audioContext'

// ─── Global singleton music state ────────────────────────────────────────────
// Only one music track plays at a time across the entire app. Switching tracks
// automatically crossfades from the old one to the new one.

interface MusicTrack {
  src: string
  source: AudioBufferSourceNode
  gain: GainNode
  unregister: () => void
}

let currentTrack: MusicTrack | null = null

function stopTrack(track: MusicTrack, fadeDuration: number): void {
  const ctx = getAudioCtx()
  const now = ctx.currentTime
  track.gain.gain.cancelScheduledValues(now)
  track.gain.gain.setValueAtTime(track.gain.gain.value, now)
  if (fadeDuration > 0) {
    track.gain.gain.linearRampToValueAtTime(0, now + fadeDuration)
    setTimeout(
      () => {
        try {
          track.source.stop()
        } catch {
          /* already stopped */
        }
        track.gain.disconnect()
        track.unregister()
      },
      fadeDuration * 1000 + 50,
    )
  } else {
    try {
      track.source.stop()
    } catch {
      /* already stopped */
    }
    track.gain.disconnect()
    track.unregister()
  }
}

// ─── Buffer cache (standalone, separate from useSound) ───────────────────────

const musicBufferCache = new Map<string, AudioBuffer>()

async function loadMusicBuffer(src: string): Promise<AudioBuffer> {
  const cached = musicBufferCache.get(src)
  if (cached) return cached
  const res = await fetch(src)
  const data = await res.arrayBuffer()
  const buf = await getAudioCtx().decodeAudioData(data)
  musicBufferCache.set(src, buf)
  return buf
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MusicControls {
  /**
   * Start playing. If a track is already playing it fades out over `fadeDuration`.
   * @param fadeDuration - Seconds to fade in (and fade out the old track). Default: 1.
   */
  play(fadeDuration?: number): void
  /**
   * Stop the currently playing track.
   * @param fadeDuration - Seconds to fade out. Default: 1.
   */
  stop(fadeDuration?: number): void
  /**
   * Immediately crossfade to a different track.
   * @param src - Path to the new audio file.
   * @param fadeDuration - Crossfade duration in seconds. Default: 1.
   */
  crossfadeTo(src: string, fadeDuration?: number): void
  /** Change the volume of the current track. Does not affect group volume. */
  setVolume(v: number): void
  /** Whether this track is currently playing. */
  readonly isPlaying: boolean
}

export interface MusicOptions {
  /** Initial volume (0–1). @default 1 */
  volume?: number
  /** Whether to loop. @default true */
  loop?: boolean
}

/**
 * Singleton music player hook. Only one music track plays at a time globally.
 *
 * When the same component re-renders with a new `src`, the old track is faded
 * out and the new one fades in automatically.
 *
 * @example
 * ```tsx
 * function GameMusic() {
 *   const music = useMusic('/music/level1.ogg', { volume: 0.6 })
 *   useEffect(() => { music.play() }, [])
 *   return null
 * }
 * ```
 */
export function useMusic(src: string, opts: MusicOptions = {}): MusicControls {
  const volRef = useRef(opts.volume ?? 1)
  const loopRef = useRef(opts.loop ?? true)
  const isPlayingRef = useRef(false)
  const srcRef = useRef(src)

  useEffect(() => {
    srcRef.current = src
  }, [src])

  // Stop music on unmount
  useEffect(() => {
    return () => {
      if (currentTrack) {
        stopTrack(currentTrack, 1)
        currentTrack = null
        isPlayingRef.current = false
      }
    }
  }, [])

  const startTrack = (buf: AudioBuffer, fadeDuration: number): void => {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') void ctx.resume()

    // Fade out whatever is playing
    if (currentTrack) {
      stopTrack(currentTrack, fadeDuration)
      currentTrack = null
    }

    const dest = getGroupGainNode('music')
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(dest)

    const source = ctx.createBufferSource()
    source.buffer = buf
    source.loop = loopRef.current
    source.connect(gain)

    const unregister = registerGroupSource('music', () => {
      try {
        source.stop()
      } catch {
        /* already stopped */
      }
      gain.disconnect()
      if (currentTrack?.source === source) {
        currentTrack = null
        isPlayingRef.current = false
      }
    })

    source.onended = () => {
      gain.disconnect()
      unregister()
      if (currentTrack?.source === source) {
        currentTrack = null
        isPlayingRef.current = false
      }
    }

    // Fade in
    if (fadeDuration > 0) {
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(volRef.current, ctx.currentTime + fadeDuration)
    } else {
      gain.gain.value = volRef.current
    }

    source.start()
    currentTrack = { src: srcRef.current, source, gain, unregister }
    isPlayingRef.current = true
  }

  const play = (fadeDuration = 1): void => {
    loadMusicBuffer(srcRef.current)
      .then((buf) => startTrack(buf, fadeDuration))
      .catch(console.error)
  }

  const stop = (fadeDuration = 1): void => {
    if (currentTrack) {
      stopTrack(currentTrack, fadeDuration)
      currentTrack = null
      isPlayingRef.current = false
    }
  }

  const crossfadeTo = (newSrc: string, fadeDuration = 1): void => {
    srcRef.current = newSrc
    loadMusicBuffer(newSrc)
      .then((buf) => startTrack(buf, fadeDuration))
      .catch(console.error)
  }

  const setVolume = (v: number): void => {
    volRef.current = v
    if (currentTrack) currentTrack.gain.gain.value = v
  }

  return {
    play,
    stop,
    crossfadeTo,
    setVolume,
    get isPlaying() {
      return isPlayingRef.current
    },
  }
}
