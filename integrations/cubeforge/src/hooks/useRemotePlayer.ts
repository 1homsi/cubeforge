import { useEffect, useRef, useState } from 'react'
import type { Room, NetMessage } from '@cubeforge/net'
import type { ECSWorld, EntityId } from '@cubeforge/core'

const PEER_JOIN_MSG = 'peer:join'
const PEER_LEAVE_MSG = 'peer:leave'

export interface RemotePlayerOptions {
  /**
   * Component types to synchronize from remote peers. If provided,
   * incoming `entity:state` messages for these components are applied.
   * Leave empty if you handle state application yourself.
   */
  syncComponents?: string[]
}

export interface RemotePlayerControls {
  /**
   * Map from peerId → local EntityId for every currently connected remote peer.
   * Read-only — updated automatically as peers join/leave.
   */
  readonly players: ReadonlyMap<string, EntityId>
}

/**
 * Manages spawning and despawning of local ECS entities for remote peers.
 *
 * When a `peer:join` message arrives the `createEntity` factory is called and
 * the resulting EntityId is tracked. When a `peer:leave` message arrives (or
 * the component unmounts) `destroyEntity` is called and the entity removed.
 *
 * Pair with `useNetworkSync` on the spawned entity to keep state in sync.
 *
 * @example
 * function MultiplayerScene({ room, world }) {
 *   const { players } = useRemotePlayer({
 *     room,
 *     world,
 *     createEntity: (peerId) => {
 *       const id = world.createEntity()
 *       world.addComponent(id, createTransform(100, 100))
 *       world.addComponent(id, createTag(peerId))
 *       return id
 *     },
 *     destroyEntity: (id) => world.destroyEntity(id),
 *   })
 * }
 */
export function useRemotePlayer(config: {
  room: Room
  world: ECSWorld
  createEntity: (peerId: string) => EntityId
  destroyEntity?: (entityId: EntityId, peerId: string) => void
  opts?: RemotePlayerOptions
}): RemotePlayerControls {
  const { room, world, createEntity, destroyEntity } = config

  const [players, setPlayers] = useState<Map<string, EntityId>>(() => new Map())
  const playersRef = useRef(players)

  const createRef = useRef(createEntity)
  createRef.current = createEntity
  const destroyRef = useRef(destroyEntity)
  destroyRef.current = destroyEntity

  useEffect(() => {
    function spawnPeer(peerId: string) {
      if (playersRef.current.has(peerId)) return
      const entityId = createRef.current(peerId)
      setPlayers((prev) => {
        const next = new Map(prev)
        next.set(peerId, entityId)
        playersRef.current = next
        return next
      })
    }

    function despawnPeer(peerId: string) {
      const entityId = playersRef.current.get(peerId)
      if (entityId === undefined) return
      destroyRef.current?.(entityId, peerId)
      if (world.hasEntity(entityId)) world.destroyEntity(entityId)
      setPlayers((prev) => {
        const next = new Map(prev)
        next.delete(peerId)
        playersRef.current = next
        return next
      })
    }

    const unsubscribe = room.onMessage((msg: NetMessage) => {
      if (!msg.peerId) return
      if (msg.type === PEER_JOIN_MSG) spawnPeer(msg.peerId)
      if (msg.type === PEER_LEAVE_MSG) despawnPeer(msg.peerId)
    })

    return () => {
      unsubscribe()
      // Despawn all remote players on unmount
      for (const [peerId, entityId] of playersRef.current) {
        destroyRef.current?.(entityId, peerId)
        if (world.hasEntity(entityId)) world.destroyEntity(entityId)
      }
      setPlayers(new Map())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, world])

  return { players }
}
