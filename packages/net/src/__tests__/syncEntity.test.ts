import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { syncEntity } from '../syncEntity'
import type { NetMessage, Room } from '../room'

describe('syncEntity', () => {
  let room: Pick<Room, 'isConnected' | 'broadcast' | 'onMessage'>
  let handlers: Array<(msg: NetMessage) => void>
  let world: {
    getComponent: ReturnType<typeof vi.fn>
  }
  let connected: boolean

  beforeEach(() => {
    vi.useFakeTimers()
    handlers = []
    connected = true
    room = {
      get isConnected() {
        return connected
      },
      broadcast: vi.fn(),
      onMessage: vi.fn((handler: (msg: NetMessage) => void) => {
        handlers.push(handler)
      }),
    }
    world = {
      getComponent: vi.fn(),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('broadcasts owner state at the configured tick rate', () => {
    world.getComponent.mockImplementation((_entityId: number, type: string) => {
      if (type === 'Transform') return { x: 10, y: 20 }
      if (type === 'Health') return { hp: 5 }
      return undefined
    })

    const sync = syncEntity({
      entityId: 7,
      components: ['Transform', 'Health', 'Missing'],
      room: room as Room,
      owner: true,
      tickRate: 2,
      world: world as never,
    })

    sync.start()
    vi.advanceTimersByTime(500)

    expect(room.broadcast).toHaveBeenCalledWith({
      type: 'entity:state',
      payload: {
        entityId: 7,
        Transform: { x: 10, y: 20 },
        Health: { hp: 5 },
      },
    })
  })

  it('does not broadcast when the room is disconnected', () => {
    connected = false
    const sync = syncEntity({
      entityId: 1,
      components: ['Transform'],
      room: room as Room,
      owner: true,
      tickRate: 20,
      world: world as never,
    })

    sync.start()
    vi.advanceTimersByTime(100)

    expect(room.broadcast).not.toHaveBeenCalled()
  })

  it('stops owner broadcasting after stop is called', () => {
    const sync = syncEntity({
      entityId: 1,
      components: ['Transform'],
      room: room as Room,
      owner: true,
      tickRate: 10,
      world: world as never,
    })

    sync.start()
    sync.stop()
    vi.advanceTimersByTime(500)

    expect(room.broadcast).not.toHaveBeenCalled()
  })

  it('registers an onMessage handler for non-owner peers', () => {
    const sync = syncEntity({
      entityId: 9,
      components: ['Transform'],
      room: room as Room,
      owner: false,
      world: world as never,
    })

    sync.start()

    expect(room.onMessage).toHaveBeenCalledTimes(1)
    expect(handlers).toHaveLength(1)
    expect(typeof handlers[0]).toBe('function')
  })

  it('shallow merges remote state onto existing components', () => {
    const transform = { x: 1, y: 2, z: 3 }
    world.getComponent.mockImplementation((_entityId: number, type: string) => {
      if (type === 'Transform') return transform
      return undefined
    })

    const sync = syncEntity({
      entityId: 5,
      components: ['Transform'],
      room: room as Room,
      owner: false,
      world: world as never,
    })

    sync.applyRemoteState({
      type: 'entity:state',
      payload: { entityId: 5, Transform: { x: 10 } },
    })

    expect(transform).toEqual({ x: 10, y: 2, z: 3 })
  })

  it('ignores remote state with the wrong message type', () => {
    const existing = { hp: 10 }
    world.getComponent.mockReturnValue(existing)
    const sync = syncEntity({
      entityId: 5,
      components: ['Health'],
      room: room as Room,
      owner: false,
      world: world as never,
    })

    sync.applyRemoteState({ type: 'other', payload: { entityId: 5, Health: { hp: 0 } } })

    expect(existing.hp).toBe(10)
  })

  it('ignores remote state for a different entity', () => {
    const existing = { hp: 10 }
    world.getComponent.mockReturnValue(existing)
    const sync = syncEntity({
      entityId: 5,
      components: ['Health'],
      room: room as Room,
      owner: false,
      world: world as never,
    })

    sync.applyRemoteState({
      type: 'entity:state',
      payload: { entityId: 6, Health: { hp: 0 } },
    })

    expect(existing.hp).toBe(10)
  })

  it('ignores incoming components that do not exist locally', () => {
    world.getComponent.mockReturnValue(undefined)
    const sync = syncEntity({
      entityId: 5,
      components: ['Health'],
      room: room as Room,
      owner: false,
      world: world as never,
    })

    expect(() =>
      sync.applyRemoteState({
        type: 'entity:state',
        payload: { entityId: 5, Health: { hp: 0 } },
      }),
    ).not.toThrow()
  })

  it('routes room messages through applyRemoteState for non-owners', () => {
    const existing = { hp: 10 }
    world.getComponent.mockReturnValue(existing)
    const sync = syncEntity({
      entityId: 5,
      components: ['Health'],
      room: room as Room,
      owner: false,
      world: world as never,
    })

    sync.start()
    handlers[0]({
      type: 'entity:state',
      payload: { entityId: 5, Health: { hp: 3 } },
    })

    expect(existing.hp).toBe(3)
  })
})
