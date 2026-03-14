import { useEffect, useRef } from 'react'
import { getAudioCtx, getGroupGainNode } from './audioContext'
import type { AudioGroup } from './audioContext'

export interface AudioAnalyserOptions {
  /**
   * FFT size — controls frequency resolution. Must be a power of 2 between 32 and 32768.
   * Higher = more detail but more CPU. `frequencyBinCount` = fftSize / 2.
   * @default 2048
   */
  fftSize?: number
  /**
   * Smoothing constant 0–1. Higher values average over more frames for a smoother
   * response; lower values react faster. @default 0.8
   */
  smoothingTimeConstant?: number
  /**
   * Audio group to tap into. The analyser is connected as a fan-out from the group's
   * gain node, so it never interrupts the audio signal path.
   * @default 'master'
   */
  group?: AudioGroup | 'master'
}

export interface AudioAnalyserControls {
  /**
   * Get the current frequency-domain data. Values are 0–255 magnitudes across
   * `frequencyBinCount` bins. Call this every animation frame for live data.
   */
  getFrequencyData(): Uint8Array<ArrayBuffer>
  /**
   * Get the current time-domain (waveform) data. Values are 0–255 where 128
   * represents zero amplitude. Useful for oscilloscope-style visualizers.
   */
  getWaveformData(): Uint8Array<ArrayBuffer>
  /**
   * Average magnitude across all frequency bins (0–255). A quick measure of
   * overall loudness/energy in the signal.
   */
  getAverageFrequency(): number
  /**
   * Returns `true` when bass-range energy exceeds `threshold`. Useful for simple
   * beat detection — trigger particle effects, camera shake, etc. on each beat.
   *
   * @param threshold — average bass magnitude (0–255) required for a beat. @default 180
   *
   * @example
   * // In your game loop
   * if (analyser.isBeat()) spawnParticles()
   */
  isBeat(threshold?: number): boolean
  /** Direct access to the underlying AnalyserNode for custom analysis. `null` before mount. */
  readonly analyserNode: AnalyserNode | null
}

/**
 * Tap into an audio group's output and expose real-time frequency / waveform data.
 *
 * The analyser is connected as a passive listener — it never interrupts the signal
 * path. Safe to add or remove at any time.
 *
 * @example
 * // Music visualizer
 * const analyser = useAudioAnalyser({ group: 'music', fftSize: 512 })
 *
 * useGameLoop(() => {
 *   const freq = analyser.getFrequencyData()
 *   drawSpectrum(freq)
 * })
 *
 * @example
 * // Beat detection
 * const analyser = useAudioAnalyser({ group: 'music' })
 *
 * useGameLoop(() => {
 *   if (analyser.isBeat(160)) cameraShake()
 * })
 */
export function useAudioAnalyser(opts: AudioAnalyserOptions = {}): AudioAnalyserControls {
  const { fftSize = 2048, smoothingTimeConstant = 0.8, group = 'master' } = opts

  const analyserRef = useRef<AnalyserNode | null>(null)
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const waveDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  useEffect(() => {
    const ctx = getAudioCtx()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = fftSize
    analyser.smoothingTimeConstant = smoothingTimeConstant

    // Fan-out: group gain → analyser (passive tap, signal still reaches master)
    const groupGain = getGroupGainNode(group)
    groupGain.connect(analyser)

    analyserRef.current = analyser
    freqDataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
    waveDataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>

    return () => {
      try {
        groupGain.disconnect(analyser)
      } catch {
        /* already disconnected */
      }
      analyserRef.current = null
      freqDataRef.current = null
      waveDataRef.current = null
    }
  }, [fftSize, smoothingTimeConstant, group])

  const getFrequencyData = (): Uint8Array<ArrayBuffer> => {
    const analyser = analyserRef.current
    const data = freqDataRef.current
    if (!analyser || !data) return new Uint8Array(0) as Uint8Array<ArrayBuffer>
    analyser.getByteFrequencyData(data)
    return data
  }

  const getWaveformData = (): Uint8Array<ArrayBuffer> => {
    const analyser = analyserRef.current
    const data = waveDataRef.current
    if (!analyser || !data) return new Uint8Array(0) as Uint8Array<ArrayBuffer>
    analyser.getByteTimeDomainData(data)
    return data
  }

  const getAverageFrequency = (): number => {
    const analyser = analyserRef.current
    const data = freqDataRef.current
    if (!analyser || !data) return 0
    analyser.getByteFrequencyData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    return sum / data.length
  }

  const isBeat = (threshold = 180): boolean => {
    const analyser = analyserRef.current
    const data = freqDataRef.current
    if (!analyser || !data) return false
    analyser.getByteFrequencyData(data)
    // Sample the lower quarter of bins (bass range)
    const bassEnd = Math.max(1, Math.floor(data.length / 4))
    let sum = 0
    for (let i = 0; i < bassEnd; i++) sum += data[i]
    return sum / bassEnd > threshold
  }

  return {
    getFrequencyData,
    getWaveformData,
    getAverageFrequency,
    isBeat,
    get analyserNode() {
      return analyserRef.current
    },
  }
}
