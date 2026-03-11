import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClientPrediction } from '../clientPrediction'
import type { WorldSnapshot } from '@cubeforge/core'

describe('ClientPrediction', () => {
  let snapshotCounter: number
  let world: {
    getSnapshot: ReturnType<typeof vi.fn>
    restoreSnapshot: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    snapshotCounter = 0
    world = {
      getSnapshot: vi.fn(() => ({ tick: snapshotCounter++ }) as unknown as WorldSnapshot),
      restoreSnapshot: vi.fn(),
    }
  })

  it('stores snapshots by tick', () => {
    const prediction = new ClientPrediction({ world: world as never })

    prediction.saveFrame(10)
    prediction.saveFrame(11)

    expect(prediction.bufferedFrameCount).toBe(2)
    expect(world.getSnapshot).toHaveBeenCalledTimes(2)
  })

  it('evicts frames older than the configured buffer size', () => {
    const prediction = new ClientPrediction({ world: world as never, bufferSize: 2 })

    prediction.saveFrame(10)
    prediction.saveFrame(11)
    prediction.saveFrame(12)
    prediction.saveFrame(13)

    expect(prediction.bufferedFrameCount).toBe(3)
    expect(prediction.rollbackTo(10)).toBe(false)
    expect(prediction.rollbackTo(11)).toBe(true)
  })

  it('rolls back to a saved snapshot', () => {
    const prediction = new ClientPrediction({ world: world as never })

    prediction.saveFrame(5)

    expect(prediction.rollbackTo(5)).toBe(true)
    expect(world.restoreSnapshot).toHaveBeenCalledWith({ tick: 0 })
  })

  it('returns false when rolling back to a missing snapshot', () => {
    const prediction = new ClientPrediction({ world: world as never })

    expect(prediction.rollbackTo(99)).toBe(false)
    expect(world.restoreSnapshot).not.toHaveBeenCalled()
  })

  it('applies a correction and purges older buffered frames', () => {
    const prediction = new ClientPrediction({ world: world as never })
    const serverSnapshot = { tick: 'server' } as unknown as WorldSnapshot

    prediction.saveFrame(1)
    prediction.saveFrame(2)
    prediction.saveFrame(3)

    prediction.applyCorrection(serverSnapshot, 2)

    expect(world.restoreSnapshot).toHaveBeenCalledWith(serverSnapshot)
    expect(prediction.rollbackTo(1)).toBe(false)
    expect(prediction.rollbackTo(2)).toBe(false)
    expect(prediction.rollbackTo(3)).toBe(true)
  })
})
