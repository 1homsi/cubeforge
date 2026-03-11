import { useEffect, useRef } from 'react'
import { getAudioCtx, getGroupGainNode } from './audioContext'
import type { AudioGroup } from './audioContext'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StreamedMusicOptions {
  volume?: number
  loop?: boolean
  group?: AudioGroup
  /**
   * Start playing as soon as the hook mounts (requires a prior user gesture to
   * unlock the AudioContext — use `play()` if you need explicit control).
   * @default false
   */
  autoplay?: boolean
}

export interface StreamedMusicControls {
  /** Start / resume playback. Requires a prior user gesture if the AudioContext was suspended. */
  play(): void
  /** Pause playback, preserving the current position. */
  pause(): void
  /** Stop and rewind to the beginning. */
  stop(): void
  /** Change the volume (0–1). Does not affect group or master volume. */
  setVolume(v: number): void
  /** Whether the track is currently playing. */
  readonly isPlaying: boolean
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Stream a long-form audio file (music, ambience) via an HTML `<audio>` element
 * connected into the Web Audio API graph.
 *
 * Unlike `useSound` / `useMusic`, **the file is never fully decoded into memory**
 * — the browser streams it on demand, making this suitable for large tracks
 * (several MB of music, hour-long ambience loops, etc.) without blocking game load.
 *
 * Limitations compared to `useMusic`:
 * - No sample-accurate crossfade (use `setGroupVolumeFaded` for smooth transitions)
 * - One track per hook instance (no automatic "only one music track" singleton)
 *
 * @example
 * // Large background track that loads as it plays
 * const music = useStreamedMusic('/assets/music/theme.mp3', {
 *   loop: true,
 *   group: 'music',
 *   volume: 0.6,
 * })
 * // Start on user gesture
 * <button onClick={() => music.play()}>Start</button>
 */
export function useStreamedMusic(src: string, opts: StreamedMusicOptions = {}): StreamedMusicControls {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const volRef = useRef(opts.volume ?? 1)
  const groupRef = useRef(opts.group)
  const isPlayingRef = useRef(false)

  useEffect(() => {
    const audio = new Audio()
    audio.src = src
    audio.loop = opts.loop ?? false
    // preload='none' — don't fetch until play() is called
    audio.preload = 'none'
    audioRef.current = audio

    const ctx = getAudioCtx()
    const source = ctx.createMediaElementSource(audio)
    const gain = ctx.createGain()
    gain.gain.value = volRef.current
    source.connect(gain)
    gain.connect(groupRef.current ? getGroupGainNode(groupRef.current) : getGroupGainNode('master'))

    sourceRef.current = source
    gainRef.current = gain

    audio.addEventListener('play', () => {
      isPlayingRef.current = true
    })
    audio.addEventListener('pause', () => {
      isPlayingRef.current = false
    })
    audio.addEventListener('ended', () => {
      isPlayingRef.current = false
    })

    if (opts.autoplay) {
      void ctx.resume().then(() => audio.play().catch(() => {}))
    }

    return () => {
      audio.pause()
      audio.src = ''
      try {
        source.disconnect()
      } catch {
        /* ok */
      }
      try {
        gain.disconnect()
      } catch {
        /* ok */
      }
      sourceRef.current = null
      gainRef.current = null
      audioRef.current = null
      isPlayingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  const play = (): void => {
    const audio = audioRef.current
    if (!audio) return
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') void ctx.resume()
    void audio.play().catch(() => {})
  }

  const pause = (): void => {
    audioRef.current?.pause()
  }

  const stop = (): void => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    isPlayingRef.current = false
  }

  const setVolume = (v: number): void => {
    volRef.current = v
    if (gainRef.current) gainRef.current.gain.value = v
  }

  return {
    play,
    pause,
    stop,
    setVolume,
    get isPlaying() {
      return isPlayingRef.current
    },
  }
}
