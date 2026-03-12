import { useEffect, useRef } from 'react'
import { syncEntity } from '@cubeforge/net'
import type { Room } from '@cubeforge/net'
import type { ECSWorld, EntityId } from '@cubeforge/core'

export interface NetworkSyncOptions {
  /**
   * Sync sends per second when this peer is the owner (default 20).
   */
  tickRate?: number
}

/**
 * Keeps a single ECS entity synchronized with remote peers via a Room.
 *
 * Owner peers broadcast component state at `tickRate` Hz. Non-owner peers
 * receive and apply incoming state. The hook automatically starts on mount
 * and stops (unsubscribing handlers) on unmount.
 *
 * Must be used inside `<Game>`.
 *
 * @param entityId - The local ECS entity to synchronize.
 * @param components - Component type strings to include in each broadcast.
 * @param room - Active multiplayer Room instance.
 * @param world - The ECS world the entity lives in.
 * @param owner - `true` if this peer owns and sends authoritative state.
 * @param opts - Optional configuration.
 *
 * @example
 * function RemotePlayer({ entityId, room, world, isOwner }) {
 *   useNetworkSync(entityId, ['Transform', 'RigidBody'], room, world, isOwner)
 *   return <Sprite ... />
 * }
 */
export function useNetworkSync(
  entityId: EntityId,
  components: string[],
  room: Room,
  world: ECSWorld,
  owner: boolean,
  opts: NetworkSyncOptions = {},
): void {
  // Use a ref for opts so changes don't force re-subscription
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    const sync = syncEntity({
      entityId,
      components,
      room,
      owner,
      world,
      tickRate: optsRef.current.tickRate,
    })
    sync.start()
    return () => sync.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, room, world, owner, ...components])
}
