import { describe, it, expect, vi } from 'vitest'
import type { AnimationStateComponent, AnimationClipDefinition } from '../components/animationState'
import { resolveClip } from '../renderSystem'

/** Create a minimal AnimationState component for testing. */
function makeAnimState(overrides?: Partial<AnimationStateComponent>): AnimationStateComponent {
  return {
    type: 'AnimationState',
    frames: [],
    fps: 12,
    loop: true,
    playing: true,
    currentIndex: 0,
    timer: 0,
    _completed: false,
    ...overrides,
  }
}

describe('resolveClip', () => {
  it('copies frames, fps, loop from clip definition', () => {
    const anim = makeAnimState({ frames: [99], fps: 5, loop: false })
    const clip: AnimationClipDefinition = { frames: [0, 1, 2], fps: 10, loop: true }
    resolveClip(anim, clip)

    expect(anim.frames).toEqual([0, 1, 2])
    expect(anim.fps).toBe(10)
    expect(anim.loop).toBe(true)
  })

  it('defaults fps to 12 and loop to true when clip omits them', () => {
    const anim = makeAnimState({ fps: 99, loop: false })
    const clip: AnimationClipDefinition = { frames: [5, 6] }
    resolveClip(anim, clip)

    expect(anim.fps).toBe(12)
    expect(anim.loop).toBe(true)
  })

  it('resets currentIndex, timer, and _completed', () => {
    const anim = makeAnimState({ currentIndex: 3, timer: 0.5, _completed: true })
    resolveClip(anim, { frames: [0] })

    expect(anim.currentIndex).toBe(0)
    expect(anim.timer).toBe(0)
    expect(anim._completed).toBe(false)
  })

  it('sets playing to true', () => {
    const anim = makeAnimState({ playing: false })
    resolveClip(anim, { frames: [0, 1] })

    expect(anim.playing).toBe(true)
  })

  it('copies onComplete from clip', () => {
    const cb = vi.fn()
    const anim = makeAnimState()
    resolveClip(anim, { frames: [0], onComplete: cb })

    expect(anim.onComplete).toBe(cb)
  })

  it('copies frameEvents from clip', () => {
    const ev = { 0: vi.fn(), 2: vi.fn() }
    const anim = makeAnimState()
    resolveClip(anim, { frames: [0, 1, 2], frameEvents: ev })

    expect(anim.frameEvents).toBe(ev)
  })

  it('clears onComplete when clip has none', () => {
    const anim = makeAnimState({ onComplete: vi.fn() })
    resolveClip(anim, { frames: [0] })

    expect(anim.onComplete).toBeUndefined()
  })
})

describe('clip resolution logic (simulated)', () => {
  /** Simulate the clip resolution logic from renderSystem.update. */
  function simulateClipResolution(anim: AnimationStateComponent): void {
    if (anim.clips && anim.currentClip && anim._resolvedClip !== anim.currentClip) {
      const clip = anim.clips[anim.currentClip]
      if (clip) {
        resolveClip(anim, clip)
        anim._resolvedClip = anim.currentClip
      }
    }
  }

  it('resolves a valid clip when currentClip is set', () => {
    const anim = makeAnimState({
      clips: {
        idle: { frames: [0], fps: 1 },
        walk: { frames: [1, 2, 3], fps: 10, loop: true },
      },
      currentClip: 'walk',
    })

    simulateClipResolution(anim)

    expect(anim.frames).toEqual([1, 2, 3])
    expect(anim.fps).toBe(10)
    expect(anim.loop).toBe(true)
    expect(anim._resolvedClip).toBe('walk')
  })

  it('changing currentClip resets animation state', () => {
    const anim = makeAnimState({
      clips: {
        idle: { frames: [0], fps: 1 },
        walk: { frames: [1, 2, 3], fps: 10 },
      },
      currentClip: 'idle',
    })

    // Resolve idle first
    simulateClipResolution(anim)
    expect(anim._resolvedClip).toBe('idle')

    // Advance animation artificially
    anim.currentIndex = 0
    anim._completed = true
    anim.timer = 0.3

    // Switch to walk
    anim.currentClip = 'walk'
    simulateClipResolution(anim)

    expect(anim.frames).toEqual([1, 2, 3])
    expect(anim.currentIndex).toBe(0)
    expect(anim.timer).toBe(0)
    expect(anim._completed).toBe(false)
    expect(anim._resolvedClip).toBe('walk')
  })

  it('does not re-resolve when currentClip has not changed', () => {
    const anim = makeAnimState({
      clips: { idle: { frames: [0, 1], fps: 5 } },
      currentClip: 'idle',
    })

    simulateClipResolution(anim)
    // Advance index manually
    anim.currentIndex = 1
    anim.timer = 0.1

    // Re-run resolution — should NOT reset since _resolvedClip matches
    simulateClipResolution(anim)
    expect(anim.currentIndex).toBe(1)
    expect(anim.timer).toBe(0.1)
  })

  it('does nothing when currentClip is an invalid name', () => {
    const anim = makeAnimState({
      frames: [10, 11],
      fps: 8,
      clips: { idle: { frames: [0] } },
      currentClip: 'nonexistent',
    })

    simulateClipResolution(anim)

    // Original frames should remain untouched
    expect(anim.frames).toEqual([10, 11])
    expect(anim.fps).toBe(8)
    expect(anim._resolvedClip).toBeUndefined()
  })

  it('simple mode (no clips) does not resolve', () => {
    const anim = makeAnimState({ frames: [0, 1, 2], fps: 10 })

    simulateClipResolution(anim)

    expect(anim.frames).toEqual([0, 1, 2])
    expect(anim.fps).toBe(10)
    expect(anim._resolvedClip).toBeUndefined()
  })
})

