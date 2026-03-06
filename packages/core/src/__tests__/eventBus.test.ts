import { describe, it, expect, beforeEach } from 'bun:test'
import { EventBus } from '../events/eventBus'

describe('EventBus', () => {
  let bus: EventBus

  beforeEach(() => {
    bus = new EventBus()
  })

  describe('on / emit', () => {
    it('registers a listener that is called on emit', () => {
      let received: number | undefined
      bus.on<number>('score', (data) => { received = data })
      bus.emit('score', 42)
      expect(received).toBe(42)
    })

    it('listener receives correct data', () => {
      const received: { x: number; y: number }[] = []
      bus.on<{ x: number; y: number }>('move', (data) => { received.push(data) })
      bus.emit('move', { x: 1, y: 2 })
      bus.emit('move', { x: 3, y: 4 })
      expect(received).toHaveLength(2)
      expect(received[0]).toEqual({ x: 1, y: 2 })
      expect(received[1]).toEqual({ x: 3, y: 4 })
    })

    it('emit with no listeners does nothing (no throw)', () => {
      expect(() => bus.emit('noListeners', 'data')).not.toThrow()
    })

    it('multiple listeners on same event all fire', () => {
      const log: string[] = []
      bus.on('hit', () => log.push('A'))
      bus.on('hit', () => log.push('B'))
      bus.on('hit', () => log.push('C'))
      bus.emit('hit')
      expect(log).toContain('A')
      expect(log).toContain('B')
      expect(log).toContain('C')
      expect(log).toHaveLength(3)
    })

    it('emit without data passes undefined to listener', () => {
      let received: unknown = 'sentinel'
      bus.on('ping', (data) => { received = data })
      bus.emit('ping')
      expect(received).toBeUndefined()
    })
  })

  describe('on returns unsubscribe function', () => {
    it('unsubscribe function removes the listener', () => {
      let count = 0
      const unsub = bus.on('tick', () => { count++ })
      bus.emit('tick')
      expect(count).toBe(1)
      unsub()
      bus.emit('tick')
      expect(count).toBe(1)
    })
  })

  describe('off', () => {
    it('removes a specific listener', () => {
      let count = 0
      const listener = () => { count++ }
      bus.on('event', listener)
      bus.emit('event')
      expect(count).toBe(1)
      bus.off('event', listener)
      bus.emit('event')
      expect(count).toBe(1)
    })

    it('does not affect other listeners on the same event', () => {
      let countA = 0
      let countB = 0
      const listenerA = () => { countA++ }
      const listenerB = () => { countB++ }
      bus.on('event', listenerA)
      bus.on('event', listenerB)
      bus.off('event', listenerA)
      bus.emit('event')
      expect(countA).toBe(0)
      expect(countB).toBe(1)
    })
  })

  describe('once', () => {
    it('fires exactly once', () => {
      let count = 0
      bus.once('boom', () => { count++ })
      bus.emit('boom')
      bus.emit('boom')
      bus.emit('boom')
      expect(count).toBe(1)
    })

    it('passes data to the once listener', () => {
      let received: string | undefined
      bus.once<string>('msg', (data) => { received = data })
      bus.emit('msg', 'hello')
      expect(received).toBe('hello')
    })

    it('once returns an unsubscribe that prevents the single firing', () => {
      let count = 0
      const unsub = bus.once('rare', () => { count++ })
      unsub()
      bus.emit('rare')
      expect(count).toBe(0)
    })
  })

  describe('clear', () => {
    it('clear(event) removes all listeners for that event', () => {
      let count = 0
      bus.on('x', () => { count++ })
      bus.on('x', () => { count++ })
      bus.clear('x')
      bus.emit('x')
      expect(count).toBe(0)
    })

    it('clear(event) does not remove listeners for other events', () => {
      let countX = 0
      let countY = 0
      bus.on('x', () => { countX++ })
      bus.on('y', () => { countY++ })
      bus.clear('x')
      bus.emit('x')
      bus.emit('y')
      expect(countX).toBe(0)
      expect(countY).toBe(1)
    })

    it('clear() with no args removes all listeners', () => {
      let countA = 0
      let countB = 0
      bus.on('a', () => { countA++ })
      bus.on('b', () => { countB++ })
      bus.clear()
      bus.emit('a')
      bus.emit('b')
      expect(countA).toBe(0)
      expect(countB).toBe(0)
    })
  })
})
