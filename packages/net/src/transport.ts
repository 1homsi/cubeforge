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