describe('non-looping clip auto-transition (simulated)', () => {
  /**
   * Simulate animation advancement + auto-transition from renderSystem.update.
   * Advances the animation by `dt` seconds.
   */
  function advanceAnimation(anim: AnimationStateComponent, dt: number): void {
    // Clip resolution
    if (anim.clips && anim.currentClip && anim._resolvedClip !== anim.currentClip) {
      const clip = anim.clips[anim.currentClip]
      if (clip) {
        resolveClip(anim, clip)
        anim._resolvedClip = anim.currentClip
      }
    }

    if (!anim.playing || anim.frames.length === 0) return

    anim.timer += dt
    const frameDuration = 1 / anim.fps
    while (anim.timer >= frameDuration) {
      anim.timer -= frameDuration
      anim.currentIndex++
      if (anim.currentIndex >= anim.frames.length) {
        if (anim.loop) {
          anim.currentIndex = 0
        } else {
          anim.currentIndex = anim.frames.length - 1
          anim.playing = false
          if (anim.onComplete && !anim._completed) {
            anim._completed = true
            anim.onComplete()
          }
          // Auto-transition to next clip
          if (anim.clips && anim.currentClip) {
            const currentClipDef = anim.clips[anim.currentClip]
            if (currentClipDef?.next && anim.clips[currentClipDef.next]) {
              anim.currentClip = currentClipDef.next
            }
          }
        }
      }
    }
  }

  it('transitions to next clip when non-looping clip completes', () => {
    const onComplete = vi.fn()
    const anim = makeAnimState({
      clips: {
        attack: { frames: [0, 1], fps: 10, loop: false, next: 'idle', onComplete },
        idle: { frames: [5, 6, 7], fps: 5, loop: true },
      },
      currentClip: 'attack',
    })

    // Resolve the initial clip
    advanceAnimation(anim, 0)
    expect(anim._resolvedClip).toBe('attack')

    // Advance enough to finish the 2-frame clip at 10fps (0.2s total)
    advanceAnimation(anim, 0.25)

    expect(onComplete).toHaveBeenCalledOnce()
    expect(anim.currentClip).toBe('idle')

    // Next tick should resolve the idle clip
    advanceAnimation(anim, 0)
    expect(anim._resolvedClip).toBe('idle')
    expect(anim.frames).toEqual([5, 6, 7])
    expect(anim.playing).toBe(true)
  })

  it('does not transition when next points to invalid clip', () => {
    const anim = makeAnimState({
      clips: {
        attack: { frames: [0, 1], fps: 10, loop: false, next: 'missing' },
      },
      currentClip: 'attack',
    })

    advanceAnimation(anim, 0)
    advanceAnimation(anim, 0.25)

    // currentClip should remain attack since 'missing' does not exist
    expect(anim.currentClip).toBe('attack')
  })

  it('looping clip does not auto-transition', () => {
    const anim = makeAnimState({
      clips: {
        walk: { frames: [0, 1], fps: 10, loop: true, next: 'idle' },
        idle: { frames: [5], fps: 1 },
      },
      currentClip: 'walk',
    })

    advanceAnimation(anim, 0)
    // Advance well past one loop
    advanceAnimation(anim, 0.5)

    expect(anim.currentClip).toBe('walk')
    expect(anim._resolvedClip).toBe('walk')
  })
})
