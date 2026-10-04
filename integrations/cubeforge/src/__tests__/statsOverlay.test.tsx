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
})
