import { getAudioCtx, getAudioState, getGroupGainNode, registerGroupSource } from './audioContext'
import type { MusicTrack } from './audioContext'

// ─── Music engine ───────────────────────────────────────────────────────────
// Only one music track plays at a time across the whole page. The current
// track lives in the shared audio state (see audioContext.ts), so it is owned
// by the page, not by whichever React tree started it.

const musicBufferCache = new Map<string, AudioBuffer>()
const musicBufferLoads = new Map<string, Promise<AudioBuffer>>()

/** Fetch + decode once; concurrent callers (e.g. StrictMode double effects) share one request. */
export function loadMusicBuffer(src: string): Promise<AudioBuffer> {
  const cached = musicBufferCache.get(src)
  if (cached) return Promise.resolve(cached)
  const inflight = musicBufferLoads.get(src)
  if (inflight) return inflight
  const p = (async () => {
    const res = await fetch(src)
    const data = await res.arrayBuffer()
    const buf = await getAudioCtx().decodeAudioData(data)
    musicBufferCache.set(src, buf)
    return buf
  })()
  musicBufferLoads.set(src, p)
  const done = () => musicBufferLoads.delete(src)
  p.then(done, done)
  return p
}

function teardown(track: MusicTrack): void {
  const s = getAudioState()
  if (track.timer) clearTimeout(track.timer)
  track.timer = null
  s.fading.delete(track)
  try {
    track.source.stop()
  } catch {
    /* already stopped */
  }
  track.source.onended = null
  track.gain.disconnect()
  track.unregister()
}

function fadeOutAndTeardown(track: MusicTrack, fadeDuration: number): void {
  if (fadeDuration <= 0) return teardown(track)
  const s = getAudioState()
  const ctx = getAudioCtx()
  const now = ctx.currentTime
  track.gain.gain.cancelScheduledValues(now)
  track.gain.gain.setValueAtTime(track.gain.gain.value, now)
  track.gain.gain.linearRampToValueAtTime(0, now + fadeDuration)
  s.fading.add(track)
  track.timer = setTimeout(() => teardown(track), fadeDuration * 1000 + 50)
}

export interface StartMusicOptions {
  src: string
  volume: number
  loop: boolean
  /** Fade-in seconds (also the fade-out of the track being replaced). */
  fade: number
  /** Identity used by `isMusicOwnedBy` / owner-scoped stops. */
  owner?: object | null
}

/** Start a track, fading out whatever music was playing. */
export function startMusic(buf: AudioBuffer, o: StartMusicOptions): void {
  const s = getAudioState()
  const ctx = getAudioCtx()
  if (ctx.state === 'suspended') void ctx.resume()

  if (s.music) {
    const old = s.music
    s.music = null
    fadeOutAndTeardown(old, o.fade)
  }

  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(getGroupGainNode('music'))

  const source = ctx.createBufferSource()
  source.buffer = buf
  source.loop = o.loop
  source.connect(gain)

  let track: MusicTrack
  const unregister = registerGroupSource('music', () => {
    // stopGroup('music'): halt immediately
    if (s.music === track) s.music = null
    teardown(track)
  })

  source.onended = () => {
    gain.disconnect()
    unregister()
    if (getAudioState().music === track) {
      getAudioState().music = null
    }
  }

  if (o.fade > 0) {
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(o.volume, ctx.currentTime + o.fade)
  } else {
    gain.gain.value = o.volume
  }

  source.start()
  track = { src: o.src, source, gain, unregister, owner: o.owner ?? null, timer: null }
  s.music = track
}

/** Stop the current track, fading out over `fadeDuration` seconds. */
export function stopMusic(fadeDuration = 1): void {
  const s = getAudioState()
  const track = s.music
  if (!track) return
  s.music = null
  fadeOutAndTeardown(track, fadeDuration)
}

/** Stop the current track only if `owner` started it. */
export function stopMusicOwnedBy(owner: object, fadeDuration = 1): void {
  if (getAudioState().music?.owner === owner) stopMusic(fadeDuration)
}

export function isMusicOwnedBy(owner: object): boolean {
  return getAudioState().music?.owner === owner
}

/** Source of the track that is currently playing, or null. */
export function getCurrentMusicSrc(): string | null {
  return getAudioState().music?.src ?? null
}

/** Set the live gain of the current track (does not touch group/master volume). */
export function setCurrentMusicVolume(v: number, owner?: object): void {
  const t = getAudioState().music
  if (t && (!owner || t.owner === owner)) t.gain.gain.value = v
}
