import { getAudioCtx, getGroupGainNode } from './audioContext'
import type { AudioGroup } from './audioContext'

// ─── Effect option types ─────────────────────────────────────────────────────

export interface ReverbEffectOptions {
  type: 'reverb'
  /** Room size (0–1). Larger = longer, denser reverb. @default 0.5 */
  roomSize?: number
}

export interface FilterEffectOptions {
  type: 'lowpass' | 'highpass' | 'bandpass'
  /**
   * Cutoff frequency in Hz.
   * @default 3000 for lowpass, 200 for highpass, 1000 for bandpass
   */
  frequency?: number
  /** Resonance / bandwidth factor. @default 1 */
  Q?: number
}

export interface CompressorEffectOptions {
  type: 'compressor'
  /** dB threshold above which gain reduction starts. @default -24 */
  threshold?: number
  /** Compression ratio (input:output dB). @default 4 */
  ratio?: number
  /** Attack time in seconds. @default 0.003 */
  attack?: number
  /** Release time in seconds. @default 0.25 */
  release?: number
}

export interface DelayEffectOptions {
  type: 'delay'
  /** Delay time in seconds. @default 0.2 */
  time?: number
  /** Feedback amount (0–1). @default 0.3 */
  feedback?: number
}

export type GroupEffectOptions =
  | ReverbEffectOptions
  | FilterEffectOptions
  | CompressorEffectOptions
  | DelayEffectOptions

// ─── Effect chain registry ────────────────────────────────────────────────────

/** Tracks the inserted effect node (and optional extra nodes) per group. */
const groupEffectNodes = new Map<AudioGroup | 'master', { entry: AudioNode; exit: AudioNode }>()

// ─── Effect factory ───────────────────────────────────────────────────────────

function buildEffectChain(ctx: AudioContext, opts: GroupEffectOptions): { entry: AudioNode; exit: AudioNode } {
  if (opts.type === 'reverb') {
    const { roomSize = 0.5 } = opts
    const convolver = ctx.createConvolver()

    // Synthetic exponential-decay impulse response — no external file needed
    const duration = 0.3 + roomSize * 2.2 // 0.3 s → 2.5 s
    const length = Math.floor(ctx.sampleRate * duration)
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
    const decay = 2 + roomSize * 3
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
      }
    }
    convolver.buffer = impulse
    return { entry: convolver, exit: convolver }
  }

  if (opts.type === 'lowpass' || opts.type === 'highpass' || opts.type === 'bandpass') {
    const filter = ctx.createBiquadFilter()
    filter.type = opts.type
    const defaultFreq = opts.type === 'lowpass' ? 3000 : opts.type === 'highpass' ? 200 : 1000
    filter.frequency.value = opts.frequency ?? defaultFreq
    filter.Q.value = opts.Q ?? 1
    return { entry: filter, exit: filter }
  }

  if (opts.type === 'compressor') {
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = opts.threshold ?? -24
    comp.ratio.value = opts.ratio ?? 4
    comp.attack.value = opts.attack ?? 0.003
    comp.release.value = opts.release ?? 0.25
    return { entry: comp, exit: comp }
  }

  // delay — feedback loop: entry → delay → feedback → delay (loop), exit = delay output
  const delay = ctx.createDelay(2.0)
  delay.delayTime.value = (opts as DelayEffectOptions).time ?? 0.2
  const fb = ctx.createGain()
  fb.gain.value = (opts as DelayEffectOptions).feedback ?? 0.3
  delay.connect(fb)
  fb.connect(delay)
  return { entry: delay, exit: delay }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Insert an audio effect on a group. Replaces any previously set effect.
 *
 * The signal graph becomes: `groupGain → effect → downstream`.
 *
 * @example
 * // Add cave reverb to SFX group
 * setGroupEffect('sfx', { type: 'reverb', roomSize: 0.8 })
 *
 * // Muffle everything while underwater
 * setGroupEffect('master', { type: 'lowpass', frequency: 800 })
 */
export function setGroupEffect(group: AudioGroup | 'master', opts: GroupEffectOptions): void {
  clearGroupEffect(group)

  const ctx = getAudioCtx()
  const groupGain = getGroupGainNode(group)
  const downstream: AudioNode = group === 'master' ? ctx.destination : getGroupGainNode('master')

  const chain = buildEffectChain(ctx, opts)

  groupGain.disconnect()
  groupGain.connect(chain.entry)
  chain.exit.connect(downstream)

  groupEffectNodes.set(group, chain)
}

/**
 * Remove any effect previously set on a group, restoring the direct signal path.
 *
 * @example
 * clearGroupEffect('sfx')       // remove cave reverb
 * clearGroupEffect('master')    // remove muffling
 */
export function clearGroupEffect(group: AudioGroup | 'master'): void {
  const chain = groupEffectNodes.get(group)
  if (!chain) return

  const ctx = getAudioCtx()
  const groupGain = getGroupGainNode(group)
  const downstream: AudioNode = group === 'master' ? ctx.destination : getGroupGainNode('master')

  try {
    groupGain.disconnect()
  } catch {
    /* already disconnected */
  }
  try {
    chain.exit.disconnect()
  } catch {
    /* already disconnected */
  }

  groupGain.connect(downstream)
  groupEffectNodes.delete(group)
}
