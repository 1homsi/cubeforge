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
 * const { play } = useSound('/jump.wav', { group: 'sfx', volume: 0.8 })
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

  const play = (): void => {
    if (!bufferRef.current) return
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') void ctx.resume()

    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch { /* already stopped */ }
      sourceRef.current = null
    }

    // Per-sound gain → group gain (or master if no group)
    const gain = ctx.createGain()
    gain.gain.value = volRef.current
    const destination = groupRef.current
      ? getGroupGainNode(groupRef.current)
      : getGroupGainNode('master')
    gain.connect(destination)
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

  return { play, stop, setVolume }
}
