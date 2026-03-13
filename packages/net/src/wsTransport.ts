import type { BinaryNetTransport } from './transport'

export interface WebSocketTransportOptions {
  /**
   * Automatically reconnect on disconnect with exponential backoff (default false).
   * Reconnect attempts stop after `maxReconnectAttempts` or when `close()` is called.
   */
  reconnect?: boolean
  /** Base reconnection delay in ms (default 500). Doubles each attempt, capped at 16 s. */
  reconnectBaseDelayMs?: number
  /** Maximum reconnection attempts before giving up (default Infinity). */
  maxReconnectAttempts?: number
}

/**
 * createWebSocketTransport — wraps the native browser WebSocket API.
 *
 * - Supports multiple handlers per event type.
 * - Supports binary ArrayBuffer framing via BinaryNetTransport.
 * - Optional auto-reconnect with exponential backoff.
 */
export function createWebSocketTransport(url: string, options: WebSocketTransportOptions = {}): BinaryNetTransport {
  const { reconnect = false, reconnectBaseDelayMs = 500, maxReconnectAttempts = Infinity } = options

  const messageHandlers: Array<(data: string) => void> = []
  const binaryHandlers: Array<(data: ArrayBuffer) => void> = []
  const connectHandlers: Array<() => void> = []
  const disconnectHandlers: Array<() => void> = []

  let socket: WebSocket
  let reconnectAttempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let closed = false

  function connect(): void {
    socket = new WebSocket(url)
    socket.binaryType = 'arraybuffer'

    socket.addEventListener('open', () => {
      reconnectAttempts = 0
      for (const h of connectHandlers) h()
    })

    socket.addEventListener('message', (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        for (const h of binaryHandlers) h(event.data)
      } else if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((buf) => {
          for (const h of binaryHandlers) h(buf)
        })
      } else {
        const raw = typeof event.data === 'string' ? event.data : String(event.data)
        for (const h of messageHandlers) h(raw)
      }
    })

    socket.addEventListener('close', () => {
      for (const h of disconnectHandlers) h()
      if (!closed && reconnect && reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(reconnectBaseDelayMs * 2 ** reconnectAttempts, 16000)
        reconnectAttempts++
        reconnectTimer = setTimeout(connect, delay)
      }
    })

    // 'close' always fires after 'error', so reconnect logic runs there.
    socket.addEventListener('error', () => {})
  }

  connect()

  return {
    send(data: string): void {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data)
      }
    },

    sendBinary(data: ArrayBuffer): void {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data)
      }
    },

    onMessage(handler: (data: string) => void): void {
      messageHandlers.push(handler)
    },

    onBinaryMessage(handler: (data: ArrayBuffer) => void): void {
      binaryHandlers.push(handler)
    },

    onConnect(handler: () => void): void {
      connectHandlers.push(handler)
      if (socket?.readyState === WebSocket.OPEN) handler()
    },

    onDisconnect(handler: () => void): void {
      disconnectHandlers.push(handler)
    },

    close(): void {
      closed = true
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      socket.close()
    },
  }
}
