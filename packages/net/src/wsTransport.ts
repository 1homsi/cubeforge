import type { NetTransport } from './transport'

/**
 * createWebSocketTransport — wraps the native browser WebSocket API.
 *
 * Multiple handlers of the same type (onMessage, onConnect, onDisconnect) are
 * supported and each registration appends to an internal list.
 */
export function createWebSocketTransport(url: string): NetTransport {
  const socket = new WebSocket(url)

  const messageHandlers: Array<(data: string) => void> = []
  const connectHandlers: Array<() => void> = []
  const disconnectHandlers: Array<() => void> = []

  socket.addEventListener('open', () => {
    for (const h of connectHandlers) h()
  })

  socket.addEventListener('message', (event: MessageEvent) => {
    const raw = typeof event.data === 'string' ? event.data : String(event.data)
    for (const h of messageHandlers) h(raw)
  })

  socket.addEventListener('close', () => {
    for (const h of disconnectHandlers) h()
  })

  socket.addEventListener('error', () => {
    for (const h of disconnectHandlers) h()
  })

  return {
    send(data: string): void {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data)
      }
    },

    onMessage(handler: (data: string) => void): void {
      messageHandlers.push(handler)
    },

    onConnect(handler: () => void): void {
      connectHandlers.push(handler)
      // If already open, fire immediately.
      if (socket.readyState === WebSocket.OPEN) handler()
    },

    onDisconnect(handler: () => void): void {
      disconnectHandlers.push(handler)
    },

    close(): void {
      socket.close()
    },
  }
}
