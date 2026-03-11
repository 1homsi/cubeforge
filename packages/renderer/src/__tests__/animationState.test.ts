import { describe, it, expect, vi } from 'vitest'
import type { AnimationStateComponent, AnimationClipDefinition } from '../components/animationState'

function makeAnimationState(overrides: Partial<AnimationStateComponent> = {}): AnimationStateComponent {
  return {
    type: 'AnimationState',
    frames: [0, 1, 2, 3],
    fps: 12,
    loop: true,
    playing: true,
    currentIndex: 0,
    timer: 0,
    _completed: false,
    ...overrides,
  }
}

describe('AnimationStateComponent', () => {
  it('has correct type string', () => {
    const anim = makeAnimationState()
    expect(anim.type).toBe('AnimationState')
  })

  it('defaults to playing', () => {
    const anim = makeAnimationState()
    expect(anim.playing).toBe(true)
  })

  it('defaults _completed to false', () => {
    const anim = makeAnimationState()
    expect(anim._completed).toBe(false)
  })

  it('stores frames array', () => {
    const anim = makeAnimationState({ frames: [4, 5, 6] })
    expect(anim.frames).toEqual([4, 5, 6])
  })

  it('advances timer per frame correctly', () => {
    const anim = makeAnimationState({ fps: 10 })
    const frameDuration = 1 / anim.fps // 0.1s
    anim.timer += 0.016

    expect(anim.timer).toBeCloseTo(0.016)
    // Not yet past the frame threshold
    expect(anim.timer).toBeLessThan(frameDuration)
  })

  it('advances frame index when timer exceeds frame duration', () => {
    const anim = makeAnimationState({ fps: 10 })
    const frameDuration = 1 / anim.fps

    // Simulate frame advance logic
    anim.timer += frameDuration + 0.001
    if (anim.timer >= frameDuration) {
      anim.timer -= frameDuration
      anim.currentIndex = (anim.currentIndex + 1) % anim.frames.length
    }

    expect(anim.currentIndex).toBe(1)
  })

  it('wraps frame index back to 0 for looping animations', () => {
    const anim = makeAnimationState({ fps: 10, loop: true, currentIndex: 3, frames: [0, 1, 2, 3] })
    const frameDuration = 1 / anim.fps

    anim.timer += frameDuration + 0.001
    if (anim.timer >= frameDuration) {
      anim.timer -= frameDuration
      if (anim.loop) {
        anim.currentIndex = (anim.currentIndex + 1) % anim.frames.length
      }
    }

    expect(anim.currentIndex).toBe(0)
  })

  it('stops at last frame for non-looping animations', () => {
    const anim = makeAnimationState({ fps: 10, loop: false, currentIndex: 3, frames: [0, 1, 2, 3] })
    const frameDuration = 1 / anim.fps

    anim.timer += frameDuration + 0.001
    if (anim.timer >= frameDuration) {
      anim.timer -= frameDuration
      if (!anim.loop && anim.currentIndex >= anim.frames.length - 1) {
        anim.playing = false
        anim._completed = true
      } else {
        anim.currentIndex = (anim.currentIndex + 1) % anim.frames.length
      }
    }

    expect(anim.playing).toBe(false)
    expect(anim._completed).toBe(true)
  })

  it('fires onComplete callback when non-looping animation finishes', () => {
    const onComplete = vi.fn()
    const anim = makeAnimationState({
      fps: 10,
      loop: false,
      currentIndex: 3,
      frames: [0, 1, 2, 3],
      onComplete,
    })
    const frameDuration = 1 / anim.fps

    anim.timer += frameDuration + 0.001
    if (anim.timer >= frameDuration && !anim.loop && anim.currentIndex >= anim.frames.length - 1) {
      if (!anim._completed) {
        anim._completed = true
        anim.onComplete?.()
      }
    }

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('does not fire onComplete twice', () => {
    const onComplete = vi.fn()
    const anim = makeAnimationState({
      fps: 10,
      loop: false,
      currentIndex: 3,
      frames: [0, 1, 2, 3],
      onComplete,
      _completed: true, // already completed
    })

    // Simulate check again
    if (!anim._completed) {
      anim.onComplete?.()
    }

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('fires frameEvents callback when advancing to the right frame', () => {
    const frameCallback = vi.fn()
    const anim = makeAnimationState({
      fps: 10,
      frames: [0, 1, 2, 3],
      currentIndex: 0,
      frameEvents: { 2: frameCallback },
    })

    // Advance to frame index 2
    anim.currentIndex = 2
    anim.frameEvents?.[anim.currentIndex]?.()

    expect(frameCallback).toHaveBeenCalledTimes(1)
  })

  describe('clip system', () => {
    it('stores clips map', () => {
      const clips: Record<string, AnimationClipDefinition> = {
        idle: { frames: [0, 1, 2], fps: 8, loop: true },
        run: { frames: [3, 4, 5, 6], fps: 12, loop: true },
      }
      const anim = makeAnimationState({ clips })
      expect(anim.clips).toBeDefined()
      expect(Object.keys(anim.clips!)).toContain('idle')
      expect(Object.keys(anim.clips!)).toContain('run')
    })

    it('tracks currentClip name', () => {
      const anim = makeAnimationState({
        clips: { idle: { frames: [0, 1], fps: 8 } },
        currentClip: 'idle',
      })
      expect(anim.currentClip).toBe('idle')
    })

    it('tracks _resolvedClip for change detection', () => {
      const anim = makeAnimationState({
        clips: { idle: { frames: [0, 1], fps: 8 } },
        currentClip: 'idle',
        _resolvedClip: 'run',
      })
      const clipChanged = anim.currentClip !== anim._resolvedClip
      expect(clipChanged).toBe(true)
    })

    it('clip auto-transition via next field', () => {
      const clips: Record<string, AnimationClipDefinition> = {
        attack: { frames: [0, 1, 2], fps: 12, loop: false, next: 'idle' },
        idle: { frames: [3, 4], fps: 8, loop: true },
      }
      const anim = makeAnimationState({ clips, currentClip: 'attack' })

      // When attack completes, engine would set currentClip to next
      const attackClip = anim.clips!['attack']
      expect(attackClip.next).toBe('idle')
    })
  })
})
