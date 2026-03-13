import type { ECSWorld } from '@cubeforge/core'
import type { Room, NetMessage } from './room'

export interface SyncConfig {
  /** Numeric ECS entity id to synchronise. */
  entityId: number
  /** Component `type` strings whose data should be included in each state message. */
  components: string[]
  room: Room
  /**
   * `true`  — this peer owns the entity and sends authoritative state.
   * `false` — this peer is a receiver and applies remote state locally.
   */
  owner: boolean
  /** Sends per second when `owner` is true (default 20). */
  tickRate?: number
  /** Reference to the ECS world. Typed as `any` for peer-dep compatibility. */
  world: ECSWorld
}

const SYNC_MSG_TYPE = 'entity:state'

/**
 * syncEntity — keeps a single ECS entity in sync across peers.
 *
 * Owner peers read component data from the world and broadcast only fields
 * that have changed since the last send (delta sync). Non-owner peers listen
 * for incoming state and apply it via shallow merge.
 */
export function syncEntity(config: SyncConfig): {
  start(): void
  stop(): void
  applyRemoteState(msg: NetMessage): void
} {
  const { entityId, components, room, owner, world } = config
  const tickRate = config.tickRate ?? 20
  const intervalMs = 1000 / tickRate

  let intervalId: ReturnType<typeof setInterval> | null = null
  let unsubscribe: (() => void) | null = null

  // Per-component JSON cache for delta detection — only changed fields are sent.
  const lastSent = new Map<string, string>()

  function buildDeltaPayload(): Record<string, unknown> | null {
    const delta: Record<string, unknown> = { entityId }
    let hasChanges = false

    for (const compType of components) {
      const comp = world.getComponent(entityId, compType)
      if (comp === undefined) continue
      const json = JSON.stringify(comp)
      if (json !== lastSent.get(compType)) {
        delta[compType] = comp
        lastSent.set(compType, json)
        hasChanges = true
      }
    }

    return hasChanges ? delta : null
  }

  function applyRemoteState(msg: NetMessage): void {
    if (msg.type !== SYNC_MSG_TYPE) return
    const payload = msg.payload as Record<string, unknown>
    if (payload.entityId !== entityId) return

    for (const compType of components) {
      const incoming = payload[compType]
      if (incoming === undefined) continue
      const existing = world.getComponent(entityId, compType)
      if (existing !== undefined) {
        // Shallow-merge incoming fields onto the existing component object so
        // that the ECS index remains valid (same object reference).
        Object.assign(existing, incoming)
      }
    }
  }

  return {
    start(): void {
      if (owner) {
        intervalId = setInterval(() => {
          if (!room.isConnected) return
          const payload = buildDeltaPayload()
          if (payload === null) return // nothing changed this tick
          room.broadcast({ type: SYNC_MSG_TYPE, payload })
        }, intervalMs)
      } else {
        const handler = (msg: NetMessage) => applyRemoteState(msg)
        unsubscribe = room.onMessage(handler)
      }
    },

    stop(): void {
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      lastSent.clear()
    },

    applyRemoteState,
  }
}
