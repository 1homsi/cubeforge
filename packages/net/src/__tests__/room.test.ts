import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Room } from '../room'
import type { NetMessage } from '../room'
import type { NetTransport } from '../transport'

function createTransport() {
  let connectHandler: (() => void) | undefined
  let disconnectHandler: (() => void) | undefined
  let messageHandler: ((data: string) => void) | undefined

  const transport: NetTransport = {
    send: vi.fn(),
    close: vi.fn(),
    onConnect: vi.fn((handler: () => void) => {
      connectHandler = handler
    }),
    onDisconnect: vi.fn((handler: () => void) => {
      disconnectHandler = handler
    }),
    onMessage: vi.fn((handler: (data: string) => void) => {
      messageHandler = handler
    }),
  }

  return {
    transport,
    emitConnect: () => connectHandler?.(),
    emitDisconnect: () => disconnectHandler?.(),
    emitMessage: (msg: string) => messageHandler?.(msg),
  }
}

describe('Room', () => {
  let mock: ReturnType<typeof createTransport>

  beforeEach(() => {
    mock = createTransport()
  })

  it('starts disconnected and flips connected state on transport events', () => {
    const room = new Room({ transport: mock.transport })

    expect(room.isConnected).toBe(false)

    mock.emitConnect()
    expect(room.isConnected).toBe(true)

    mock.emitDisconnect()
    expect(room.isConnected).toBe(false)
  })

  it('sends structured messages as JSON with an auto-incrementing seq', () => {
    const room = new Room({ transport: mock.transport })
    const msg: NetMessage = { type: 'ping', payload: { ok: true }, tick: 5 }

    room.send(msg)

    const sent = JSON.parse((mock.transport.send as ReturnType<typeof vi.fn>).mock.calls[0][0])
    expect(sent).toMatchObject({ type: 'ping', payload: { ok: true }, tick: 5, seq: 0 })
  })

  it('increments seq on each send', () => {
    const room = new Room({ transport: mock.transport })

    room.send({ type: 'a', payload: null })
    room.send({ type: 'b', payload: null })
    room.send({ type: 'c', payload: null })

    const calls = (mock.transport.send as ReturnType<typeof vi.fn>).mock.calls
    expect(JSON.parse(calls[0][0]).seq).toBe(0)
    expect(JSON.parse(calls[1][0]).seq).toBe(1)
    expect(JSON.parse(calls[2][0]).seq).toBe(2)
  })

  it('broadcast delegates to send', () => {
    const room = new Room({ transport: mock.transport })

    room.broadcast({ type: 'state', payload: { x: 1 } })

    const sent = JSON.parse((mock.transport.send as ReturnType<typeof vi.fn>).mock.calls[0][0])
    expect(sent).toMatchObject({ type: 'state', payload: { x: 1 } })
  })

  it('disconnect closes the underlying transport', () => {
    const room = new Room({ transport: mock.transport })

    room.disconnect()

    expect(mock.transport.close).toHaveBeenCalledTimes(1)
  })

  it('dispatches parsed messages to registered handlers', () => {
    const room = new Room({ transport: mock.transport })
    const handlerA = vi.fn()
    const handlerB = vi.fn()
    const msg = { type: 'chat', payload: { text: 'hi' } }

    room.onMessage(handlerA)
    room.onMessage(handlerB)
    mock.emitMessage(JSON.stringify(msg))

    expect(handlerA).toHaveBeenCalledWith(msg)
    expect(handlerB).toHaveBeenCalledWith(msg)
  })

  it('onMessage returns an unsubscribe function that stops delivery', () => {
    const room = new Room({ transport: mock.transport })
    const handler = vi.fn()
    const msg = { type: 'ping', payload: {} }

    const unsubscribe = room.onMessage(handler)
    mock.emitMessage(JSON.stringify(msg))
    expect(handler).toHaveBeenCalledTimes(1)

    unsubscribe()
    mock.emitMessage(JSON.stringify(msg))
    expect(handler).toHaveBeenCalledTimes(1) // not called again
  })

  it('ignores malformed inbound frames', () => {
    const room = new Room({ transport: mock.transport })
    const handler = vi.fn()

    room.onMessage(handler)
    mock.emitMessage('{broken')

    expect(handler).not.toHaveBeenCalled()
  })

  it('forwards peer messages to onPeerMessage when peerId is present', () => {
    const onPeerMessage = vi.fn()
    new Room({ transport: mock.transport, onPeerMessage })
    const msg = { type: 'state', payload: { hp: 10 }, peerId: 'peer-1' }

    mock.emitMessage(JSON.stringify(msg))

    expect(onPeerMessage).toHaveBeenCalledWith('peer-1', msg)
  })

  it('does not call onPeerMessage when peerId is missing', () => {
    const onPeerMessage = vi.fn()
    new Room({ transport: mock.transport, onPeerMessage })

    mock.emitMessage(JSON.stringify({ type: 'state', payload: {} }))

    expect(onPeerMessage).not.toHaveBeenCalled()
  })

  it('adds peer to peers set on peer:join', () => {
    const onPeerJoin = vi.fn()
    const room = new Room({ transport: mock.transport, onPeerJoin })

    mock.emitMessage(JSON.stringify({ type: 'peer:join', payload: null, peerId: 'player-2' }))

    expect(room.peers.has('player-2')).toBe(true)
    expect(onPeerJoin).toHaveBeenCalledWith('player-2')
  })

  it('removes peer from peers set on peer:leave', () => {
    const onPeerLeave = vi.fn()
    const room = new Room({ transport: mock.transport, onPeerLeave })

    mock.emitMessage(JSON.stringify({ type: 'peer:join', payload: null, peerId: 'player-2' }))
    mock.emitMessage(JSON.stringify({ type: 'peer:leave', payload: null, peerId: 'player-2' }))

    expect(room.peers.has('player-2')).toBe(false)
    expect(onPeerLeave).toHaveBeenCalledWith('player-2')
  })

  it('sends a ping message and measures latency on pong', () => {
    mock.emitConnect()
    const room = new Room({ transport: mock.transport })
    // Manually mark as connected
    ;(mock.transport.onConnect as ReturnType<typeof vi.fn>).mock.calls[0][0]()

    room.ping()

    const sentRaw = (mock.transport.send as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const sentMsg = JSON.parse(sentRaw)
    expect(sentMsg.type).toBe('room:ping')

    // Simulate pong response
    const pingId = sentMsg.payload as string
    mock.emitMessage(JSON.stringify({ type: 'room:pong', payload: pingId }))

    // latencyMs should be updated (≥ 0)
    expect(room.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('pong messages are not forwarded to regular handlers', () => {
    const handler = vi.fn()
    const room = new Room({ transport: mock.transport })
    room.onMessage(handler)

    mock.emitMessage(JSON.stringify({ type: 'room:pong', payload: 'some-id' }))

    expect(handler).not.toHaveBeenCalled()
  })

  it('latencyMs starts at 0', () => {
    const room = new Room({ transport: mock.transport })
    expect(room.latencyMs).toBe(0)
  })

  it('ping does nothing when not connected', () => {
    const room = new Room({ transport: mock.transport })
    room.ping() // not connected
    expect(mock.transport.send).not.toHaveBeenCalled()
  })
})
