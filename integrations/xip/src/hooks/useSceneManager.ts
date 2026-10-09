import { useState, useCallback, useRef } from 'react'

export interface SceneDefinition {
  /** Unique scene name */
  name: string
  /**
   * Whether this scene pauses scenes below it in the stack. Default: false.
   * Query with {@link SceneManagerControls.isPaused} — typically to stop
   * gameplay scripts/updates while a pause menu is up.
   */
  pausesBelow?: boolean
  /**
   * Advisory only (default: false): marks the scene as an overlay for
   * renderers — e.g. keep rendering the scene below underneath it.
   */
  overlay?: boolean
}

export interface SceneManagerControls {
  /** Currently active scene (top of stack) */
  current: string
  /** Full scene stack (bottom to top) */
  stack: string[]
  /** Push a scene onto the stack */
  push(scene: string): void
  /** Pop the top scene. Returns the popped scene name or undefined if only one scene. */
  pop(): string | undefined
  /** Replace the current scene */
  replace(scene: string): void
  /** Replace the entire stack with a single scene */
  reset(scene: string): void
  /** Check if a specific scene is in the stack */
  has(scene: string): boolean
  /**
   * True when this scene should stop updating. A scene is paused when any
   * scene ABOVE it in the stack declares `pausesBelow: true`. The active
   * (top) scene is never paused. Unregistered scenes default to their name
   * being checked against definitions given at hook creation; scenes without
   * definitions are never paused by absence alone.
   */
  isPaused(scene?: string): boolean
}

/**
 * Manages a stack of game scenes/screens.
 *
 * Scenes are plain strings so they map directly onto conditional React
 * renders; optional per-scene definitions add pause semantics.
 *
 * @example
 * const scenes = useSceneManager('gameplay', {
 *   gameplay: { name: 'gameplay' },
 *   pause: { name: 'pause', pausesBelow: true, overlay: true },
 * })
 *
 * // Push pause menu on top: scenes.push('pause')
 * // Gameplay keeps rendering but should stop updating:
 * const paused = scenes.isPaused('gameplay')
 *
 * // In render:
 * {scenes.current === 'gameplay' && <GameplayScene paused={paused} />}
 * {scenes.current === 'pause' && <PauseMenu onResume={() => scenes.pop()} />}
 */
export function useSceneManager(
  initialScene: string,
  definitions?: Record<string, SceneDefinition>,
): SceneManagerControls {
  const [stack, setStack] = useState<string[]>([initialScene])
  const stackRef = useRef(stack)
  stackRef.current = stack

  const defsRef = useRef(definitions)
  defsRef.current = definitions

  const push = useCallback((scene: string) => {
    setStack((prev) => [...prev, scene])
  }, [])

  const pop = useCallback(() => {
    const prev = stackRef.current
    if (prev.length <= 1) return undefined
    const popped = prev[prev.length - 1]
    setStack(prev.slice(0, -1))
    return popped
  }, [])

  const replace = useCallback((scene: string) => {
    setStack((prev) => [...prev.slice(0, -1), scene])
  }, [])

  const reset = useCallback((scene: string) => {
    setStack([scene])
  }, [])

  const has = useCallback(
    (scene: string) => {
      return stack.includes(scene)
    },
    [stack],
  )

  const isPaused = useCallback((scene?: string) => {
    const s = stackRef.current
    const target = scene ?? s[s.length - 1]
    const idx = s.indexOf(target)
    if (idx === -1 || idx === s.length - 1) return false // unknown or top → not paused
    const defs = defsRef.current
    if (!defs) return false
    for (let above = idx + 1; above < s.length; above++) {
      if (defs[s[above]]?.pausesBelow) return true
    }
    return false
  }, [])

  return {
    current: stack[stack.length - 1],
    stack,
    push,
    pop,
    replace,
    reset,
    has,
    isPaused,
  }
}
