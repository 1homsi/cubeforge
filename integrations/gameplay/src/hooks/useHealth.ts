import { useRef, useEffect, useContext, useCallback } from 'react'
import { EngineContext, EntityContext } from '@cubeforge/context'
import { createTimer } from '@cubeforge/core'

export interface HealthOptions {
  iFrames?: number
  onDeath?: () => void
  onDamage?: (amount: number, currentHp: number) => void
}

export interface HealthControls {
  readonly hp: number
  readonly maxHp: number
  readonly isDead: boolean
  readonly isInvincible: boolean
  takeDamage(amount?: number): void
  heal(amount: number): void
  setHp(hp: number): void
  update(dt: number): void
}

export function useHealth(maxHp: number, opts: HealthOptions = {}): HealthControls {
  const engine   = useContext(EngineContext)!
  const entityId = useContext(EntityContext)!

  const hpRef          = useRef(maxHp)
  const invincibleRef  = useRef(false)
  const iFrameDuration = opts.iFrames ?? 1.0

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

  const takeDamageRef = useRef(takeDamage)
  useEffect(() => { takeDamageRef.current = takeDamage }, [takeDamage])

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
