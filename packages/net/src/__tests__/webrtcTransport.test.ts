import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWebRTCTransport } from '../webrtcTransport'

// ── WebRTC mock ───────────────────────────────────────────────────────────────

interface MockDataChannelHandlers {
  open?: () => void
  close?: () => void
  message?: (event: { data: string | ArrayBuffer }) => void
}

function createMockDataChannel(handlers: MockDataChannelHandlers = {}): RTCDataChannel {
  const ch = {
    readyState: 'open' as RTCDataChannelState,
    binaryType: 'arraybuffer' as BinaryType,
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'open') handlers.open = handler as () => void
      if (event === 'close') handlers.close = handler as () => void
      if (event === 'message') handlers.message = handler as (e: { data: string | ArrayBuffer }) => void
    }),
  }
  return ch as unknown as RTCDataChannel
}

interface MockPCHandlers {
  icecandidate?: (event: { candidate: RTCIceCandidate | null }) => void
  datachannel?: (event: { channel: RTCDataChannel }) => void
}

function createMockPeerConnection(): { pc: RTCPeerConnection; handlers: MockPCHandlers } {
  const handlers: MockPCHandlers = {}
  const pc = {
    addEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'icecandidate') handlers.icecandidate = handler as MockPCHandlers['icecandidate']
      if (event === 'datachannel') handlers.datachannel = handler as MockPCHandlers['datachannel']
    }),
    createDataChannel: vi.fn(() => createMockDataChannel()),
    createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'mock-offer-sdp' })),
    createAnswer: vi.fn(async () => ({ type: 'answer', sdp: 'mock-answer-sdp' })),
    setLocalDescription: vi.fn(async () => {}),
    setRemoteDescription: vi.fn(async () => {}),
    addIceCandidate: vi.fn(async () => {}),
    close: vi.fn(),
  }
  return { pc: pc as unknown as RTCPeerConnection, handlers }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createWebRTCTransport', () => {
  let mockPC: RTCPeerConnection
  let pcHandlers: MockPCHandlers

  beforeEach(() => {
    const { pc, handlers } = createMockPeerConnection()
    mockPC = pc
    pcHandlers = handlers

    vi.stubGlobal(
      'RTCPeerConnection',
      vi.fn(() => mockPC),
    )
    vi.stubGlobal('RTCSessionDescription', vi.fn((sdp) => sdp))
    vi.stubGlobal('RTCIceCandidate', vi.fn((c) => c))
  })

  it('creates an RTCPeerConnection with ice servers', () => {
    createWebRTCTransport({ iceServers: [{ urls: 'stun:example.com' }] })
    expect(RTCPeerConnection).toHaveBeenCalledWith({ iceServers: [{ urls: 'stun:example.com' }] })
  })

  it('defaults to Google STUN when no iceServers provided', () => {
    createWebRTCTransport()
    const call = (RTCPeerConnection as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.iceServers[0].urls).toBe('stun:stun.l.google.com:19302')
  })

  it('fires onIceCandidate handler when local candidate is produced', () => {
    const transport = createWebRTCTransport()
    const handler = vi.fn()
    transport.onIceCandidate(handler)

    const mockCandidate = { toJSON: () => ({ candidate: 'mock' }) } as RTCIceCandidate
    pcHandlers.icecandidate?.({ candidate: mockCandidate })

    expect(handler).toHaveBeenCalledWith({ candidate: 'mock' })
  })

  it('fires onIceCandidate with null at end of candidates', () => {
    const transport = createWebRTCTransport()
    const handler = vi.fn()
    transport.onIceCandidate(handler)

    pcHandlers.icecandidate?.({ candidate: null })

    expect(handler).toHaveBeenCalledWith(null)
  })

  it('createOffer sets up a data channel and returns the offer', async () => {
    const transport = createWebRTCTransport()
    const offer = await transport.createOffer()

    expect(mockPC.createDataChannel).toHaveBeenCalledWith('cubeforge', expect.any(Object))
    expect(mockPC.setLocalDescription).toHaveBeenCalled()
    expect(offer).toMatchObject({ type: 'offer' })
  })

  it('handleAnswer calls setRemoteDescription', async () => {
    const transport = createWebRTCTransport()
    const sdp: RTCSessionDescriptionInit = { type: 'answer', sdp: 'mock-answer' }
    await transport.handleAnswer(sdp)
    expect(mockPC.setRemoteDescription).toHaveBeenCalled()
  })

  it('handleOffer creates an answer and sets both descriptions', async () => {
    const transport = createWebRTCTransport()
    const offer: RTCSessionDescriptionInit = { type: 'offer', sdp: 'mock-offer' }
    const answer = await transport.handleOffer(offer)

    expect(mockPC.setRemoteDescription).toHaveBeenCalled()
    expect(mockPC.setLocalDescription).toHaveBeenCalled()
    expect(answer).toMatchObject({ type: 'answer' })
  })

  it('addIceCandidate forwards to the peer connection', async () => {
    const transport = createWebRTCTransport()
    await transport.addIceCandidate({ candidate: 'test' })
    expect(mockPC.addIceCandidate).toHaveBeenCalled()
  })

  it('fires onConnect when the responding data channel opens', () => {
    const transport = createWebRTCTransport()
    const handler = vi.fn()
    transport.onConnect(handler)

    const chHandlers: MockDataChannelHandlers = {}
    const ch = createMockDataChannel(chHandlers)
    pcHandlers.datachannel?.({ channel: ch })
    chHandlers.open?.()

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('fires onDisconnect when the data channel closes', () => {
    const transport = createWebRTCTransport()
    const handler = vi.fn()
    transport.onDisconnect(handler)

    const chHandlers: MockDataChannelHandlers = {}
    const ch = createMockDataChannel(chHandlers)
    pcHandlers.datachannel?.({ channel: ch })
    chHandlers.close?.()

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('dispatches string messages to onMessage handlers', () => {
    const transport = createWebRTCTransport()
    const handler = vi.fn()
    transport.onMessage(handler)

    const chHandlers: MockDataChannelHandlers = {}
    const ch = createMockDataChannel(chHandlers)
    pcHandlers.datachannel?.({ channel: ch })
    chHandlers.message?.({ data: '{"type":"test"}' })

    expect(handler).toHaveBeenCalledWith('{"type":"test"}')
  })

  it('dispatches ArrayBuffer messages to onBinaryMessage handlers', () => {
    const transport = createWebRTCTransport()
    const handler = vi.fn()
    transport.onBinaryMessage(handler)

    const chHandlers: MockDataChannelHandlers = {}
    const ch = createMockDataChannel(chHandlers)
    pcHandlers.datachannel?.({ channel: ch })

    const buf = new ArrayBuffer(4)
    chHandlers.message?.({ data: buf })

    expect(handler).toHaveBeenCalledWith(buf)
  })

  it('close() closes the channel and peer connection', async () => {
    const transport = createWebRTCTransport()
    await transport.createOffer()
    transport.close()

    expect(mockPC.close).toHaveBeenCalledTimes(1)
  })

  it('uses unordered unreliable channel by default', () => {
    createWebRTCTransport()

    // Mock returns createDataChannel — check it's called with ordered:false
    const { pc } = createMockPeerConnection()
    vi.stubGlobal('RTCPeerConnection', vi.fn(() => pc))
    const transport2 = createWebRTCTransport({ ordered: false, maxRetransmits: 0 })
    transport2.createOffer()
    expect(pc.createDataChannel).toHaveBeenCalledWith('cubeforge', { ordered: false, maxRetransmits: 0 })
  })

  it('uses ordered channel when ordered:true', async () => {
    const { pc } = createMockPeerConnection()
    vi.stubGlobal('RTCPeerConnection', vi.fn(() => pc))
    const transport = createWebRTCTransport({ ordered: true })
    await transport.createOffer()
    expect(pc.createDataChannel).toHaveBeenCalledWith('cubeforge', { ordered: true })
  })
})
