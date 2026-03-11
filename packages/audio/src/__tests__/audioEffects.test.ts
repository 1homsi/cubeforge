import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Web Audio mocks ──────────────────────────────────────────────────────────

function makeBiquadFilter() {
  return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }
}
function makeConvolver() {
  return { buffer: null as unknown, connect: vi.fn(), disconnect: vi.fn() }
}
function makeCompressor() {
  return {
    threshold: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}
function makeDelay() {
  return { delayTime: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }
}
function makeGain(value = 1) {
  return { gain: { value }, connect: vi.fn(), disconnect: vi.fn() }
}

let mockCtx: any

function setupMocks() {
  mockCtx = {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    createGain: vi.fn(() => makeGain()),
    createBiquadFilter: vi.fn(() => makeBiquadFilter()),
    createConvolver: vi.fn(() => makeConvolver()),
    createDynamicsCompressor: vi.fn(() => makeCompressor()),
    createDelay: vi.fn(() => makeDelay()),
    createBuffer: vi.fn((_channels: number, length: number) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
    })),
    resume: vi.fn(),
  }
  ;(globalThis as any).AudioContext = vi.fn(() => mockCtx)
}

describe('Audio effects', () => {
  beforeEach(() => {
    setupMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  describe('setGroupEffect — lowpass', () => {
    it('creates a BiquadFilter node and inserts it between group gain and master', async () => {
      const { setGroupEffect } = await import('../audioEffects')

      setGroupEffect('sfx', { type: 'lowpass', frequency: 800 })

      expect(mockCtx.createBiquadFilter).toHaveBeenCalled()
      const filter = mockCtx.createBiquadFilter.mock.results[0].value
      expect(filter.type).toBe('lowpass')
      expect(filter.frequency.value).toBe(800)
    })

    it('connects group gain through filter to master', async () => {
      const { setGroupEffect } = await import('../audioEffects')
      const { getGroupGainNode } = await import('../audioContext')

      setGroupEffect('sfx', { type: 'lowpass' })

      const sfxGain = getGroupGainNode('sfx')
      const filter = mockCtx.createBiquadFilter.mock.results[0].value
      // sfxGain was disconnected and reconnected through filter
      expect(sfxGain.disconnect).toHaveBeenCalled()
      expect(sfxGain.connect).toHaveBeenCalledWith(filter)
    })
  })

  describe('setGroupEffect — highpass', () => {
    it('sets filter type to highpass and uses default frequency', async () => {
      const { setGroupEffect } = await import('../audioEffects')

      setGroupEffect('sfx', { type: 'highpass' })

      const filter = mockCtx.createBiquadFilter.mock.results[0].value
      expect(filter.type).toBe('highpass')
      expect(filter.frequency.value).toBe(200)
    })
  })

  describe('setGroupEffect — reverb', () => {
    it('creates a ConvolverNode and sets a buffer', async () => {
      const { setGroupEffect } = await import('../audioEffects')

      setGroupEffect('sfx', { type: 'reverb', roomSize: 0.6 })

      expect(mockCtx.createConvolver).toHaveBeenCalled()
      const convolver = mockCtx.createConvolver.mock.results[0].value
      expect(convolver.buffer).not.toBeNull()
    })
  })

  describe('setGroupEffect — compressor', () => {
    it('creates a DynamicsCompressorNode with correct settings', async () => {
      const { setGroupEffect } = await import('../audioEffects')

      setGroupEffect('music', { type: 'compressor', threshold: -18, ratio: 6 })

      const comp = mockCtx.createDynamicsCompressor.mock.results[0].value
      expect(comp.threshold.value).toBe(-18)
      expect(comp.ratio.value).toBe(6)
    })
  })

  describe('setGroupEffect — delay', () => {
    it('creates a DelayNode with feedback loop', async () => {
      const { setGroupEffect } = await import('../audioEffects')

      setGroupEffect('sfx', { type: 'delay', time: 0.3, feedback: 0.4 })

      expect(mockCtx.createDelay).toHaveBeenCalled()
      const delay = mockCtx.createDelay.mock.results[0].value
      expect(delay.delayTime.value).toBe(0.3)
    })
  })

  describe('clearGroupEffect', () => {
    it('removes the effect and reconnects group gain directly to master', async () => {
      const { setGroupEffect, clearGroupEffect } = await import('../audioEffects')
      const { getGroupGainNode } = await import('../audioContext')

      setGroupEffect('sfx', { type: 'lowpass', frequency: 500 })
      clearGroupEffect('sfx')

      // After clear, group gain should be reconnected to master gain
      const sfxGain = getGroupGainNode('sfx')
      const masterGain = getGroupGainNode('master')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connectCalls = (sfxGain.connect as any).mock.calls.map((c: any[]) => c[0])
      // Last connect should be to masterGain (direct connection restored)
      expect(connectCalls[connectCalls.length - 1]).toBe(masterGain)
    })

    it('is a no-op when no effect is set', async () => {
      const { clearGroupEffect } = await import('../audioEffects')
      // Should not throw
      expect(() => clearGroupEffect('music')).not.toThrow()
    })
  })

  describe('replacing an effect', () => {
    it('removing old effect before inserting new one', async () => {
      const { setGroupEffect } = await import('../audioEffects')

      setGroupEffect('sfx', { type: 'lowpass' })
      setGroupEffect('sfx', { type: 'highpass' })

      // Two biquad filters should have been created
      expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(2)
      const second = mockCtx.createBiquadFilter.mock.results[1].value
      expect(second.type).toBe('highpass')
    })
  })
})
