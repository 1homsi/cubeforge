import { useState, useCallback } from 'react'

export interface RestartControls {
  /**
   * A key that increments on each call to `restart()`.
   * Use as a `key` prop on your root game component to force a full remount:
   * `<World key={restartKey}> ... </World>`
   */
  readonly restartKey: number
  /** Increment `restartKey`, causing any component that uses it as a `key` to remount. */
  restart(): void
}

/**
 * Returns a `restartKey` and `restart()` function.
 *
 * Pass `restartKey` as the `key` prop on the component you want to reset —
 * React will fully unmount and remount it when the key changes.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { restartKey, restart } = useRestart()
 *   return (
 *     <Game>
 *       <World key={restartKey}>
 *         <Player onDied={restart} />
 *       </World>
 *     </Game>
 *   )
 * }
 * ```
 */
export function useRestart(): RestartControls {
  const [restartKey, setRestartKey] = useState(0)

  const restart = useCallback(() => {
    setRestartKey(k => k + 1)
  }, [])

  return { restartKey, restart }
}
