import { describe, it, expect, vi } from 'vitest'
import { evaluateConditions } from '../renderSystem'
import type { AnimatorCondition } from '../components/animator'

describe('evaluateConditions', () => {
  it('returns true for empty conditions array', () => {
    expect(evaluateConditions([], {})).toBe(true)
  })

  describe('== operator', () => {
    it('passes when param equals value (number)', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '==', value: 5 }]
      expect(evaluateConditions(conditions, { speed: 5 })).toBe(true)
    })

    it('fails when param does not equal value', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '==', value: 5 }]
      expect(evaluateConditions(conditions, { speed: 3 })).toBe(false)
    })

    it('works with boolean values', () => {
      const conditions: AnimatorCondition[] = [{ param: 'grounded', op: '==', value: true }]
      expect(evaluateConditions(conditions, { grounded: true })).toBe(true)
      expect(evaluateConditions(conditions, { grounded: false })).toBe(false)
    })

    it('works with string values', () => {
      const conditions: AnimatorCondition[] = [{ param: 'state', op: '==', value: 'idle' }]
      expect(evaluateConditions(conditions, { state: 'idle' })).toBe(true)
      expect(evaluateConditions(conditions, { state: 'walk' })).toBe(false)
    })
  })

  describe('!= operator', () => {
    it('passes when param differs from value', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '!=', value: 0 }]
      expect(evaluateConditions(conditions, { speed: 5 })).toBe(true)
    })

    it('fails when param equals value', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '!=', value: 0 }]
      expect(evaluateConditions(conditions, { speed: 0 })).toBe(false)
    })
  })

  describe('> operator', () => {
    it('passes when param is greater', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '>', value: 3 }]
      expect(evaluateConditions(conditions, { speed: 5 })).toBe(true)
    })

    it('fails when param is equal', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '>', value: 3 }]
      expect(evaluateConditions(conditions, { speed: 3 })).toBe(false)
    })

    it('fails when param is less', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '>', value: 3 }]
      expect(evaluateConditions(conditions, { speed: 1 })).toBe(false)
    })
  })

  describe('>= operator', () => {
    it('passes when param is equal', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '>=', value: 3 }]
      expect(evaluateConditions(conditions, { speed: 3 })).toBe(true)
    })

    it('passes when param is greater', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '>=', value: 3 }]
      expect(evaluateConditions(conditions, { speed: 10 })).toBe(true)
    })

    it('fails when param is less', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '>=', value: 3 }]
      expect(evaluateConditions(conditions, { speed: 2 })).toBe(false)
    })
  })

  describe('< operator', () => {
    it('passes when param is less', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '<', value: 3 }]
      expect(evaluateConditions(conditions, { speed: 1 })).toBe(true)
    })

    it('fails when param is equal', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '<', value: 3 }]
      expect(evaluateConditions(conditions, { speed: 3 })).toBe(false)
    })
  })

  describe('<= operator', () => {
    it('passes when param is equal', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '<=', value: 3 }]
      expect(evaluateConditions(conditions, { speed: 3 })).toBe(true)
    })

    it('passes when param is less', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '<=', value: 3 }]
      expect(evaluateConditions(conditions, { speed: 1 })).toBe(true)
    })

    it('fails when param is greater', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '<=', value: 3 }]
      expect(evaluateConditions(conditions, { speed: 5 })).toBe(false)
    })
  })

  describe('missing params', () => {
    it('returns false when param is missing', () => {
      const conditions: AnimatorCondition[] = [{ param: 'speed', op: '==', value: 5 }]
      expect(evaluateConditions(conditions, {})).toBe(false)
    })

    it('returns false when one of multiple params is missing', () => {
      const conditions: AnimatorCondition[] = [
        { param: 'speed', op: '>', value: 0 },
        { param: 'grounded', op: '==', value: true },
      ]
      expect(evaluateConditions(conditions, { speed: 5 })).toBe(false)
    })
  })

  describe('multiple conditions (AND semantics)', () => {
    it('passes when all conditions are met', () => {
      const conditions: AnimatorCondition[] = [
        { param: 'speed', op: '>', value: 0 },
        { param: 'grounded', op: '==', value: true },
      ]
      expect(evaluateConditions(conditions, { speed: 5, grounded: true })).toBe(true)
    })

    it('fails when any condition is not met', () => {
      const conditions: AnimatorCondition[] = [
        { param: 'speed', op: '>', value: 0 },
        { param: 'grounded', op: '==', value: true },
      ]
      expect(evaluateConditions(conditions, { speed: 5, grounded: false })).toBe(false)
    })

    it('fails when the first condition fails (short-circuit)', () => {
      const conditions: AnimatorCondition[] = [
        { param: 'speed', op: '==', value: 0 },
        { param: 'grounded', op: '==', value: true },
      ]
      expect(evaluateConditions(conditions, { speed: 5, grounded: true })).toBe(false)
    })
  })
})

