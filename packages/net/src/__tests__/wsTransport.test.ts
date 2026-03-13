import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createWebSocketTransport } from '../wsTransport'

class MockWebSocket {
  static OPEN = 1
  static CONNECTING = 0
  static instances: MockWebSocket[] = []
  readyState = MockWebSocket.CONNECTING
  sent: string[] = []
  closed = false
  private listeners = new Map<string, Array<(event?: any) => void>>()

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this)
  }

  addEventListener(type: string, handler: (event?: any) => void) {
    const list = this.listeners.get(type) ?? []
    list.push(handler)
    this.listeners.set(type, list)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
  }

  emit(type: string, event?: any) {
    for (const handler of this.listeners.get(type) ?? []) handler(event)
  }
}

describe('createWebSocketTransport', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  it('creates a websocket for the given URL', () => {
    createWebSocketTransport('ws://example.test')

    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.instances[0].url).toBe('ws://example.test')
  })

  it('forwards inbound string messages to registered handlers', () => {
    const transport = createWebSocketTransport('ws://example.test')
    const handler = vi.fn()

    transport.onMessage(handler)
    MockWebSocket.instances[0].emit('message', { data: 'hello' })

    expect(handler).toHaveBeenCalledWith('hello')
  })

  it('stringifies non-string message data', () => {
    const transport = createWebSocketTransport('ws://example.test')
    const handler = vi.fn()

    transport.onMessage(handler)
    MockWebSocket.instances[0].emit('message', { data: 123 })

    expect(handler).toHaveBeenCalledWith('123')
  })

  it('notifies connect handlers on open', () => {
    const transport = createWebSocketTransport('ws://example.test')
    const handlerA = vi.fn()
    const handlerB = vi.fn()

    transport.onConnect(handlerA)
    transport.onConnect(handlerB)
    MockWebSocket.instances[0].readyState = MockWebSocket.OPEN
    MockWebSocket.instances[0].emit('open')

    expect(handlerA).toHaveBeenCalledTimes(1)
    expect(handlerB).toHaveBeenCalledTimes(1)
  })

  it('fires onConnect immediately when already open', () => {
    const transport = createWebSocketTransport('ws://example.test')
    MockWebSocket.instances[0].readyState = MockWebSocket.OPEN
    const handler = vi.fn()

    transport.onConnect(handler)

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('notifies disconnect handlers on close', () => {
    const transport = createWebSocketTransport('ws://example.test')
    const handler = vi.fn()

    transport.onDisconnect(handler)
    MockWebSocket.instances[0].emit('close')

    // In a real WebSocket, 'close' always follows 'error', so disconnect
    // fires once from close. Emitting 'error' alone does not fire disconnect
    // since that would double-fire on real connections.
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('sends only when the socket is open', () => {
    const transport = createWebSocketTransport('ws://example.test')

    transport.send('a')
    MockWebSocket.instances[0].readyState = MockWebSocket.OPEN
    transport.send('b')

    expect(MockWebSocket.instances[0].sent).toEqual(['b'])
  })

  it('closes the websocket when close is called', () => {
    const transport = createWebSocketTransport('ws://example.test')

    transport.close()

    expect(MockWebSocket.instances[0].closed).toBe(true)
  })
})
