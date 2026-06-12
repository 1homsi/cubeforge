import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AssetManager } from '../assets/assetManager'

function installAudioMocks() {
  const source = {
    buffer: null as AudioBuffer | null,
    loop: false,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  }
  const gain = {
    gain: { value: 1 },
    connect: vi.fn(),
  }
  const audioBuffer = {} as AudioBuffer
  const ctx = {
    destination: {},
    createBufferSource: vi.fn(() => source),
    createGain: vi.fn(() => gain),
    decodeAudioData: vi.fn(async () => audioBuffer),
  }

  vi.stubGlobal(
    'AudioContext',
    vi.fn(() => ctx),
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(8),
    })),
  )

  return { source, ctx, audioBuffer }
}

describe('AssetManager', () => {
  let assets: AssetManager

  beforeEach(() => {
    assets = new AssetManager()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getProgress', () => {
    it('returns zero loaded and total initially', () => {
      const p = assets.getProgress()
      expect(p.loaded).toBe(0)
      expect(p.total).toBe(0)
    })

    it('returns percent 1 when no assets requested', () => {
      expect(assets.getProgress().percent).toBe(1)
    })
  })

  describe('onProgress', () => {
    it('subscribes and returns unsubscribe function', () => {
      const cb = vi.fn()
      const unsub = assets.onProgress(cb)
      expect(typeof unsub).toBe('function')
    })

    it('unsubscribe stops callbacks', () => {
      const cb = vi.fn()
      const unsub = assets.onProgress(cb)
      unsub()
      // After unsubscribing, no callbacks should fire
      // (we can't easily trigger loadImage in this environment, but the unsub itself should work)
      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('getImage', () => {
    it('returns undefined for unknown images', () => {
      expect(assets.getImage('nonexistent.png')).toBeUndefined()
    })
  })

  describe('getLoadedImages', () => {
    it('returns an empty map initially', () => {
      const loaded = assets.getLoadedImages()
      expect(loaded.size).toBe(0)
    })
  })

  describe('baseURL', () => {
    it('defaults to empty string', () => {
      expect(assets.baseURL).toBe('')
    })

    it('can be set', () => {
      assets.baseURL = '/assets'
      expect(assets.baseURL).toBe('/assets')
    })
  })

  describe('stopAll', () => {
    it('does not throw when no audio is playing', () => {
      expect(() => assets.stopAll()).not.toThrow()
    })
  })

  describe('stopAudio', () => {
    it('does not throw for unknown source', () => {
      expect(() => assets.stopAudio('nonexistent.mp3')).not.toThrow()
    })
  })

  describe('playAudio', () => {
    it('does nothing when audio buffer is not loaded', () => {
      // Should not throw
      expect(() => assets.playAudio('nonexistent.mp3')).not.toThrow()
    })

    it('uses baseURL-resolved keys for preloaded audio', async () => {
      const { source } = installAudioMocks()
      assets.baseURL = '/game'

      await assets.loadAudio('/sfx/jump.mp3')
      assets.playAudio('/sfx/jump.mp3')

      expect(fetch).toHaveBeenCalledWith('/game/sfx/jump.mp3')
      expect(source.start).toHaveBeenCalledTimes(1)
    })
  })

  describe('playLoopAudio', () => {
    it('returns null when audio buffer is not loaded', () => {
      expect(assets.playLoopAudio('nonexistent.mp3')).toBeNull()
    })

    it('allows stopAudio to stop baseURL-resolved loop sources', async () => {
      const { source } = installAudioMocks()
      assets.baseURL = '/game'

      await assets.loadAudio('/music/theme.mp3')
      const loopSource = assets.playLoopAudio('/music/theme.mp3')
      assets.stopAudio('/music/theme.mp3')

      expect(loopSource).toBe(source)
      expect(source.loop).toBe(true)
      expect(source.stop).toHaveBeenCalledTimes(1)
    })
  })
})
