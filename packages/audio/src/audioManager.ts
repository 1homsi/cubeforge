import {
  disposeAudioContext,
  getAudioCtx,
  getAudioState,
  getGroupGainNode,
  getGroupVolume,
  isGroupMuted,
  registerGroupSource,
  setGroupMute,
  setGroupVolume,
  setMasterVolume,
  stopGroup,
} from './audioContext'
import type { AudioGroup } from './audioContext'
import { getCurrentMusicSrc, loadMusicBuffer, startMusic, stopMusic } from './music'

export interface ManagerMusicOptions {
  /** Track volume (0–1). @default 1 */
  volume?: number
  /** Loop the track. @default true */
  loop?: boolean
  /** Fade-in seconds, also the fade-out of the track being replaced. @default 1 */
  fade?: number
}

export interface ManagerSoundOptions {
  /** Volume (0–1). @default 1 */
  volume?: number
  /** Loop until stopped. @default false */
  loop?: boolean
  /** Mixer group. @default 'sfx' */
  group?: AudioGroup
  /** Playback rate / pitch. @default 1 */
  playbackRate?: number
}

export interface ManagedSound {
  /** Stop this instance now. */
  stop(): void
}

/**
 * The page-level audio controller. It does not depend on React or on <Game>:
 * everything it starts (and every setting it holds) survives <Game> being
 * unmounted and mounted again. See `getAudioManager()`.
 */
export interface AudioManager {
  /** The shared AudioContext (created on first access). */
  readonly context: AudioContext
  /** `'none'` until something touched audio, then the AudioContext state. */
  readonly state: 'none' | AudioContextState
  /**
   * Resume the context. Browsers only allow this after a user gesture, but the
   * engine already resumes on the first pointerdown / keydown / touchend, so
   * you only need this to retry from your own click handler.
   */
  resume(): Promise<void>
  /** Master volume 0–1 (survives remounts). */
  setVolume(v: number): void
  getVolume(): number
  /** Mute / unmute everything; the volume is preserved. */
  setMuted(muted: boolean): void
  readonly muted: boolean
  setGroupVolume(group: AudioGroup, v: number): void
  getGroupVolume(group: AudioGroup): number
  setGroupMuted(group: AudioGroup, muted: boolean): void
  isGroupMuted(group: AudioGroup): boolean
  /**
   * Start (or crossfade to) a soundtrack. Only one track plays at a time. It
   * keeps playing across <Game> remounts until `stopMusic()`.
   * Resolves once the track has started.
   */
  playMusic(src: string, opts?: ManagerMusicOptions): Promise<void>
  stopMusic(fade?: number): void
  /** Source of the playing soundtrack, or null. */
  readonly currentMusic: string | null
  /** Play a one-shot (or looping) sound. Resolves once it has started. */
  playSound(src: string, opts?: ManagerSoundOptions): Promise<ManagedSound>
  /** Stop every sound and the soundtrack. Volume and mute settings are kept. */
  stopAll(): void
  /**
   * Stop everything and close the AudioContext. Volume/mute settings are kept
   * and a later call re-creates the context. Nothing in the engine calls this
   * for you — <Game> unmounting never does.
   */
  dispose(): void
}

const manager: AudioManager = {
  get context() {
    return getAudioCtx()
  },
  get state() {
    return getAudioState().ctx?.state ?? 'none'
  },
  async resume() {
    const ctx = getAudioCtx()
    if (ctx.state !== 'running') await ctx.resume()
  },
  setVolume: (v) => setMasterVolume(v),
  getVolume: () => getGroupVolume('master'),
  setMuted: (m) => setGroupMute('master', m),
  get muted() {
    return isGroupMuted('master')
  },
  setGroupVolume: (g, v) => setGroupVolume(g, v),
  getGroupVolume: (g) => getGroupVolume(g),
  setGroupMuted: (g, m) => setGroupMute(g, m),
  isGroupMuted: (g) => isGroupMuted(g),
  async playMusic(src, opts = {}) {
    const buf = await loadMusicBuffer(src)
    startMusic(buf, {
      src,
      volume: opts.volume ?? 1,
      loop: opts.loop ?? true,
      fade: opts.fade ?? 1,
      owner: manager,
    })
  },
  stopMusic: (fade = 1) => stopMusic(fade),
  get currentMusic() {
    return getCurrentMusicSrc()
  },
  async playSound(src, opts = {}) {
    const buf = await loadMusicBuffer(src)
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') void ctx.resume()
    const group = opts.group ?? 'sfx'
    const gain = ctx.createGain()
    gain.gain.value = opts.volume ?? 1
    gain.connect(getGroupGainNode(group))
    const source = ctx.createBufferSource()
    source.buffer = buf
    source.loop = opts.loop ?? false
    source.playbackRate.value = opts.playbackRate ?? 1
    source.connect(gain)
    let done = false
    const finish = () => {
      if (done) return
      done = true
      source.onended = null
      gain.disconnect()
      unregister()
    }
    const unregister = registerGroupSource(group, () => {
      try {
        source.stop()
      } catch {
        /* already stopped */
      }
      finish()
    })
    source.onended = finish
    source.start()
    return {
      stop() {
        try {
          source.stop()
        } catch {
          /* already stopped */
        }
        finish()
      },
    }
  },
  stopAll() {
    stopMusic(0)
    for (const group of [...getAudioState().groupSources.keys()]) stopGroup(group)
  },
  dispose: () => disposeAudioContext(),
}

/**
 * The page-level audio singleton. Use it for an app-level soundtrack or any
 * audio that must outlive <Game>; it is safe to call before any <Game> exists,
 * from module scope, or from an app-level provider.
 *
 * Lifecycle: <Game> never closes, stops or resets this audio. The shared
 * AudioContext is created once, resumed on the first user gesture, and master
 * volume / mute / group volumes persist until `dispose()` (which keeps them).
 *
 * @example
 * // app-level soundtrack: survives <Game> unmount/remount
 * import { getAudioManager } from 'xipjs'
 * const audio = getAudioManager()
 * audio.setVolume(0.6)
 * void audio.playMusic('/music/theme.ogg') // starts on first gesture
 */
export function getAudioManager(): AudioManager {
  return manager
}
