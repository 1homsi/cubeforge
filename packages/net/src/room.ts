import type { NetTransport } from './transport'

export interface NetMessage {
  type: string
  payload: unknown
  /** Originating peer identifier (set by the server/relay). */
  peerId?: string
  /** Optional simulation tick the message is associated with. */
  tick?: number
}

export interface RoomConfig {
  transport: NetTransport
  /** Called for every message that arrives from a remote peer. */
  onPeerMessage?: (peerId: string, msg: NetMessage) => void
}

/**
 * Room — thin multiplayer session layer.
 *
 * Wraps a NetTransport to provide structured NetMessage send/receive and basic
 * connection lifecycle management.  All messages are JSON-serialised strings on
 * the wire.
 */
export class Room {
  private readonly _transport: NetTransport
  private readonly _onPeerMessage?: (peerId: string, msg: NetMessage) => void
  private _connected = false
  private _messageHandlers: Array<(msg: NetMessage) => void> = []

  constructor(config: RoomConfig) {
    this._transport = config.transport
    this._onPeerMessage = config.onPeerMessage

    this._transport.onConnect(() => {
      this._connected = true
    })

    this._transport.onDisconnect(() => {
      this._connected = false
    })

    this._transport.onMessage((raw: string) => {
      let msg: NetMessage
      try {
        msg = JSON.parse(raw) as NetMessage
      } catch {
        return // Ignore malformed frames.
      }

      // Dispatch to peer-message callback if a peerId is present.
      if (msg.peerId !== undefined && this._onPeerMessage) {
        this._onPeerMessage(msg.peerId, msg)
      }

      for (const h of this._messageHandlers) h(msg)
    })
  }

  /** Open the underlying transport connection. */
  connect(): void {
    // Transport connections are typically opened at construction time (e.g.
    // WebSocket). This method exists as a hook for transports that are lazy.
  }

  /** Close the underlying transport connection. */
  disconnect(): void {
    this._transport.close()
  }

  /** Send a structured message to the server/relay. */
  send(msg: NetMessage): void {
    this._transport.send(JSON.stringify(msg))
  }

  /**
   * Broadcast a message to all peers via the server/relay.
   * Equivalent to `send` in a client-server topology — the relay is responsible
   * for forwarding to other participants.
   */
  broadcast(msg: NetMessage): void {
    this.send(msg)
  }

  /** Register a handler that receives every inbound NetMessage. */
  onMessage(handler: (msg: NetMessage) => void): void {
    this._messageHandlers.push(handler)
  }

  get isConnected(): boolean {
    return this._connected
  }
}
