import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Web Audio API mocks ────────────────────────────────────────────────────

function createMockGainNode() {
  return {
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function createMockSourceNode() {
  const node: any = {
    buffer: null,
    loop: false,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  }
  // Simulate ending after stop()
  node.stop.mockImplementation(() => {
    if (node.onended) node.onended()
  })
  return node
}

function createMockPannerNode() {
  return {
    panningModel: 'HRTF',
    distanceModel: 'linear',
    maxDistance: 10000,
    refDistance: 1,
    rolloffFactor: 1,
    positionX: { value: 0, setValueAtTime: vi.fn() },
    positionY: { value: 0, setValueAtTime: vi.fn() },
    positionZ: { value: 0, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

let mockCtx: any
let createdSources: any[]
let createdGains: any[]
let createdPanners: any[]

function setupAudioMocks() {
  createdSources = []
  createdGains = []
  createdPanners = []

  mockCtx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(),
    createGain: vi.fn(() => {
      const g = createMockGainNode()
      createdGains.push(g)
      return g
    }),
    createBufferSource: vi.fn(() => {
      const s = createMockSourceNode()
      createdSources.push(s)
      return s
    }),
    createPanner: vi.fn(() => {
      const p = createMockPannerNode()
      createdPanners.push(p)
      return p
    }),
    decodeAudioData: vi.fn(async () => ({ duration: 1, length: 44100 })),
    listener: {
      positionX: { value: 0, setValueAtTime: vi.fn() },
      positionY: { value: 0, setValueAtTime: vi.fn() },
      positionZ: { value: 0, setValueAtTime: vi.fn() },
    },
  }
  ;(globalThis as any).AudioContext = vi.fn(() => mockCtx)

  // Mock fetch for loadBuffer
  ;(globalThis as any).fetch = vi.fn(async () => ({
    arrayBuffer: async () => new ArrayBuffer(8),
  }))
}

// ─── Minimal React ref/effect mock ──────────────────────────────────────────

let cleanupFns: (() => void)[]
let effectCallbacks: (() => (() => void) | void)[]

vi.mock('react', () => ({
  useRef: (init: any) => ({ current: init }),
  useEffect: (cb: () => (() => void) | void, _deps?: any[]) => {
    effectCallbacks.push(cb)
  },
}))

function flushEffects() {
  for (const cb of effectCallbacks) {
    const cleanup = cb()
    if (cleanup) cleanupFns.push(cleanup)
  }
  effectCallbacks = []
}

function runCleanups() {
  for (const fn of cleanupFns) fn()
  cleanupFns = []
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Audio system', () => {
  beforeEach(() => {
    cleanupFns = []
    effectCallbacks = []
    setupAudioMocks()
  })

  afterEach(() => {
    runCleanups()
    vi.restoreAllMocks()

    // Reset the module-level singletons by clearing the module cache
    vi.resetModules()
  })

  describe('Buffer ref counting', () => {
    it('removes buffer from cache when last consumer unmounts', async () => {
      const { useSound, _getBufferCache, _getBufferRefCount } = await import('../useSound')

      // First consumer
      useSound('/boom.wav')
      flushEffects()
      await vi.waitFor(() => expect(_getBufferCache().has('/boom.wav')).toBe(true))

      expect(_getBufferRefCount().get('/boom.wav')).toBe(1)

      // Unmount → cleanup decrements to 0 → cache entry removed
      runCleanups()
      expect(_getBufferCache().has('/boom.wav')).toBe(false)
      expect(_getBufferRefCount().has('/boom.wav')).toBe(false)
    })

    it('keeps buffer in cache when other consumers remain', async () => {
      const { useSound, _getBufferCache, _getBufferRefCount } = await import('../useSound')

      // Two consumers of the same src
      useSound('/boom.wav')
      flushEffects()
      await vi.waitFor(() => expect(_getBufferCache().has('/boom.wav')).toBe(true))

      useSound('/boom.wav')
      flushEffects()
      await vi.waitFor(() => expect(_getBufferRefCount().get('/boom.wav')).toBe(2))

      // First unmount — refcount drops to 1, buffer stays
      const first = cleanupFns.shift()!
      first()
      expect(_getBufferRefCount().get('/boom.wav')).toBe(1)
      expect(_getBufferCache().has('/boom.wav')).toBe(true)

      // Second unmount — refcount drops to 0, buffer removed
      runCleanups()
      expect(_getBufferCache().has('/boom.wav')).toBe(false)
    })
  })

  describe('maxInstances limits concurrent source nodes', () => {
    it('stops oldest instance when maxInstances exceeded', async () => {
      const { useSound } = await import('../useSound')

      const controls = useSound('/pew.wav', { maxInstances: 2 })
      flushEffects()

      // Give loadBuffer time to resolve
      await new Promise((r) => setTimeout(r, 10))

      controls.play()
      controls.play()

      // 2 sources created, both active
      // Note: createGain is called for group/master chains too; count sources
      const sourcesBeforeOverflow = createdSources.length
      expect(sourcesBeforeOverflow).toBe(2)

      // Third play should evict the oldest
      controls.play()
      expect(createdSources.length).toBe(3)
      // The first source's stop() should have been called
      expect(createdSources[0].stop).toHaveBeenCalled()
    })
  })

  describe('Spatial sound', () => {
    it('setPosition updates panner positionX/Y', async () => {
      const { useSpatialSound } = await import('../useSpatialSound')

      const controls = useSpatialSound('/explosion.wav', { maxDistance: 500 })
      flushEffects()

      await new Promise((r) => setTimeout(r, 10))

      // setPosition creates the panner lazily
      controls.setPosition(200, 300)

      expect(createdPanners.length).toBe(1)
      const panner = createdPanners[0]
      expect(panner.positionX.setValueAtTime).toHaveBeenCalledWith(200, mockCtx.currentTime)
      expect(panner.positionY.setValueAtTime).toHaveBeenCalledWith(300, mockCtx.currentTime)
    })

    it('play routes source through panner', async () => {
      const { useSpatialSound } = await import('../useSpatialSound')

      const controls = useSpatialSound('/explosion.wav')
      flushEffects()
      await new Promise((r) => setTimeout(r, 10))

      controls.play()

      // Source should be connected to panner
      expect(createdSources.length).toBe(1)
      expect(createdSources[0].connect).toHaveBeenCalled()
      expect(createdPanners.length).toBe(1)
      // Panner connected to gain
      expect(createdPanners[0].connect).toHaveBeenCalled()
    })
  })

  describe('setListenerPosition', () => {
    it('sets AudioContext listener position', async () => {
      const { setListenerPosition } = await import('../listener')

      setListenerPosition(100, 200)

      expect(mockCtx.listener.positionX.setValueAtTime).toHaveBeenCalledWith(100, mockCtx.currentTime)
      expect(mockCtx.listener.positionY.setValueAtTime).toHaveBeenCalledWith(200, mockCtx.currentTime)
    })
  })
})
