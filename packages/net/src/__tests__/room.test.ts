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

  it('sends structured messages as JSON', () => {
    const room = new Room({ transport: mock.transport })
    const msg: NetMessage = { type: 'ping', payload: { ok: true }, tick: 5 }

    room.send(msg)

    expect(mock.transport.send).toHaveBeenCalledWith(JSON.stringify(msg))
  })

  it('broadcast delegates to send', () => {
    const room = new Room({ transport: mock.transport })

    room.broadcast({ type: 'state', payload: { x: 1 } })

    expect(mock.transport.send).toHaveBeenCalledWith(JSON.stringify({ type: 'state', payload: { x: 1 } }))
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
})
