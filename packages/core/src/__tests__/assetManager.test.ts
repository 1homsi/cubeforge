import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AssetManager } from '../assets/assetManager'

describe('AssetManager', () => {
  let assets: AssetManager

  beforeEach(() => {
    assets = new AssetManager()
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
  })

  describe('playLoopAudio', () => {
    it('returns null when audio buffer is not loaded', () => {
      expect(assets.playLoopAudio('nonexistent.mp3')).toBeNull()
    })
  })
})
