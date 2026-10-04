import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ECSWorld } from '@cubeforge/core'
import type { TileLayerComponent, TileLayerData } from '@cubeforge/renderer'
import { EngineContext, type EngineState } from '../context'
import { TileLayer, useTileLayer } from '../components/TileLayer'

afterEach(cleanup)

describe('<TileLayer> / useTileLayer', () => {
  it('mounts one entity, mutates without re-rendering, and cleans up on unmount', () => {
    const ecs = new ECSWorld()
    const markDirty = vi.fn()
    const image = { width: 32, height: 32 } as unknown as HTMLCanvasElement
    const engine = {
      ecs,
      loop: { markDirty },
      assets: { loadImage: vi.fn() },
      events: { emit: vi.fn() },
    } as unknown as EngineState
    let layer: TileLayerData | undefined
    let renders = 0
    const tileset = { image, tileWidth: 16, tileHeight: 16, columns: 2 }
    function WorldMap() {
      renders++
      layer = useTileLayer({ width: 600, height: 300, tileset })
      return <TileLayer layer={layer} zIndex={-1} />
    }
    const view = render(
      <EngineContext.Provider value={engine}>
        <WorldMap />
      </EngineContext.Provider>,
    )
    const ids = ecs.query('TileLayer')
    expect(ids).toHaveLength(1)
    expect(ecs.getComponent<TileLayerComponent>(ids[0], 'TileLayer')!.layer).toBe(layer)
    expect(layer!.zIndex).toBe(-1)
    const rendersBefore = renders
    markDirty.mockClear()
    for (let i = 0; i < 100; i++) layer!.setTile(i, 0, 1)
    expect(renders).toBe(rendersBefore)
    expect(markDirty).toHaveBeenCalledTimes(100)
    expect(engine.assets.loadImage).not.toHaveBeenCalled()
    view.unmount()
    expect(ecs.query('TileLayer')).toHaveLength(0)
    expect(layer!.onChange).toBeNull()
  })
})
