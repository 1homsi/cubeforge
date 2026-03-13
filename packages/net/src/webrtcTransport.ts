import type { BinaryNetTransport } from './transport'

export interface WebRTCTransportConfig {
  /**
   * STUN/TURN servers for ICE negotiation.
   * Defaults to Google's public STUN server, which works for most NAT scenarios.
   */
  iceServers?: RTCIceServer[]
  /**
   * When false (default) the data channel is unreliable + unordered (UDP-like).
   * Best for game state where the latest packet always wins.
   * When true, uses reliable + ordered mode (TCP-like) — better for chat or events.
   */
  ordered?: boolean
  /**
   * For unreliable channels: max number of retransmissions per packet (default 0).
   * Ignored when `ordered` is true.
   */
  maxRetransmits?: number
}

export interface WebRTCTransport extends BinaryNetTransport {
  /**
   * Create an SDP offer. Call this on the initiating peer and send the result
   * to the remote peer via your signaling channel (e.g. the WebSocket Room).
   */
  createOffer(): Promise<RTCSessionDescriptionInit>

  /**
   * Apply a remote SDP answer. Call this on the initiating peer after the
   * remote peer responds via signaling.
   */
  handleAnswer(sdp: RTCSessionDescriptionInit): Promise<void>

  /**
   * Apply a remote SDP offer and return a local answer. Call this on the
   * responding peer when it receives an offer via signaling.
   */
  handleOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>

  /**
   * Apply an ICE candidate received from the remote peer via signaling.
   * Call this for every candidate that arrives.
   */
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>

  /**
   * Register a handler that fires whenever a local ICE candidate is generated.
   * Forward these to the remote peer via your signaling channel.
   */
  onIceCandidate(handler: (candidate: RTCIceCandidateInit | null) => void): void
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

/**
 * createWebRTCTransport — peer-to-peer DataChannel transport via WebRTC.
 *
 * Implements `BinaryNetTransport` so it drops in wherever a WebSocket transport
 * is used. Signaling (SDP + ICE exchange) is left to the caller — use your
 * existing WebSocket `Room` to shuttle the handshake messages.
 *
 * ### Initiating peer
 * ```ts
 * const rtc = createWebRTCTransport({ ordered: false })
 *
 * rtc.onIceCandidate((c) => signalingRoom.send({ type: 'rtc:ice', payload: c }))
 *
 * const offer = await rtc.createOffer()
 * signalingRoom.send({ type: 'rtc:offer', payload: offer })
 *
 * signalingRoom.onMessage(async (msg) => {
 *   if (msg.type === 'rtc:answer') await rtc.handleAnswer(msg.payload as RTCSessionDescriptionInit)
 *   if (msg.type === 'rtc:ice')    await rtc.addIceCandidate(msg.payload as RTCIceCandidateInit)
 * })
 * ```
 *
 * ### Responding peer
 * ```ts
 * const rtc = createWebRTCTransport({ ordered: false })
 *
 * rtc.onIceCandidate((c) => signalingRoom.send({ type: 'rtc:ice', payload: c }))
 *
 * signalingRoom.onMessage(async (msg) => {
 *   if (msg.type === 'rtc:offer') {
 *     const answer = await rtc.handleOffer(msg.payload as RTCSessionDescriptionInit)
 *     signalingRoom.send({ type: 'rtc:answer', payload: answer })
 *   }
 *   if (msg.type === 'rtc:ice') await rtc.addIceCandidate(msg.payload as RTCIceCandidateInit)
 * })
 * ```
 */
export function createWebRTCTransport(config: WebRTCTransportConfig = {}): WebRTCTransport {
  const { iceServers = DEFAULT_ICE_SERVERS, ordered = false, maxRetransmits = 0 } = config

  const pc = new RTCPeerConnection({ iceServers })
  const channelConfig: RTCDataChannelInit = ordered ? { ordered: true } : { ordered: false, maxRetransmits }

  let channel: RTCDataChannel | null = null

  const messageHandlers: Array<(data: string) => void> = []
  const binaryHandlers: Array<(data: ArrayBuffer) => void> = []
  const connectHandlers: Array<() => void> = []
  const disconnectHandlers: Array<() => void> = []
  const iceCandidateHandlers: Array<(candidate: RTCIceCandidateInit | null) => void> = []

  pc.addEventListener('icecandidate', (event) => {
    const candidate = event.candidate ? event.candidate.toJSON() : null
    for (const h of iceCandidateHandlers) h(candidate)
  })

  // The responding peer receives the data channel via this event.
  pc.addEventListener('datachannel', (event) => {
    setupChannel(event.channel)
  })

  function setupChannel(ch: RTCDataChannel): void {
    channel = ch
    ch.binaryType = 'arraybuffer'

    ch.addEventListener('open', () => {
      for (const h of connectHandlers) h()
    })

    ch.addEventListener('close', () => {
      for (const h of disconnectHandlers) h()
    })

    ch.addEventListener('message', (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        for (const h of binaryHandlers) h(event.data)
      } else {
        for (const h of messageHandlers) h(event.data as string)
      }
    })
  }

  return {
    send(data: string): void {
      if (channel?.readyState === 'open') {
        channel.send(data)
      }
    },

    sendBinary(data: ArrayBuffer): void {
      if (channel?.readyState === 'open') {
        channel.send(data)
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
      if (channel?.readyState === 'open') handler()
    },

    onDisconnect(handler: () => void): void {
      disconnectHandlers.push(handler)
    },

    close(): void {
      channel?.close()
      pc.close()
    },

    async createOffer(): Promise<RTCSessionDescriptionInit> {
      // The initiating peer creates the data channel.
      const ch = pc.createDataChannel('cubeforge', channelConfig)
      setupChannel(ch)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      return offer
    },

    async handleAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    },

    async handleOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      return answer
    },

    async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    },

    onIceCandidate(handler: (candidate: RTCIceCandidateInit | null) => void): void {
      iceCandidateHandlers.push(handler)
    },
  }
}
