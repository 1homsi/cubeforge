import { useEffect, useRef } from 'react'

// Shared AudioContext — created on first use (browser requires user gesture first)
let _audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext()
  return _audioCtx
}

// Buffer cache — avoid re-fetching the same file
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

export interface SoundControls {
  /** Start playing. If already playing and loop=false, restarts from the beginning. */
  play(): void
  /** Stop the current playback. */
  stop(): void
  /** Change the volume (0–1). */
  setVolume(v: number): void
}

/**
 * Loads and plays an audio file via the Web Audio API.
 *
 * The AudioContext is created lazily — the first call to `play()` resumes it
 * if the browser suspended it before a user gesture.
 *
 * @example
 * function JumpSfx() {
 *   const { play } = useSound('/jump.wav')
 *   // call play() on jump event
 * }
 */
export function useSound(src: string, opts: { volume?: number; loop?: boolean } = {}): SoundControls {
  const bufferRef = useRef<AudioBuffer | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const gainRef   = useRef<GainNode | null>(null)
  const volRef    = useRef(opts.volume ?? 1)
  const loopRef   = useRef(opts.loop   ?? false)

  useEffect(() => {
    loadBuffer(src).then(buf => { bufferRef.current = buf }).catch(console.error)
  }, [src])

  const play = (): void => {
    if (!bufferRef.current) return
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()

    // Stop previous playback
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch { /* already stopped */ }
      sourceRef.current = null
    }

    const gain = ctx.createGain()
    gain.gain.value = volRef.current
    gain.connect(ctx.destination)
    gainRef.current = gain

    const source = ctx.createBufferSource()
    source.buffer = bufferRef.current
    source.loop = loopRef.current
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
