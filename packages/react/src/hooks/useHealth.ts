import { useRef, useEffect, useContext, useCallback } from 'react'
import { EngineContext, EntityContext } from '../context'
import { createTimer } from './useTimer'

export interface HealthOptions {
  /**
   * Invincibility duration in seconds after taking damage (default 1.0).
   * Set to 0 to disable i-frames.
   */
  iFrames?: number
  /** Called when HP reaches 0. */
  onDeath?: () => void
  /** Called each time damage is dealt (after i-frame check). */
  onDamage?: (amount: number, currentHp: number) => void
}

export interface HealthControls {
  /** Current HP. */
  readonly hp: number
  /** Max HP set at creation. */
  readonly maxHp: number
  /** True when HP is 0. */
  readonly isDead: boolean
  /** True during the i-frame window after taking damage. */
  readonly isInvincible: boolean
  /**
   * Deal damage. Ignored while invincible or dead.
   * Also fires when the EventBus receives a `damage:<entityId>` event
   * (emitted by `useDamageZone`).
   */
  takeDamage(amount?: number): void
  /** Restore HP, clamped to maxHp. */
  heal(amount: number): void
  /** Set HP directly, clamped to [0, maxHp]. */
  setHp(hp: number): void
  /**
   * Advance the i-frame timer. Must be called from a Script `update`
   * function each frame while i-frames are active.
   */
  update(dt: number): void
}

/**
 * Manages entity HP, invincibility frames, and integrates with `useDamageZone`
 * via the engine EventBus. Must be used inside `<Entity>`.
 *
 * @example
 * function Player() {
 *   const health = useHealth(3, {
 *     onDeath: () => gameEvents.onPlayerDeath?.(),
 *   })
 *   return (
 *     <Entity>
 *       <Script update={(id, world, input, dt) => {
 *         health.update(dt)
 *         if (health.isDead) respawn()
 *       }} />
 *     </Entity>
 *   )
 * }
 */
export function useHealth(maxHp: number, opts: HealthOptions = {}): HealthControls {
  const engine   = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  const hpRef          = useRef(maxHp)
  const invincibleRef  = useRef(false)
  const iFrameDuration = opts.iFrames ?? 1.0

  // Keep callbacks in refs so they never go stale in closures
  const onDeathRef  = useRef(opts.onDeath)
  const onDamageRef = useRef(opts.onDamage)
  useEffect(() => { onDeathRef.current  = opts.onDeath  })
  useEffect(() => { onDamageRef.current = opts.onDamage })

  const timerRef = useRef(
    createTimer(iFrameDuration, () => { invincibleRef.current = false })
  )

  const takeDamage = useCallback((amount = 1): void => {
    if (invincibleRef.current || hpRef.current <= 0) return
    hpRef.current = Math.max(0, hpRef.current - amount)
    onDamageRef.current?.(amount, hpRef.current)
    if (iFrameDuration > 0) {
      invincibleRef.current = true
      timerRef.current.restart()
    }
    if (hpRef.current <= 0) onDeathRef.current?.()
  }, [iFrameDuration])

  // Keep takeDamage stable in the event listener closure
  const takeDamageRef = useRef(takeDamage)
  useEffect(() => { takeDamageRef.current = takeDamage }, [takeDamage])

  // Listen for damage events emitted by useDamageZone
  useEffect(() => {
    return engine.events.on<{ amount: number }>(`damage:${entityId}`, ({ amount }) => {
      takeDamageRef.current(amount)
    })
  }, [engine.events, entityId])

  const heal = useCallback((amount: number): void => {
    hpRef.current = Math.min(maxHp, hpRef.current + amount)
  }, [maxHp])

  const setHp = useCallback((hp: number): void => {
    hpRef.current = Math.min(maxHp, Math.max(0, hp))
  }, [maxHp])

  const update = useCallback((dt: number): void => {
    timerRef.current.update(dt)
  }, [])

  return {
    get hp()          { return hpRef.current },
    get maxHp()       { return maxHp },
    get isDead()      { return hpRef.current <= 0 },
    get isInvincible(){ return invincibleRef.current },
    takeDamage,
    heal,
    setHp,
    update,
  }
}
