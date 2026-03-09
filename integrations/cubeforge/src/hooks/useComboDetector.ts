import { useMemo, useRef } from 'react'
import { ComboDetector } from '@cubeforge/input'
import type { ComboDefinition } from '@cubeforge/input'

export interface ComboDetectorResult {
  /** Feed an action into the detector */
  feed(action: string): string | null
  /** Clear history */
  clear(): void
  /** Last detected combo name, or null */
  lastCombo: string | null
}

/**
 * Returns a stable combo detector that tracks input sequences.
 *
 * Feed actions (e.g., from `input.justPressed`) each frame. When a
 * combo sequence is completed within the time window the combo name
 * is returned from `feed()` and stored in `lastCombo`.
 *
 * @example
 * ```tsx
 * const combos: ComboDefinition[] = [
 *   { name: 'hadouken', sequence: ['down', 'forward', 'punch'], maxInterval: 0.3 },
 * ]
 *
 * function Fighter() {
 *   const combo = useComboDetector(combos)
 *
 *   return (
 *     <Script update={(id, world, input, dt) => {
 *       if (input.justPressed('ArrowDown')) combo.feed('down')
 *       if (input.justPressed('ArrowRight')) combo.feed('forward')
 *       if (input.justPressed('KeyZ')) combo.feed('punch')
 *       if (combo.lastCombo === 'hadouken') { ... }
 *     }} />
 *   )
 * }
 * ```
 */
export function useComboDetector(combos: ComboDefinition[]): ComboDetectorResult {
  const lastComboRef = useRef<string | null>(null)

  const result = useMemo(() => {
    const detector = new ComboDetector({ combos })

    const api: ComboDetectorResult = {
      feed(action: string): string | null {
        const name = detector.feed(action)
        if (name) lastComboRef.current = name
        return name
      },
      clear(): void {
        detector.clear()
        lastComboRef.current = null
      },
      get lastCombo(): string | null {
        return lastComboRef.current
      },
    }
    return api
  }, [])

  return result
}

export type { ComboDefinition }
