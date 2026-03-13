import { useState, useEffect, useRef } from 'react'
import type { Room } from './room'

/** Minimal InputManager interface — matches @cubeforge/input without a hard dep. */
interface InputManagerLike {
  isDown(key: string): boolean
}

export interface NetworkInputConfig {
  room: Room
  /** Keys to track and broadcast, e.g. `['ArrowLeft', 'ArrowRight', 'Space']`. */
  keys: string[]
  /**
   * Optional InputManager instance. When provided, key state is read from the
   * engine's InputManager on each broadcast tick — this automatically includes
   * gamepad axes mapped to keys and any remapped bindings.
   * Falls back to raw DOM keyboard events when omitted.
   */
  input?: InputManagerLike
  /** Broadcast rate in Hz (default 20). */
  tickRate?: number
}

const INPUT_MSG_TYPE = 'input:state'

/**
 * useNetworkInput — syncs input state across peers via a Room.
 *
 * Pass the engine's `input` from `useGame()` to automatically pick up
 * gamepad and remapped key state. Raw DOM events are used as a fallback.
 */
export function useNetworkInput(config: NetworkInputConfig): {
  localInput: Record<string, boolean>
  remoteInputs: Map<string, Record<string, boolean>>
} {
  const { room, keys, input, tickRate = 20 } = config
  const intervalMs = 1000 / tickRate

  const [localInput, setLocalInput] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(keys.map((k) => [k, false])),
  )
  const [remoteInputs] = useState<Map<string, Record<string, boolean>>>(() => new Map())
  const localInputRef = useRef<Record<string, boolean>>(localInput)

  useEffect(() => {
    let cleanupDom: (() => void) | null = null

    if (!input) {
      // Raw DOM keyboard path.
      function handleKeyDown(e: KeyboardEvent) {
        if (!keys.includes(e.code) && !keys.includes(e.key)) return
        const key = keys.includes(e.code) ? e.code : e.key
        setLocalInput((prev) => {
          const next = { ...prev, [key]: true }
          localInputRef.current = next
          return next
        })
      }

      function handleKeyUp(e: KeyboardEvent) {
        if (!keys.includes(e.code) && !keys.includes(e.key)) return
        const key = keys.includes(e.code) ? e.code : e.key
        setLocalInput((prev) => {
          const next = { ...prev, [key]: false }
          localInputRef.current = next
          return next
        })
      }

      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
      cleanupDom = () => {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
      }
    }

    // Broadcast local input at tickRate Hz.
    const broadcastInterval = setInterval(() => {
      if (!room.isConnected) return

      if (input) {
        // InputManager path — poll state each tick.
        const state = Object.fromEntries(keys.map((k) => [k, input.isDown(k)]))
        const changed = keys.some((k) => state[k] !== localInputRef.current[k])
        if (changed) {
          setLocalInput(state)
          localInputRef.current = state
        }
      }

      room.broadcast({ type: INPUT_MSG_TYPE, payload: localInputRef.current })
    }, intervalMs)

    // Receive remote peer inputs.
    const unsubscribe = room.onMessage((msg) => {
      if (msg.type !== INPUT_MSG_TYPE) return
      if (!msg.peerId) return
      remoteInputs.set(msg.peerId, msg.payload as Record<string, boolean>)
    })

    return () => {
      cleanupDom?.()
      clearInterval(broadcastInterval)
      unsubscribe()
    }
  }, [room, keys, input, remoteInputs, intervalMs])

  return { localInput, remoteInputs }
}
