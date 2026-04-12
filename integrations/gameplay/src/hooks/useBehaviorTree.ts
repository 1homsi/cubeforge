import { useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Return value from every behavior tree node tick. */
export type BTStatus = 'success' | 'failure' | 'running'

/** A single node in a behavior tree. */
export interface BTNode {
  tick(dt: number): BTStatus
  reset(): void
}

// ── Leaf nodes ────────────────────────────────────────────────────────────────

/**
 * Leaf action node. The callback runs every tick while this node is active.
 * Return `'running'` to keep ticking, `'success'`/`'failure'` to complete,
 * `true`/`false` as shorthand for `'success'`/`'failure'`,
 * or nothing (void / undefined) to return `'success'` immediately.
 */
export function btAction(fn: (dt: number) => BTStatus | boolean | void): BTNode {
  return {
    tick(dt) {
      const result = fn(dt)
      if (result === undefined || result === null) return 'success'
      if (typeof result === 'boolean') return result ? 'success' : 'failure'
      return result
    },
    reset() {},
  }
}

/**
 * Leaf condition node. Returns `'success'` if `fn()` is truthy, `'failure'` otherwise.
 */
export function btCondition(fn: () => boolean): BTNode {
  return {
    tick() {
      return fn() ? 'success' : 'failure'
    },
    reset() {},
  }
}

/**
 * Leaf wait node. Returns `'running'` for `duration` seconds, then `'success'`.
 */
export function btWait(duration: number): BTNode {
  let elapsed = 0
  return {
    tick(dt) {
      elapsed += dt
      if (elapsed >= duration) {
        elapsed = 0
        return 'success'
      }
      return 'running'
    },
    reset() {
      elapsed = 0
    },
  }
}

// ── Composite nodes ───────────────────────────────────────────────────────────

/**
 * Sequence node (AND). Ticks children left to right:
 * - Child returns `running` → propagate `running` (resumes from this child next tick)
 * - Child returns `failure` → reset and return `failure`
 * - All children succeed → return `success`
 */
export function btSequence(...children: BTNode[]): BTNode {
  let idx = 0
  return {
    tick(dt) {
      while (idx < children.length) {
        const s = children[idx].tick(dt)
        if (s === 'running') return 'running'
        if (s === 'failure') {
          idx = 0
          return 'failure'
        }
        idx++
      }
      idx = 0
      return 'success'
    },
    reset() {
      idx = 0
      children.forEach((c) => c.reset())
    },
  }
}

/**
 * Selector node (OR). Ticks children left to right:
 * - Child returns `running` → propagate `running`
 * - Child returns `success` → reset and return `success`
 * - All children fail → return `failure`
 */
export function btSelector(...children: BTNode[]): BTNode {
  let idx = 0
  return {
    tick(dt) {
      while (idx < children.length) {
        const s = children[idx].tick(dt)
        if (s === 'running') return 'running'
        if (s === 'success') {
          idx = 0
          return 'success'
        }
        idx++
      }
      idx = 0
      return 'failure'
    },
    reset() {
      idx = 0
      children.forEach((c) => c.reset())
    },
  }
}

/**
 * Parallel node. Ticks ALL children every frame simultaneously.
 *
 * @param successPolicy `'any'` = succeed when any child succeeds, `'all'` = require all to succeed
 * @param failPolicy    `'any'` = fail when any child fails,    `'all'` = require all to fail
 */
export function btParallel(successPolicy: 'all' | 'any', failPolicy: 'all' | 'any', ...children: BTNode[]): BTNode {
  return {
    tick(dt) {
      let successCount = 0
      let failCount = 0
      for (const child of children) {
        const s = child.tick(dt)
        if (s === 'success') successCount++
        else if (s === 'failure') failCount++
      }
      if (successPolicy === 'any' && successCount > 0) {
        children.forEach((c) => c.reset())
        return 'success'
      }
      if (failPolicy === 'any' && failCount > 0) {
        children.forEach((c) => c.reset())
        return 'failure'
      }
      if (successPolicy === 'all' && successCount === children.length) return 'success'
      if (failPolicy === 'all' && failCount === children.length) return 'failure'
      return 'running'
    },
    reset() {
      children.forEach((c) => c.reset())
    },
  }
}

// ── Decorator nodes ───────────────────────────────────────────────────────────

/**
 * Invert decorator. Swaps `success` ↔ `failure`; passes `running` through.
 */
export function btInvert(child: BTNode): BTNode {
  return {
    tick(dt) {
      const s = child.tick(dt)
      if (s === 'success') return 'failure'
      if (s === 'failure') return 'success'
      return 'running'
    },
    reset() {
      child.reset()
    },
  }
}

/**
 * Repeat decorator. Ticks the child `count` times before returning `success`.
 * Use `'forever'` to loop indefinitely (returns `running` until the child fails).
 * Returns `failure` immediately if the child fails.
 */
export function btRepeat(count: number | 'forever', child: BTNode): BTNode {
  let done = 0
  return {
    tick(dt) {
      while (count === 'forever' || done < (count as number)) {
        const s = child.tick(dt)
        if (s === 'running') return 'running'
        if (s === 'failure') {
          done = 0
          child.reset()
          return 'failure'
        }
        done++
        child.reset()
      }
      done = 0
      return 'success'
    },
    reset() {
      done = 0
      child.reset()
    },
  }
}

/**
 * Retry decorator. Re-runs the child up to `maxAttempts` times on failure.
 * Stops as soon as the child succeeds.
 */
export function btRetryUntilSuccess(maxAttempts: number, child: BTNode): BTNode {
  let attempts = 0
  return {
    tick(dt) {
      while (attempts < maxAttempts) {
        const s = child.tick(dt)
        if (s === 'running') return 'running'
        if (s === 'success') {
          attempts = 0
          return 'success'
        }
        attempts++
        child.reset()
      }
      attempts = 0
      return 'failure'
    },
    reset() {
      attempts = 0
      child.reset()
    },
  }
}

/**
 * Cooldown decorator. Runs the child, then blocks it for `duration` seconds
 * after it completes. Returns `'failure'` while on cooldown.
 */
export function btCooldown(duration: number, child: BTNode): BTNode {
  let remaining = 0
  return {
    tick(dt) {
      if (remaining > 0) {
        remaining = Math.max(0, remaining - dt)
        return 'failure'
      }
      const s = child.tick(dt)
      if (s !== 'running') {
        remaining = duration
        child.reset()
      }
      return s
    },
    reset() {
      remaining = 0
      child.reset()
    },
  }
}

/**
 * Succeed decorator. Returns `'success'` regardless of the child's result
 * (passes `'running'` through unchanged).
 */
export function btSucceed(child: BTNode): BTNode {
  return {
    tick(dt) {
      const s = child.tick(dt)
      return s === 'running' ? 'running' : 'success'
    },
    reset() {
      child.reset()
    },
  }
}

/**
 * Fail decorator. Returns `'failure'` regardless of the child's result
 * (passes `'running'` through unchanged).
 */
export function btFail(child: BTNode): BTNode {
  return {
    tick(dt) {
      const s = child.tick(dt)
      return s === 'running' ? 'running' : 'failure'
    },
    reset() {
      child.reset()
    },
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface BehaviorTreeControls {
  /**
   * Advance the tree by `dt` seconds. Call this from a game loop
   * (e.g. inside `useScript`, `createScript`, or `useTick`).
   */
  tick(dt: number): BTStatus
  /** Reset the entire tree to its initial state. */
  reset(): void
  /** The result of the last call to `tick()`. */
  readonly lastStatus: BTStatus
}

/**
 * Manages a behavior tree. The tree is built once from `rootFactory` and
 * persists across renders. Call `controls.tick(dt)` from a game loop.
 *
 * @example
 * ```tsx
 * function Enemy({ playerId }: { playerId: string }) {
 *   const { position } = useTransform()
 *   const bt = useBehaviorTree(() =>
 *     btSelector(
 *       btSequence(
 *         btCondition(() => distanceTo(position, playerPos) < 200),
 *         btAction((dt) => { chasePlayer(dt); return 'running' }),
 *       ),
 *       btSequence(
 *         btAction((dt) => { patrol(dt); return 'running' }),
 *       ),
 *     )
 *   )
 *
 *   useScript((dt) => { bt.tick(dt) })
 *   return <BoxCollider />
 * }
 * ```
 */
export function useBehaviorTree(rootFactory: () => BTNode): BehaviorTreeControls {
  const rootRef = useRef<BTNode | null>(null)
  if (!rootRef.current) rootRef.current = rootFactory()
  const statusRef = useRef<BTStatus>('failure')

  const tick = useCallback((dt: number): BTStatus => {
    if (!rootRef.current) return 'failure'
    const s = rootRef.current.tick(dt)
    statusRef.current = s
    return s
  }, [])

  const reset = useCallback(() => {
    rootRef.current?.reset()
  }, [])

  return {
    tick,
    reset,
    get lastStatus() {
      return statusRef.current
    },
  }
}
