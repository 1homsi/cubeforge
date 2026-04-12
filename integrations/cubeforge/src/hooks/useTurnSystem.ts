import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { EngineContext } from '../context'

export interface TurnSystemOptions<P> {
  /** Ordered list of player identifiers. Must contain at least one. */
  players: P[]
  /** Index of the player who starts. Default 0. */
  initialIndex?: number
  /** Called every time the active player changes, *after* the change is applied. */
  onTurnStart?: (info: { player: P; index: number; turn: number }) => void
  /** Called just before the active player changes. */
  onTurnEnd?: (info: { player: P; index: number; turn: number }) => void
  /**
   * When non-zero, `nextTurn()` delays the player switch by this many seconds.
   * Useful for letting AI moves animate before the control is handed back.
   * Default 0 (instant).
   */
  aiDelay?: number
}

export interface TurnSystemControls<P> {
  /** The currently active player. */
  activePlayer: P
  /** The index of the currently active player. */
  activeIndex: number
  /** Turn counter — increments every time the active player changes. Starts at 0. */
  turn: number
  /** Advance to the next player in the list. Wraps around at the end. */
  nextTurn(): void
  /** Go back to the previous player. */
  prevTurn(): void
  /** Jump directly to a specific player by index or identifier. */
  skipTo(target: number | P): void
  /** Reset the system to its initial state. */
  reset(): void
  /** True while an `aiDelay` is pending between `nextTurn()` being called and the switch. */
  isPending: boolean
}

/**
 * Turn manager for turn-based games (chess, cards, strategy). Tracks the active
 * player, fires lifecycle callbacks, and supports an optional delay before
 * handing control back — useful when an AI player makes a move and you want the
 * animation to finish before the next player can act.
 *
 * @example
 * ```tsx
 * function Chess() {
 *   const turns = useTurnSystem<'white' | 'black'>({
 *     players: ['white', 'black'],
 *     aiDelay: 0.5,
 *     onTurnStart: ({ player }) => console.log(`${player}'s move`),
 *   })
 *
 *   const onMoveMade = () => {
 *     // apply the move...
 *     turns.nextTurn()
 *   }
 * }
 * ```
 */
export function useTurnSystem<P>({
  players,
  initialIndex = 0,
  onTurnStart,
  onTurnEnd,
  aiDelay = 0,
}: TurnSystemOptions<P>): TurnSystemControls<P> {
  if (players.length === 0) throw new Error('useTurnSystem requires at least one player')
  const engine = useContext(EngineContext)

  const [activeIndex, setActiveIndex] = useState(initialIndex % players.length)
  const [turn, setTurn] = useState(0)
  const [isPending, setIsPending] = useState(false)
  const pendingRafId = useRef<number | null>(null)
  const pendingRemaining = useRef<number>(0)
  const pendingTarget = useRef<number | null>(null)
  const pendingLastTime = useRef<number>(0)

  const clearPending = useCallback(() => {
    if (pendingRafId.current !== null) {
      cancelAnimationFrame(pendingRafId.current)
      pendingRafId.current = null
    }
    pendingTarget.current = null
    setIsPending(false)
  }, [])

  // Fire onTurnStart for the initial player exactly once
  const startedOnce = useRef(false)
  useEffect(() => {
    if (startedOnce.current) return
    startedOnce.current = true
    onTurnStart?.({ player: players[activeIndex], index: activeIndex, turn: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyChange = useCallback(
    (nextIndex: number) => {
      const curr = players[activeIndex]
      onTurnEnd?.({ player: curr, index: activeIndex, turn })
      const normalized = ((nextIndex % players.length) + players.length) % players.length
      const nextTurnNumber = turn + 1
      setActiveIndex(normalized)
      setTurn(nextTurnNumber)
      onTurnStart?.({ player: players[normalized], index: normalized, turn: nextTurnNumber })
      engine?.loop.markDirty()
    },
    [players, activeIndex, turn, onTurnStart, onTurnEnd, engine],
  )

  const scheduleChange = useCallback(
    (nextIndex: number) => {
      clearPending()
      if (aiDelay <= 0) {
        applyChange(nextIndex)
        return
      }
      setIsPending(true)
      pendingTarget.current = nextIndex
      pendingRemaining.current = aiDelay
      pendingLastTime.current = performance.now()

      const tick = (now: number) => {
        const dt = (now - pendingLastTime.current) / 1000
        pendingLastTime.current = now
        // Honor engine pause: if the loop is paused, freeze the countdown.
        const paused = engine?.loop.isPaused ?? false
        if (!paused) {
          pendingRemaining.current -= dt
        }
        if (pendingRemaining.current <= 0 && pendingTarget.current !== null) {
          const target = pendingTarget.current
          pendingTarget.current = null
          pendingRafId.current = null
          setIsPending(false)
          applyChange(target)
          return
        }
        pendingRafId.current = requestAnimationFrame(tick)
      }
      pendingRafId.current = requestAnimationFrame(tick)
    },
    [aiDelay, applyChange, clearPending, engine],
  )

  const nextTurn = useCallback(() => scheduleChange(activeIndex + 1), [scheduleChange, activeIndex])
  const prevTurn = useCallback(() => scheduleChange(activeIndex - 1), [scheduleChange, activeIndex])

  const skipTo = useCallback(
    (target: number | P) => {
      let idx: number
      if (typeof target === 'number') {
        idx = target
      } else {
        idx = players.indexOf(target)
        if (idx < 0) return
      }
      scheduleChange(idx)
    },
    [players, scheduleChange],
  )

  const reset = useCallback(() => {
    clearPending()
    setActiveIndex(initialIndex % players.length)
    setTurn(0)
    engine?.loop.markDirty()
  }, [players.length, initialIndex, clearPending, engine])

  // Cleanup any pending rAF on unmount
  useEffect(
    () => () => {
      if (pendingRafId.current !== null) cancelAnimationFrame(pendingRafId.current)
    },
    [],
  )

  return useMemo(
    () => ({
      activePlayer: players[activeIndex],
      activeIndex,
      turn,
      nextTurn,
      prevTurn,
      skipTo,
      reset,
      isPending,
    }),
    [players, activeIndex, turn, nextTurn, prevTurn, skipTo, reset, isPending],
  )
}
