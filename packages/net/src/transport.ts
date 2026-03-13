/**
 * NetTransport — the minimal interface that all network backends must satisfy.
 *
 * Implementations are responsible for framing messages as plain strings so the
 * higher-level Room/sync layers remain transport-agnostic.
 */
export interface NetTransport {
  /** Send a string message to the remote end. */
  send(data: string): void

  /** Register a handler that is called whenever a message arrives. */
  onMessage(handler: (data: string) => void): void

  /** Register a handler called when the connection is established. */
  onConnect(handler: () => void): void

  /** Register a handler called when the connection is closed or lost. */
  onDisconnect(handler: () => void): void

  /** Close the underlying connection. */
  close(): void
}

/**
 * BinaryNetTransport — extends NetTransport with binary channel support.
 *
 * Implemented by both the WebSocket and WebRTC transports.
 * Use `isBinaryTransport` to check at runtime before calling `sendBinary`.
 */
export interface BinaryNetTransport extends NetTransport {
  /** Send a raw binary message (ArrayBuffer). */
  sendBinary(data: ArrayBuffer): void
  /** Register a handler called whenever a binary message arrives. */
  onBinaryMessage(handler: (data: ArrayBuffer) => void): void
}

/** Type guard — returns true if the transport supports binary framing. */
export function isBinaryTransport(t: NetTransport): t is BinaryNetTransport {
  return typeof (t as BinaryNetTransport).sendBinary === 'function'
}
