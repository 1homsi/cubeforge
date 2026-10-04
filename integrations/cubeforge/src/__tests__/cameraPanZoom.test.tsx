import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { ECSWorld } from '@cubeforge/core'
import { createCamera2D, type Camera2DComponent } from '@cubeforge/renderer'
import { EngineContext, type EngineState } from '../context'
import { useCameraPanZoom, type CameraPanZoomOptions } from '../hooks/useCameraPanZoom'

function setup(options: CameraPanZoomOptions = {}) {
  const ecs = new ECSWorld()
  const id = ecs.createEntity()
  ecs.addComponent(id, createCamera2D({ x: 0, y: 0, zoom: 1 }))
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  const engine = { ecs, canvas, loop: { markDirty: vi.fn() } } as unknown as EngineState
  function Probe() {
    useCameraPanZoom(options)
    return null
  }
  const view = render(
    <EngineContext.Provider value={engine}>
      <Probe />
    </EngineContext.Provider>,
  )
  const cam = ecs.getComponent<Camera2DComponent>(id, 'Camera2D')!
  const ptr = (type: string, x: number, y: number, pointerId = 1) =>
    act(() => {
      canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId, button: 0, bubbles: true }))
    })
  const wheel = (deltaY: number, x: number, y: number) =>
    act(() => {
      const e = new WheelEvent('wheel', { deltaY, cancelable: true })
      Object.defineProperty(e, 'clientX', { value: x })
      Object.defineProperty(e, 'clientY', { value: y })
      canvas.dispatchEvent(e)
    })
  return { cam, canvas, ptr, view, wheel }
}

describe('useCameraPanZoom', () => {
  it('drag pans the camera opposite to the pointer, scaled by zoom', () => {
    const { cam, ptr } = setup({ inertia: false })
    cam.zoom = 2
    ptr('pointerdown', 100, 100)
    ptr('pointermove', 140, 120)
    ptr('pointerup', 140, 120)
    expect(cam.x).toBeCloseTo(-20)
    expect(cam.y).toBeCloseTo(-10)
  })

  it('a press without movement is a tap with world coordinates, not a pan', () => {
    const onTap = vi.fn()
    const { cam, ptr } = setup({ onTap })
    cam.x = 50
    ptr('pointerdown', 500, 300)
    ptr('pointermove', 502, 301)
    ptr('pointerup', 502, 301)
    expect(cam.x).toBe(50)
    expect(onTap).toHaveBeenCalledWith(expect.objectContaining({ worldX: 50 + 102, worldY: 1 }))
  })

  it('wheel zooms around the cursor and respects limits', () => {
    const { cam, wheel } = setup({ maxZoom: 3 })
    const worldUnder = (sx: number, sy: number) => [cam.x + (sx - 400) / cam.zoom, cam.y + (sy - 300) / cam.zoom]
    const before = worldUnder(600, 100)
    wheel(-300, 600, 100)
    expect(cam.zoom).toBeGreaterThan(1)
    const after = worldUnder(600, 100)
    expect(after[0]).toBeCloseTo(before[0], 6)
    expect(after[1]).toBeCloseTo(before[1], 6)
    for (let i = 0; i < 20; i++) wheel(-300, 600, 100)
    expect(cam.zoom).toBe(3)
  })

  it('pinch zooms by the finger distance ratio', () => {
    const { cam, ptr } = setup()
    ptr('pointerdown', 300, 300, 1)
    ptr('pointerdown', 500, 300, 2)
    ptr('pointermove', 600, 300, 2)
    expect(cam.zoom).toBeCloseTo(1.5)
    ptr('pointerup', 600, 300, 2)
    ptr('pointerup', 300, 300, 1)
  })

  it('cleans up listeners on unmount', () => {
    const { cam, ptr, view } = setup({ inertia: false })
    view.unmount()
    ptr('pointerdown', 100, 100)
    ptr('pointermove', 200, 100)
    expect(cam.x).toBe(0)
  })
})
