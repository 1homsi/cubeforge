import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInputRecorder } from '../inputRecorder'
import type { InputRecorderControls } from '../inputRecorder'

describe('createInputRecorder', () => {
  let recorder: InputRecorderControls

  beforeEach(() => {
    recorder = createInputRecorder()
  })

  describe('initial state', () => {
    it('is not recording', () => {
      expect(recorder.isRecording).toBe(false)
    })

    it('is not playing', () => {
      expect(recorder.isPlaying).toBe(false)
    })

    it('getRecording returns empty frames', () => {
      expect(recorder.getRecording().frames).toEqual([])
    })
  })

  describe('recording', () => {
    it('startRecording sets isRecording to true', () => {
      recorder.startRecording()
      expect(recorder.isRecording).toBe(true)
    })

    it('stopRecording sets isRecording to false', () => {
      recorder.startRecording()
      recorder.stopRecording()
      expect(recorder.isRecording).toBe(false)
    })

    it('captureFrame records pressed keys', () => {
      recorder.startRecording()
      recorder.captureFrame(['ArrowRight', 'Space'])
      recorder.captureFrame(['ArrowRight'])
      recorder.stopRecording()

      const recording = recorder.getRecording()
      expect(recording.frames).toHaveLength(2)
      expect(recording.frames[0].frame).toBe(0)
      expect(recording.frames[0].pressedKeys).toEqual(['ArrowRight', 'Space'])
      expect(recording.frames[1].frame).toBe(1)
      expect(recording.frames[1].pressedKeys).toEqual(['ArrowRight'])
    })

    it('captureFrame is ignored when not recording', () => {
      recorder.captureFrame(['Space'])
      expect(recorder.getRecording().frames).toHaveLength(0)
    })

    it('startRecording resets previous frames', () => {
      recorder.startRecording()
      recorder.captureFrame(['a'])
      recorder.stopRecording()
      recorder.startRecording()
      expect(recorder.getRecording().frames).toHaveLength(0)
    })

    it('getRecording returns a copy of frames', () => {
      recorder.startRecording()
      recorder.captureFrame(['x'])
      recorder.stopRecording()
      const r1 = recorder.getRecording()
      const r2 = recorder.getRecording()
      expect(r1.frames).not.toBe(r2.frames)
      expect(r1.frames).toEqual(r2.frames)
    })

    it('captureFrame copies the pressedKeys array', () => {
      recorder.startRecording()
      const keys = ['a', 'b']
      recorder.captureFrame(keys)
      keys.push('c')
      recorder.stopRecording()
      expect(recorder.getRecording().frames[0].pressedKeys).toEqual(['a', 'b'])
    })
  })

  describe('playback', () => {
    it('playback sets isPlaying to true', () => {
      const recording = { frames: [{ frame: 0, pressedKeys: ['a'] }] }
      recorder.playback(recording)
      expect(recorder.isPlaying).toBe(true)
    })

    it('advancePlayback returns frames in order', () => {
      const recording = {
        frames: [
          { frame: 0, pressedKeys: ['a'] },
          { frame: 1, pressedKeys: ['b'] },
        ],
      }
      recorder.playback(recording)

      const f0 = recorder.advancePlayback()
      expect(f0).toEqual({ frame: 0, pressedKeys: ['a'] })

      const f1 = recorder.advancePlayback()
      expect(f1).toEqual({ frame: 1, pressedKeys: ['b'] })
    })

    it('advancePlayback returns null when playback ends', () => {
      const recording = { frames: [{ frame: 0, pressedKeys: [] }] }
      recorder.playback(recording)
      recorder.advancePlayback() // consume frame 0
      const result = recorder.advancePlayback()
      expect(result).toBeNull()
      expect(recorder.isPlaying).toBe(false)
    })

    it('advancePlayback returns null when not playing', () => {
      expect(recorder.advancePlayback()).toBeNull()
    })

    it('calls onComplete when playback finishes', () => {
      const onComplete = vi.fn()
      const recording = { frames: [{ frame: 0, pressedKeys: [] }] }
      recorder.playback(recording, onComplete)
      recorder.advancePlayback() // consume
      recorder.advancePlayback() // triggers completion
      expect(onComplete).toHaveBeenCalledOnce()
    })

    it('stopPlayback stops playback', () => {
      const recording = {
        frames: [
          { frame: 0, pressedKeys: ['a'] },
          { frame: 1, pressedKeys: ['b'] },
        ],
      }
      recorder.playback(recording)
      recorder.advancePlayback()
      recorder.stopPlayback()
      expect(recorder.isPlaying).toBe(false)
      expect(recorder.advancePlayback()).toBeNull()
    })

    it('playback with empty recording ends immediately', () => {
      const onComplete = vi.fn()
      const recording = { frames: [] }
      recorder.playback(recording, onComplete)
      expect(recorder.isPlaying).toBe(true)
      const result = recorder.advancePlayback()
      expect(result).toBeNull()
      expect(onComplete).toHaveBeenCalledOnce()
    })
  })
})
