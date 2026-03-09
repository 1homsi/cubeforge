import { useState, useCallback, useRef } from 'react'

export interface SceneDefinition {
  /** Unique scene name */
  name: string
  /** Whether this scene pauses scenes below it in the stack. Default: false */
  pausesBelow?: boolean
  /** Whether this scene renders on top of (overlays) scenes below. Default: false */
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
}

/**
 * Manages a stack of game scenes/screens.
 *
 * @example
 * const scenes = useSceneManager('gameplay')
 * // Push pause menu on top: scenes.push('pause')
 * // Pop back to gameplay: scenes.pop()
 * // Switch to game over: scenes.replace('gameOver')
 * // Reset to main menu: scenes.reset('mainMenu')
 *
 * // In render:
 * {scenes.current === 'gameplay' && <GameplayScene />}
 * {scenes.current === 'pause' && <PauseMenu onResume={() => scenes.pop()} />}
 */
export function useSceneManager(initialScene: string): SceneManagerControls {
  const [stack, setStack] = useState<string[]>([initialScene])
  const stackRef = useRef(stack)
  stackRef.current = stack

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

  return {
    current: stack[stack.length - 1],
    stack,
    push,
    pop,
    replace,
    reset,
    has,
  }
}
