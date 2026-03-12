import { useState, useEffect, useRef } from 'react'
import type { Room } from './room'

export interface NetworkInputConfig {
  room: Room
  /** Keys to track and broadcast, e.g. `['ArrowLeft', 'ArrowRight', 'Space']`. */
  keys: string[]
}

const INPUT_MSG_TYPE = 'input:state'

/**
 * useNetworkInput — syncs keyboard state across peers via a Room.
 *
 * Each frame the local key state is broadcast to the room.  Incoming messages
 * from remote peers are stored in `remoteInputs`, keyed by `peerId`.
 */
export function useNetworkInput(config: NetworkInputConfig): {
  localInput: Record<string, boolean>
  remoteInputs: Map<string, Record<string, boolean>>
} {
  const { room, keys } = config

  const [localInput, setLocalInput] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(keys.map((k) => [k, false])),
  )
  const [remoteInputs] = useState<Map<string, Record<string, boolean>>>(() => new Map())

  // Keep a mutable ref so the broadcast interval closure always sees fresh state.
  const localInputRef = useRef<Record<string, boolean>>(localInput)

  useEffect(() => {
    // Track key state.
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

    // Broadcast local input at ~20 Hz.
    const broadcastInterval = setInterval(() => {
      if (!room.isConnected) return
      room.broadcast({
        type: INPUT_MSG_TYPE,
        payload: localInputRef.current,
      })
    }, 50)

    // Receive remote peer inputs.
    const unsubscribe = room.onMessage((msg) => {
      if (msg.type !== INPUT_MSG_TYPE) return
      if (!msg.peerId) return
      remoteInputs.set(msg.peerId, msg.payload as Record<string, boolean>)
    })

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      clearInterval(broadcastInterval)
      unsubscribe()
    }
  }, [room, keys, remoteInputs])

  return { localInput, remoteInputs }
}
