import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { createEngineStats, createRenderStats } from '@cubeforge/core'
import { EngineContext, type EngineState } from '../context'
import { StatsOverlay } from '../components/StatsOverlay'

describe('StatsOverlay', () => {
  it('shows live engine stats', () => {
    vi.useFakeTimers()
    const stats = createEngineStats(createRenderStats())
    stats.entityCount = 3001
    stats.render.drawCalls = 2
    stats.render.textureCacheHits = 3
    stats.render.textureCacheMisses = 1
    const engine = { getStats: () => stats } as unknown as EngineState
    const { container } = render(
      <EngineContext.Provider value={engine}>
        <StatsOverlay interval={100} />
      </EngineContext.Provider>,
    )
    act(() => vi.advanceTimersByTime(150))
    const text = container.textContent ?? ''
    expect(text).toContain('3001')
    expect(text).toContain('75%')
    vi.useRealTimers()
  })

  it('shows GPU time, tile layer counters and a per-layer breakdown', () => {
    vi.useFakeTimers()
    const stats = createEngineStats(createRenderStats())
    stats.render.gpuTimerSupported = true
    stats.gpuMs = 1.5
    stats.gpuMsAvg = 1.25
    stats.render.tile.textureCount = 3
    stats.render.tile.textureBytes = 40960
    stats.render.tile.drawCalls = 2
    stats.render.layers.push(
      { kind: 'tile', name: 'ground', zIndex: -1, instances: 1200, drawCalls: 2, uploadBytes: 40960 },
      { kind: 'sprite', name: 'crowd', zIndex: 4, instances: 300, drawCalls: 1, uploadBytes: 24000 },
    )
    const engine = { getStats: () => stats } as unknown as EngineState
    const { container } = render(
      <EngineContext.Provider value={engine}>
        <StatsOverlay interval={100} />
      </EngineContext.Provider>,
    )
    act(() => vi.advanceTimersByTime(150))
    const text = container.textContent ?? ''
    expect(text).toContain('1.50 (avg 1.25)')
    expect(text).toContain('tile tex')
    expect(text).toContain('T ground')
    expect(text).toContain('z-1 1.2K i 2 d 41.0KB')
    expect(text).toContain('S crowd')
    vi.useRealTimers()
  })

  it('reads n/a where GPU timing is unsupported', () => {
    vi.useFakeTimers()
    const stats = createEngineStats(createRenderStats())
    stats.render.gpuTimerSupported = false
    const engine = { getStats: () => stats } as unknown as EngineState
    const { container } = render(
      <EngineContext.Provider value={engine}>
        <StatsOverlay interval={100} />
      </EngineContext.Provider>,
    )
    act(() => vi.advanceTimersByTime(150))
    expect(container.textContent).toMatch(/gpu ms\s+n\/a/)
    expect(container.textContent).not.toContain('tile tex')
    vi.useRealTimers()
  })

  it('requests GPU timing while mounted and releases it on unmount', () => {
    const release = vi.fn()
    const request = vi.fn(() => release)
    const engine = {
      getStats: () => createEngineStats(createRenderStats()),
      requestGpuTiming: request,
    } as unknown as EngineState
    const { unmount } = render(
      <EngineContext.Provider value={engine}>
        <StatsOverlay />
      </EngineContext.Provider>,
    )
    expect(request).toHaveBeenCalledTimes(1)
    expect(release).not.toHaveBeenCalled()
    unmount()
    expect(release).toHaveBeenCalledTimes(1)
  })
})