describe('Animator state transitions (simulated)', () => {
  /**
   * Simulate the animator evaluation pass from renderSystem.update.
   * Takes an animator component and animation state component, evaluates
   * transitions, and updates state accordingly.
   */
  function simulateAnimatorEval(
    animator: {
      playing: boolean
      currentState: string
      initialState: string
      states: Record<
        string,
        {
          clip: string
          transitions?: Array<{
            to: string
            when: AnimatorCondition[]
            priority?: number
            exitTime?: number
          }>
          onEnter?: () => void
          onExit?: () => void
        }
      >
      params: Record<string, unknown>
      _entered: boolean
    },
    anim: {
      currentClip?: string
      currentIndex: number
      frames: number[]
    },
  ): void {
    if (!animator.playing) return

    if (!animator.states[animator.currentState]) {
      animator.currentState = animator.initialState
      animator._entered = false
    }

    const stateDef = animator.states[animator.currentState]
    if (!stateDef) return

    // Enter state
    if (!animator._entered) {
      anim.currentClip = stateDef.clip
      animator._entered = true
      stateDef.onEnter?.()
    }

    // Evaluate transitions
    if (stateDef.transitions && stateDef.transitions.length > 0) {
      const sorted = [...stateDef.transitions].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      for (const trans of sorted) {
        if (trans.exitTime != null && anim.frames.length > 0) {
          const progress = anim.currentIndex / anim.frames.length
          if (progress < trans.exitTime) continue
        }
        if (evaluateConditions(trans.when, animator.params)) {
          stateDef.onExit?.()
          animator.currentState = trans.to
          animator._entered = false
          break
        }
      }
    }
  }

  function makeAnimator(overrides?: Record<string, unknown>) {
    return {
      playing: true,
      currentState: 'idle',
      initialState: 'idle',
      states: {} as Record<
        string,
        {
          clip: string
          transitions?: Array<{ to: string; when: AnimatorCondition[]; priority?: number; exitTime?: number }>
          onEnter?: () => void
          onExit?: () => void
        }
      >,
      params: {} as Record<string, unknown>,
      _entered: false,
      ...overrides,
    }
  }

  function makeAnim(overrides?: Partial<{ currentClip: string; currentIndex: number; frames: number[] }>) {
    return {
      currentClip: undefined as string | undefined,
      currentIndex: 0,
      frames: [] as number[],
      ...overrides,
    }
  }

  it('fires onEnter and sets clip when entering initial state', () => {
    const onEnter = vi.fn()
    const animator = makeAnimator({
      states: {
        idle: { clip: 'idle_clip', onEnter },
      },
    })
    const anim = makeAnim()

    simulateAnimatorEval(animator, anim)

    expect(onEnter).toHaveBeenCalledOnce()
    expect(anim.currentClip).toBe('idle_clip')
    expect(animator._entered).toBe(true)
  })

  it('does not re-enter if already entered', () => {
    const onEnter = vi.fn()
    const animator = makeAnimator({
      states: { idle: { clip: 'idle_clip', onEnter } },
      _entered: true,
    })
    const anim = makeAnim()

    simulateAnimatorEval(animator, anim)

    expect(onEnter).not.toHaveBeenCalled()
  })

  it('transitions when conditions are met', () => {
    const onExit = vi.fn()
    const animator = makeAnimator({
      currentState: 'idle',
      _entered: true,
      states: {
        idle: {
          clip: 'idle_clip',
          onExit,
          transitions: [{ to: 'walk', when: [{ param: 'speed', op: '>' as const, value: 0 }] }],
        },
        walk: { clip: 'walk_clip' },
      },
      params: { speed: 5 },
    })
    const anim = makeAnim()

    simulateAnimatorEval(animator, anim)

    expect(onExit).toHaveBeenCalledOnce()
    expect(animator.currentState).toBe('walk')
    expect(animator._entered).toBe(false)
  })

  it('does not transition when conditions are not met', () => {
    const animator = makeAnimator({
      currentState: 'idle',
      _entered: true,
      states: {
        idle: {
          clip: 'idle_clip',
          transitions: [{ to: 'walk', when: [{ param: 'speed', op: '>' as const, value: 0 }] }],
        },
        walk: { clip: 'walk_clip' },
      },
      params: { speed: 0 },
    })
    const anim = makeAnim()

    simulateAnimatorEval(animator, anim)

    expect(animator.currentState).toBe('idle')
  })

  it('blocks transition until exitTime is reached', () => {
    const animator = makeAnimator({
      currentState: 'attack',
      _entered: true,
      states: {
        attack: {
          clip: 'attack_clip',
          transitions: [{ to: 'idle', when: [{ param: 'done', op: '==' as const, value: true }], exitTime: 0.5 }],
        },
        idle: { clip: 'idle_clip' },
      },
      params: { done: true },
    })

    // Animation at 1/10 progress => below 0.5 exitTime
    const anim = makeAnim({ frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], currentIndex: 1 })

    simulateAnimatorEval(animator, anim)
    expect(animator.currentState).toBe('attack') // blocked

    // Advance to 6/10 = 0.6 progress => above 0.5
    anim.currentIndex = 6
    simulateAnimatorEval(animator, anim)
    expect(animator.currentState).toBe('idle') // allowed
  })

  it('evaluates higher priority transitions first', () => {
    const animator = makeAnimator({
      currentState: 'idle',
      _entered: true,
      states: {
        idle: {
          clip: 'idle_clip',
          transitions: [
            { to: 'walk', when: [{ param: 'moving', op: '==' as const, value: true }], priority: 0 },
            { to: 'hurt', when: [{ param: 'hit', op: '==' as const, value: true }], priority: 10 },
          ],
        },
        walk: { clip: 'walk_clip' },
        hurt: { clip: 'hurt_clip' },
      },
      params: { moving: true, hit: true },
    })
    const anim = makeAnim()

    simulateAnimatorEval(animator, anim)

    // hurt has higher priority (10 > 0) so it should win
    expect(animator.currentState).toBe('hurt')
  })

  it('fires onExit on old state and onEnter on new state across two ticks', () => {
    const idleExit = vi.fn()
    const walkEnter = vi.fn()
    const animator = makeAnimator({
      currentState: 'idle',
      _entered: true,
      states: {
        idle: {
          clip: 'idle_clip',
          onExit: idleExit,
          transitions: [{ to: 'walk', when: [{ param: 'speed', op: '>' as const, value: 0 }] }],
        },
        walk: { clip: 'walk_clip', onEnter: walkEnter },
      },
      params: { speed: 5 },
    })
    const anim = makeAnim()

    // First tick: transition fires, onExit called
    simulateAnimatorEval(animator, anim)
    expect(idleExit).toHaveBeenCalledOnce()
    expect(walkEnter).not.toHaveBeenCalled() // not entered yet

    // Second tick: walk state is entered
    simulateAnimatorEval(animator, anim)
    expect(walkEnter).toHaveBeenCalledOnce()
    expect(anim.currentClip).toBe('walk_clip')
  })

  it('skips evaluation when animator.playing is false', () => {
    const onEnter = vi.fn()
    const animator = makeAnimator({
      playing: false,
      states: { idle: { clip: 'idle_clip', onEnter } },
    })
    const anim = makeAnim()

    simulateAnimatorEval(animator, anim)

    expect(onEnter).not.toHaveBeenCalled()
    expect(anim.currentClip).toBeUndefined()
  })

  it('falls back to initialState when currentState is invalid', () => {
    const onEnter = vi.fn()
    const animator = makeAnimator({
      currentState: 'nonexistent',
      initialState: 'idle',
      states: { idle: { clip: 'idle_clip', onEnter } },
    })
    const anim = makeAnim()

    simulateAnimatorEval(animator, anim)

    expect(animator.currentState).toBe('idle')
    expect(onEnter).toHaveBeenCalledOnce()
  })
})
