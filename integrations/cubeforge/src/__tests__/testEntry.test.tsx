// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { useContext } from 'react'
import { render } from '@testing-library/react'
import { World, Entity, Transform, Sprite, Camera2D, Script } from 'cubeforge'
import {
  mountGame,
  cleanup,
  createTestEngine,
  EngineContext,
  RecordingGL,
  createRecordingCanvas,
  decodeInstances,
  installHeadlessCanvasDOM,
} from 'cubeforge/test'
import * as mainEntry from 'cubeforge'
import * as renderEntry from 'cubeforge/render'

afterEach(cleanup)

const scene = (n = 2) => (
  <World>
    <Camera2D x={0} y={0} />
    {Array.from({ length: n }, (_, i) => (
      <Entity key={i} id={`box${i}`}>
        <Transform x={i * 20} y={5} />
        <Sprite width={8} height={8} color="#ff0000" />
      </Entity>
    ))}
  </World>
)

describe('cubeforge/test', () => {
  it('re-exports the recording utilities and the engine context', () => {
    expect(typeof RecordingGL).toBe('function')
    expect(typeof createRecordingCanvas).toBe('function')
    expect(typeof decodeInstances).toBe('function')
    expect(typeof installHeadlessCanvasDOM).toBe('function')
    expect(EngineContext).toBe(mainEntry.EngineContext)
    expect(renderEntry.EngineContext).toBe(mainEntry.EngineContext)
  })

  it('mounts <Game> with a recording WebGL2 context and counts draw calls per frame', async () => {
    const game = await mountGame(scene(3), { width: 320, height: 200 })
    expect(game.canvas.width).toBe(320)
    expect(game.gl).toBeInstanceOf(RecordingGL)
    expect(game.engine.canvas).toBe(game.canvas)
    game.frame()
    expect(game.drawCalls).toBe(1)
    expect(game.instances).toBe(3)
    expect(game.renderStats.instances).toBe(3)
    const inst = game.frameInstances()
    expect(inst.map((i) => [i.x, i.y])).toEqual([
      [0, 5],
      [20, 5],
      [40, 5],
    ])
    expect(inst[0]).toMatchObject({ width: 8, height: 8, r: 1, g: 0, b: 0 })
  })

  it('steps the real game loop deterministically on a virtual clock', async () => {
    const dts: number[] = []
    const game = await mountGame(
      <World>
        <Entity id="s">
          <Script update={(_id: number, _w: unknown, _i: unknown, dt: number) => void dts.push(dt)} />
        </Entity>
      </World>,
    )
    expect(dts).toEqual([])
    game.frame()
    game.frame(2, 0.05)
    expect(dts.map((d) => Math.round(d * 1000))).toEqual([17, 50, 50])
    expect(game.engine.stats!.frame).toBe(3)
  })

  it('rerenders children and tracks textures, and a fresh frame resets the draw list', async () => {
    const game = await mountGame(scene(1))
    game.frame()
    expect(game.instances).toBe(1)
    game.rerender(scene(4))
    game.frame()
    expect(game.instances).toBe(4)
    expect(game.draws.every((d) => d.kind === 'instanced')).toBe(true)
    expect(game.liveTextures).toBeGreaterThan(0)
  })

  it('forwards <Game> props', async () => {
    const game = await mountGame(scene(1), { game: { mode: 'onDemand', deterministic: true, seed: 7 } })
    game.frame()
    expect(game.drawCalls).toBe(1)
  })

  it('removes its patches after the last unmount and unmount is idempotent', async () => {
    const raf = globalThis.requestAnimationFrame
    const now = performance.now
    const a = await mountGame(scene(1))
    const b = await mountGame(scene(1))
    expect(globalThis.requestAnimationFrame).not.toBe(raf)
    a.unmount()
    expect(globalThis.requestAnimationFrame).not.toBe(raf)
    b.frame()
    b.unmount()
    b.unmount()
    expect(globalThis.requestAnimationFrame).toBe(raf)
    expect(performance.now).toBe(now)
    expect(() => b.frame()).toThrow(/after unmount/)
    expect(document.body.querySelector('canvas')).toBeNull()
  })

  it('cleanup() unmounts every game', async () => {
    const raf = globalThis.requestAnimationFrame
    await mountGame(scene(1))
    await mountGame(scene(1))
    cleanup()
    expect(globalThis.requestAnimationFrame).toBe(raf)
  })

  it('createTestEngine gives hooks a real engine without mounting <Game>', () => {
    const engine = createTestEngine()
    let seen: unknown
    function Probe() {
      seen = useContext(EngineContext)
      return null
    }
    render(
      <EngineContext.Provider value={engine}>
        <Probe />
      </EngineContext.Provider>,
    )
    expect(seen).toBe(engine)
    expect(engine.ecs.createEntity()).toBeTypeOf('number')
    expect(engine.getStats!()).toBe(engine.stats)
    expect(createTestEngine({ gravity: 5 }).gravity).toBe(5)
  })
})
