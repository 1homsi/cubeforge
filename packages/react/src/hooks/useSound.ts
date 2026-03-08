import { useEffect, useRef } from 'react'

// ─── AudioContext ──────────────────────────────────────────────────────────────

let _audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext()
  return _audioCtx
}

// ─── Volume groups ─────────────────────────────────────────────────────────────
// Graph: each sound → group gain → master gain → destination

export type AudioGroup = 'sfx' | 'music'

const groupGainNodes = new Map<AudioGroup | 'master', GainNode>()

function getGroupGainNode(group: AudioGroup | 'master'): GainNode {
  const existing = groupGainNodes.get(group)
  if (existing) return existing

  const ctx  = getAudioCtx()
  const gain = ctx.createGain()
  gain.gain.value = 1

  if (group === 'master') {
    gain.connect(ctx.destination)
  } else {
    gain.connect(getGroupGainNode('master'))
  }

  groupGainNodes.set(group, gain)
  return gain
}

/**
 * Set the volume for a named group ('sfx' or 'music'). Range 0–1.
 *
 * @example
 * setGroupVolume('music', 0.4)
 * setGroupVolume('sfx',   0.8)
 */
export function setGroupVolume(group: AudioGroup, volume: number): void {
  const node = groupGainNodes.get(group)
  if (node) node.gain.value = Math.max(0, Math.min(1, volume))
  else {
    // Node not yet created — create it so the value is applied when first used
    getGroupGainNode(group).gain.value = Math.max(0, Math.min(1, volume))
  }
}

/**
 * Set the master volume (affects all groups). Range 0–1.
 *
 * @example
 * setMasterVolume(0)   // mute all
 * setMasterVolume(1)   // full volume
 */
export function setMasterVolume(volume: number): void {
  getGroupGainNode('master').gain.value = Math.max(0, Math.min(1, volume))
}

/** Read the current volume for a group or master. */
export function getGroupVolume(group: AudioGroup | 'master'): number {
  return groupGainNodes.get(group)?.gain.value ?? 1
}

/**
 * Mute or unmute an audio group.
 *
 * @example
 * setGroupMute('music', true)  // mute music
 * setGroupMute('music', false) // restore music
 */
export function setGroupMute(group: AudioGroup, muted: boolean): void {
  const node = getGroupGainNode(group)
  node.gain.value = muted ? 0 : 1
}

/**
 * Stop all currently playing sounds in a group.
 * (Individual source nodes track is not possible via the group node alone,
 *  so this is handled by setting gain to 0 — sounds stop naturally.)
 */
export function stopGroup(group: AudioGroup): void {
  setGroupMute(group, true)
  // Re-enable after a tick so new sounds can play
  setTimeout(() => {
    const node = groupGainNodes.get(group)
    if (node) node.gain.value = 1
  }, 16)
}

/**
 * Temporarily lower a group's volume by `amount` (0–1) for `duration` seconds,
 * then restore it. Useful for ducking music under SFX.
 *
 * @example
 * duck('music', 0.3, 2) // lower music to 30% for 2 seconds
 */
export function duck(group: AudioGroup, amount: number, duration: number): void {
  const node = getGroupGainNode(group)
  const ctx  = getAudioCtx()
  const now  = ctx.currentTime
  const prev = node.gain.value
  node.gain.cancelScheduledValues(now)
  node.gain.setValueAtTime(prev, now)
  node.gain.linearRampToValueAtTime(amount, now + 0.05)
  node.gain.setValueAtTime(amount, now + duration)
  node.gain.linearRampToValueAtTime(prev, now + duration + 0.2)
}

// ─── Buffer cache ──────────────────────────────────────────────────────────────

const bufferCache = new Map<string, AudioBuffer>()

async function loadBuffer(src: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(src)
  if (cached) return cached
  const res  = await fetch(src)
  const data = await res.arrayBuffer()
  const buf  = await getAudioCtx().decodeAudioData(data)
  bufferCache.set(src, buf)
  return buf
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export interface SoundControls {
  /** Start playing. If already playing and loop=false, restarts from the beginning. */
  play(): void
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
export function useSound(
  src: string,
  opts: { volume?: number; loop?: boolean; group?: AudioGroup } = {},
): SoundControls {
  const bufferRef = useRef<AudioBuffer | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const gainRef   = useRef<GainNode | null>(null)
  const volRef    = useRef(opts.volume ?? 1)
  const loopRef   = useRef(opts.loop   ?? false)
  const groupRef  = useRef(opts.group)

  useEffect(() => {
    loadBuffer(src).then(buf => { bufferRef.current = buf }).catch(console.error)
  }, [src])

  const getDestination = (): GainNode =>
    groupRef.current ? getGroupGainNode(groupRef.current) : getGroupGainNode('master')

  const play = (): void => {
    if (!bufferRef.current) return
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') void ctx.resume()

    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch { /* already stopped */ }
      sourceRef.current = null
    }

    const gain = ctx.createGain()
    gain.gain.value = volRef.current
    gain.connect(getDestination())
    gainRef.current = gain

    const source = ctx.createBufferSource()
    source.buffer  = bufferRef.current
    source.loop    = loopRef.current
    source.connect(gain)
    source.start()
    source.onended = () => { sourceRef.current = null }
    sourceRef.current = source
  }

  const stop = (): void => {
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch { /* already stopped */ }
      sourceRef.current = null
    }
  }

  const setVolume = (v: number): void => {
    volRef.current = v
    if (gainRef.current) gainRef.current.gain.value = v
  }

  const fadeIn = (duration: number): void => {
    if (!bufferRef.current) return
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') void ctx.resume()

    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch { /* already stopped */ }
      sourceRef.current = null
    }

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(volRef.current, ctx.currentTime + duration)
    gain.connect(getDestination())
    gainRef.current = gain

    const source = ctx.createBufferSource()
    source.buffer = bufferRef.current
    source.loop   = loopRef.current
    source.connect(gain)
    source.start()
    source.onended = () => { sourceRef.current = null }
    sourceRef.current = source
  }

  const fadeOut = (duration: number): void => {
    if (!gainRef.current || !sourceRef.current) return
    const ctx = getAudioCtx()
    const now = ctx.currentTime
    gainRef.current.gain.cancelScheduledValues(now)
    gainRef.current.gain.setValueAtTime(gainRef.current.gain.value, now)
    gainRef.current.gain.linearRampToValueAtTime(0, now + duration)
    const src = sourceRef.current
    setTimeout(() => {
      try { src.stop() } catch { /* already stopped */ }
    }, duration * 1000 + 50)
  }

  const crossfadeTo = (newSrc: string, duration: number): void => {
    fadeOut(duration)
    loadBuffer(newSrc).then(buf => {
      if (!buf) return
      const ctx = getAudioCtx()
      if (ctx.state === 'suspended') void ctx.resume()

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(volRef.current, ctx.currentTime + duration)
      gain.connect(getDestination())
      gainRef.current = gain

      const source = ctx.createBufferSource()
      source.buffer = buf
      source.loop   = loopRef.current
      source.connect(gain)
      source.start()
      source.onended = () => { sourceRef.current = null }
      sourceRef.current = source
      bufferRef.current = buf
    }).catch(console.error)
  }

  return { play, stop, setVolume, fadeIn, fadeOut, crossfadeTo }
}
