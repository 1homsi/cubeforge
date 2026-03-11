import { describe, it, expect, beforeEach } from 'vitest'
import { InputBuffer } from '../inputBuffer'

describe('InputBuffer', () => {
  describe('constructor', () => {
    it('creates with default options', () => {
      const buf = new InputBuffer()
      expect(buf).toBeDefined()
    })

    it('accepts custom bufferWindow and maxSize', () => {
      const buf = new InputBuffer({ bufferWindow: 0.5, maxSize: 8 })
      expect(buf).toBeDefined()
    })
  })

  describe('record', () => {
    it('records an action with explicit timestamp', () => {
      const buf = new InputBuffer()
      buf.record('jump', 1.0)
      expect(buf.has('jump', 1.0)).toBe(true)
    })

    it('does not double-record same action on same frame', () => {
      const buf = new InputBuffer()
      buf.record('jump', 1.0)
      buf.record('jump', 1.0)
      // Consume first one
      expect(buf.consume('jump', 1.0)).toBe(true)
      // Second one should not exist
      expect(buf.consume('jump', 1.0)).toBe(false)
    })

    it('records different actions on same frame', () => {
      const buf = new InputBuffer()
      buf.record('jump', 1.0)
      buf.record('attack', 1.0)
      expect(buf.has('jump', 1.0)).toBe(true)
      expect(buf.has('attack', 1.0)).toBe(true)
    })

    it('enforces maxSize by dropping oldest', () => {
      const buf = new InputBuffer({ maxSize: 3 })
      buf.record('a', 1.0)
      buf.update()
      buf.record('b', 1.0)
      buf.update()
      buf.record('c', 1.0)
      buf.update()
      buf.record('d', 1.0)
      // 'a' should have been dropped
      expect(buf.has('a', 1.0)).toBe(false)
      expect(buf.has('d', 1.0)).toBe(true)
    })
  })

  describe('consume', () => {
    it('returns true and removes a buffered action', () => {
      const buf = new InputBuffer()
      buf.record('jump', 1.0)
      expect(buf.consume('jump', 1.0)).toBe(true)
      expect(buf.has('jump', 1.0)).toBe(false)
    })

    it('returns false for actions not in buffer', () => {
      const buf = new InputBuffer()
      expect(buf.consume('jump', 1.0)).toBe(false)
    })

    it('returns false for expired actions', () => {
      const buf = new InputBuffer({ bufferWindow: 0.2 })
      buf.record('jump', 1.0)
      expect(buf.consume('jump', 2.0)).toBe(false) // 1 second later, way past 0.2s window
    })

    it('returns true for actions within buffer window', () => {
      const buf = new InputBuffer({ bufferWindow: 0.5 })
      buf.record('jump', 1.0)
      expect(buf.consume('jump', 1.3)).toBe(true) // 0.3s later, within 0.5s window
    })

    it('consumes the most recent matching action', () => {
      const buf = new InputBuffer()
      buf.record('jump', 1.0)
      buf.update()
      buf.record('jump', 1.1)
      expect(buf.consume('jump', 1.1)).toBe(true)
    })
  })

  describe('has', () => {
    it('returns false for empty buffer', () => {
      const buf = new InputBuffer()
      expect(buf.has('jump', 1.0)).toBe(false)
    })

    it('returns true for buffered action within window', () => {
      const buf = new InputBuffer({ bufferWindow: 0.5 })
      buf.record('jump', 1.0)
      expect(buf.has('jump', 1.2)).toBe(true)
    })

    it('returns false for expired action', () => {
      const buf = new InputBuffer({ bufferWindow: 0.2 })
      buf.record('jump', 1.0)
      expect(buf.has('jump', 5.0)).toBe(false)
    })

    it('does not remove the action (non-destructive)', () => {
      const buf = new InputBuffer()
      buf.record('jump', 1.0)
      expect(buf.has('jump', 1.0)).toBe(true)
      expect(buf.has('jump', 1.0)).toBe(true) // still there
    })
  })

  describe('clear', () => {
    it('removes all buffered actions', () => {
      const buf = new InputBuffer()
      buf.record('jump', 1.0)
      buf.record('attack', 1.0)
      buf.clear()
      expect(buf.has('jump', 1.0)).toBe(false)
      expect(buf.has('attack', 1.0)).toBe(false)
    })
  })

  describe('update', () => {
    it('increments frame counter so same action can be recorded again', () => {
      const buf = new InputBuffer()
      buf.record('jump', 1.0)
      buf.update()
      buf.record('jump', 1.0) // different frame, should succeed
      // Consume both
      expect(buf.consume('jump', 1.0)).toBe(true)
      expect(buf.consume('jump', 1.0)).toBe(true)
    })
  })
})
