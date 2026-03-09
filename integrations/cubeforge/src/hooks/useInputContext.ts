import { useEffect, useMemo } from 'react'
import { globalInputContext } from '@cubeforge/input'
import type { InputContextName } from '@cubeforge/input'

export interface InputContextControls {
  push(ctx: InputContextName): void
  pop(ctx: InputContextName): void
  readonly active: InputContextName
}

/**
 * Access and manipulate the global input context stack.
 *
 * If you pass a `ctx` argument, that context is automatically pushed on mount
 * and popped on unmount — ideal for pause menus, cutscenes, etc.
 *
 * @example
 * ```tsx
 * function PauseMenu() {
 *   useInputContext('pause') // auto-push/pop
 *   return <div>Paused</div>
 * }
 * ```
 */
export function useInputContext(ctx?: InputContextName): InputContextControls {
  useEffect(() => {
    if (!ctx) return
    globalInputContext.push(ctx)
    return () => globalInputContext.pop(ctx)
  }, [ctx])

  return useMemo(
    () => ({
      push: (c: InputContextName) => globalInputContext.push(c),
      pop: (c: InputContextName) => globalInputContext.pop(c),
      get active() {
        return globalInputContext.active
      },
    }),
    [],
  )
}
