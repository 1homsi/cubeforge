import { tween, Ease } from './tween'

export interface TimelineEntry {
  from: number
  to: number
  duration: number
  ease?: (t: number) => number
  onUpdate: (value: number) => void
  onComplete?: () => void
  delay?: number
}

export interface TweenTimeline {
  add(entry: TimelineEntry): TweenTimeline
  start(): void
  stop(): void
  isRunning(): boolean
}

export function createTimeline(): TweenTimeline {
  const entries: TimelineEntry[] = []
  let running = false
  let currentTween: ReturnType<typeof tween> | null = null
  let delayTimer: ReturnType<typeof setTimeout> | null = null
  let rafId: number | null = null
  let lastTime = 0

  function clearCurrent() {
    if (currentTween) {
      currentTween.stop()
      currentTween = null
    }
    if (delayTimer !== null) {
      clearTimeout(delayTimer)
      delayTimer = null
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  function tick(now: number) {
    if (!running || !currentTween) return
    const dt = (now - lastTime) / 1000
    lastTime = now
    currentTween.update(dt)
    if (!currentTween.isComplete) {
      rafId = requestAnimationFrame(tick)
    }
    // completion is handled via the onComplete callback passed to tween()
  }

  function playEntry(index: number) {
    if (index >= entries.length) {
      running = false
      return
    }

    const entry = entries[index]
    const delay = entry.delay ?? 0

    const startTween = () => {
      if (!running) return
      currentTween = tween(
        entry.from,
        entry.to,
        entry.duration,
        entry.ease ?? Ease.linear,
        entry.onUpdate,
        () => {
          entry.onComplete?.()
          playEntry(index + 1)
        },
      )
      lastTime = performance.now()
      rafId = requestAnimationFrame(tick)
    }

    if (delay > 0) {
      delayTimer = setTimeout(startTween, delay * 1000)
    } else {
      startTween()
    }
  }

  const timeline: TweenTimeline = {
    add(entry: TimelineEntry): TweenTimeline {
      entries.push(entry)
      return timeline
    },
    start() {
      clearCurrent()
      running = true
      playEntry(0)
    },
    stop() {
      running = false
      clearCurrent()
    },
    isRunning() {
      return running
    },
  }

  return timeline
}
