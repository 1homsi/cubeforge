import { useEffect, useRef } from 'react'
import { getAudioCtx } from './audioContext'

export interface AudioSchedulerOptions {
  /** Beats per minute. */
  bpm: number
  /** Number of beats per bar (time signature numerator). @default 4 */
  beatsPerBar?: number
  /**
   * Lookahead window in seconds. The scheduler fires callbacks for beats
   * that fall within this window on each interval tick.
   * @default 0.1
   */
  lookaheadSec?: number
  /**
   * How often the scheduler runs in milliseconds. Lower = tighter timing,
   * higher CPU. 25 ms is a good balance for game use.
   * @default 25
   */
  intervalMs?: number
}

/**
 * Called for each beat. `beat` is 0-indexed within the bar, `bar` is 0-indexed
 * from when the scheduler started, `time` is the AudioContext timestamp at which
 * the beat falls — use it for sample-accurate scheduling of sounds.
 */
export type BeatHandler = (beat: number, bar: number, time: number) => void

/**
 * Called at the start of each bar (when beat === 0). `time` is the AudioContext
 * timestamp of beat 0 in this bar.
 */
export type BarHandler = (bar: number, time: number) => void

export interface AudioSchedulerControls {
  /** Start the scheduler. Resets beat/bar counters to 0. */
  start(): void
  /** Stop the scheduler. Handlers are preserved and will fire again after `start()`. */
  stop(): void
  /**
   * Register a callback fired on every scheduled beat.
   * Returns an unsubscribe function.
   *
   * @example
   * scheduler.onBeat((beat, bar, time) => {
   *   // Schedule a sound at the exact beat time
   *   sound.play({ audioTime: time })
   * })
   */
  onBeat(handler: BeatHandler): () => void
  /**
   * Register a callback fired at the start of every bar (beat 0).
   * Returns an unsubscribe function.
   */
  onBar(handler: BarHandler): () => void
  /** Whether the scheduler is currently running. */
  readonly isRunning: boolean
  /** Current beat index within the bar (0 to beatsPerBar-1). */
  readonly currentBeat: number
  /** Current bar number from start (0-indexed). */
  readonly currentBar: number
}

/**
 * BPM-synced beat scheduler using the Web Audio API lookahead pattern.
 *
 * Beat callbacks receive the AudioContext time at which each beat occurs, so you
 * can use `AudioBufferSourceNode.start(time)` for sample-accurate scheduling — no
 * drift or jitter from `setTimeout` alone.
 *
 * @example
 * // Rhythm game — play a hit sound on every beat
 * const scheduler = useAudioScheduler({ bpm: 120, beatsPerBar: 4 })
 * const { play } = useSound('/sfx/beat.wav', { group: 'sfx' })
 *
 * scheduler.onBeat((_beat, _bar, time) => {
 *   play({ audioTime: time })
 * })
 *
 * // Start on user gesture
 * <button onClick={() => scheduler.start()}>Play</button>
 *
 * @example
 * // Change music section every 4 bars
 * scheduler.onBar((bar) => {
 *   if (bar % 4 === 0) switchMusicSection(bar / 4)
 * })
 */
export function useAudioScheduler(opts: AudioSchedulerOptions): AudioSchedulerControls {
  const { bpm, beatsPerBar = 4, lookaheadSec = 0.1, intervalMs = 25 } = opts

  const beatHandlers = useRef<Set<BeatHandler>>(new Set())
  const barHandlers = useRef<Set<BarHandler>>(new Set())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextBeatTimeRef = useRef(0)
  const nextBeatIndexRef = useRef(0)
  const isRunningRef = useRef(false)
  const currentBeatRef = useRef(0)
  const currentBarRef = useRef(0)

  const beatIntervalSec = 60 / bpm

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      isRunningRef.current = false
    }
  }, [])

  const schedule = (): void => {
    const ctx = getAudioCtx()
    const scheduleUntil = ctx.currentTime + lookaheadSec

    while (nextBeatTimeRef.current < scheduleUntil) {
      const time = nextBeatTimeRef.current
      const beatIndex = nextBeatIndexRef.current
      const beat = beatIndex % beatsPerBar
      const bar = Math.floor(beatIndex / beatsPerBar)

      currentBeatRef.current = beat
      currentBarRef.current = bar

      for (const h of beatHandlers.current) h(beat, bar, time)
      if (beat === 0) {
        for (const h of barHandlers.current) h(bar, time)
      }

      nextBeatTimeRef.current += beatIntervalSec
      nextBeatIndexRef.current++
    }
  }

  const start = (): void => {
    if (isRunningRef.current) return

    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') void ctx.resume()

    nextBeatTimeRef.current = ctx.currentTime
    nextBeatIndexRef.current = 0
    currentBeatRef.current = 0
    currentBarRef.current = 0
    isRunningRef.current = true

    schedule()
    timerRef.current = setInterval(schedule, intervalMs)
  }

  const stop = (): void => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    isRunningRef.current = false
  }

  const onBeat = (handler: BeatHandler): (() => void) => {
    beatHandlers.current.add(handler)
    return () => beatHandlers.current.delete(handler)
  }

  const onBar = (handler: BarHandler): (() => void) => {
    barHandlers.current.add(handler)
    return () => barHandlers.current.delete(handler)
  }

  return {
    start,
    stop,
    onBeat,
    onBar,
    get isRunning() {
      return isRunningRef.current
    },
    get currentBeat() {
      return currentBeatRef.current
    },
    get currentBar() {
      return currentBarRef.current
    },
  }
}
