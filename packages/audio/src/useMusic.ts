import { useEffect, useRef } from 'react'
import {
  isMusicOwnedBy,
  loadMusicBuffer,
  setCurrentMusicVolume,
  startMusic,
  stopMusic,
  stopMusicOwnedBy,
} from './music'

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
  /**
   * Keep the track playing when the component using this hook unmounts. Use it
   * for an app-level soundtrack started from a component that may remount.
   * (Music always survives <Game> unmounting when the hook lives outside it;
   * for non-React code use `getAudioManager().playMusic()`.)
   * @default false
   */
  persistent?: boolean
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
  const persistentRef = useRef(opts.persistent ?? false)
  const srcRef = useRef(src)
  // Identity of this hook instance: lets unmount stop only the track THIS hook
  // started, never an app-level soundtrack that another component owns.
  const ownerRef = useRef<object>({})

  persistentRef.current = opts.persistent ?? false

  useEffect(() => {
    srcRef.current = src
  }, [src])

  // Stop this hook's music on unmount (unless persistent)
  useEffect(() => {
    const owner = ownerRef.current
    return () => {
      if (!persistentRef.current) stopMusicOwnedBy(owner, 1)
    }
  }, [])

  const startTrack = (buf: AudioBuffer, fadeDuration: number): void => {
    startMusic(buf, {
      src: srcRef.current,
      volume: volRef.current,
      loop: loopRef.current,
      fade: fadeDuration,
      owner: ownerRef.current,
    })
  }

  const play = (fadeDuration = 1): void => {
    loadMusicBuffer(srcRef.current)
      .then((buf) => startTrack(buf, fadeDuration))
      .catch(console.error)
  }

  const stop = (fadeDuration = 1): void => {
    stopMusic(fadeDuration)
  }

  const crossfadeTo = (newSrc: string, fadeDuration = 1): void => {
    srcRef.current = newSrc
    loadMusicBuffer(newSrc)
      .then((buf) => startTrack(buf, fadeDuration))
      .catch(console.error)
  }

  const setVolume = (v: number): void => {
    volRef.current = v
    setCurrentMusicVolume(v)
  }

  return {
    play,
    stop,
    crossfadeTo,
    setVolume,
    get isPlaying() {
      return isMusicOwnedBy(ownerRef.current)
    },
  }
}
