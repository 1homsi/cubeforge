import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { GameLoop, ECSWorld, EventBus, AssetManager, createEngineStats } from '@xip/core'
import { InputManager } from '@xip/input'
import {
  RecordingGL,
  createRecordingCanvas,
  createPostProcessStack,
  installHeadlessCanvasDOM,
  type RecordedDraw,
  type RecordedInstance,
} from '@xip/renderer'
import type { RenderStats } from '@xip/core'
import { Game } from '../components/FullGame'
import type { GameProps } from '../components/Game'
import { EngineContext, type EngineState } from '../context'

// ── shared virtual clock and canvas stand-ins ────────────────────────────────
// Frames are driven by hand: requestAnimationFrame callbacks queue up and run
// when `frame()` is called, with performance.now() on a virtual clock. All
// mounted games share it; the patches are removed with the last unmount.

interface Shared {
  users: number
  now: number
  nextId: number
  queue: Map<number, FrameRequestCallback>
  uninstallDOM: () => void
  restore: () => void
  gls: WeakMap<object, RecordingGL>
}
let shared: Shared | null = null

type Patchable = {
  requestAnimationFrame?: unknown
  cancelAnimationFrame?: unknown
  performance?: { now: () => number }
}

function acquire(): Shared {
  if (shared) {
    shared.users++
    return shared
  }
  if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') {
    throw new Error('xipjs/test: mountGame needs a DOM; run under happy-dom or jsdom (vitest environment).')
  }
  const gls = new WeakMap<object, RecordingGL>()
  const s: Shared = {
    users: 1,
    now: 0,
    nextId: 1,
    queue: new Map(),
    gls,
    uninstallDOM: installHeadlessCanvasDOM({
      force: true,
      recording: { captureInstances: true },
      onContext: (canvas, gl) => gls.set(canvas, gl),
    }),
    restore: () => {},
  }
  const g = globalThis as Patchable
  const prev = { raf: g.requestAnimationFrame, caf: g.cancelAnimationFrame }
  const perf = g.performance
  const prevNow = perf ? Object.getOwnPropertyDescriptor(perf, 'now') : undefined
  g.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    const id = s.nextId++
    s.queue.set(id, cb)
    return id
  }
  g.cancelAnimationFrame = (id: number): void => {
    s.queue.delete(id)
  }
  if (perf) perf.now = () => s.now
  s.restore = () => {
    g.requestAnimationFrame = prev.raf
    g.cancelAnimationFrame = prev.caf
    if (perf) {
      if (prevNow) Object.defineProperty(perf, 'now', prevNow)
      else delete (perf as { now?: unknown }).now
    }
  }
  shared = s
  return s
}

function release(): void {
  if (!shared || --shared.users > 0) return
  shared.restore()
  shared.uninstallDOM()
  shared = null
}

function act(fn: () => void | Promise<void>): void | Promise<void> {
  const a = (React as unknown as { act?: (cb: () => void | Promise<void>) => void | Promise<void> }).act
  if (!a) throw new Error('xipjs/test: needs React 18.3 or newer (React.act).')
  return a(fn)
}

// ── mountGame ─────────────────────────────────────────────────────────────────

export interface MountGameOptions {
  /** Canvas size in CSS pixels. Default 800 x 600. */
  width?: number
  height?: number
  /** Further `<Game>` props (`mode`, `deterministic`, `sampling`, `plugins`, ...). */
  game?: Omit<GameProps, 'width' | 'height' | 'children'>
}

export interface MountedGame {
  /** The engine `<Game>` created: ecs, events, input, loop, assets, stats. */
  engine: EngineState
  /** The game's canvas element. */
  canvas: HTMLCanvasElement
  /** The recording WebGL2 context behind it. */
  gl: RecordingGL
  /**
   * Run `count` frames of `dt` seconds (default one frame at 1/60), the way the
   * game loop would: scripts, physics, render. Synchronous, wrapped in `act()`.
   */
  frame(count?: number, dt?: number): void
  /** Draw calls of the last rendered frame. */
  readonly drawCalls: number
  /** Instances drawn by the last rendered frame, over all its instanced draws. */
  readonly instances: number
  /** Raw draws of the last rendered frame (texture, instance data). */
  readonly draws: readonly RecordedDraw[]
  /** Decoded per-instance data of the last frame (position, size, color, uv). */
  frameInstances(): RecordedInstance[]
  /** The renderer's own counters for the last frame (batches, culled sprites, text cache). */
  readonly renderStats: RenderStats
  /** WebGL textures created and not yet deleted. */
  readonly liveTextures: number
  /** Replace the children inside `<Game>`. */
  rerender(children: React.ReactNode): void
  /** Unmount and release the shared clock when this was the last game. Idempotent. */
  unmount(): void
}

const mounted = new Set<MountedGame>()

/** Unmount every game still mounted. Call it from `afterEach`. */
export function cleanup(): void {
  for (const m of [...mounted]) m.unmount()
}

function Probe({ onEngine }: { onEngine: (e: EngineState) => void }): null {
  const engine = React.useContext(EngineContext)
  if (engine) onEngine(engine)
  return null
}

/**
 * Mounts `<Game>` (the public one from `xipjs`) headlessly: no GPU, a
 * recording WebGL2 context, and a virtual clock so frames only run when you
 * call `frame()`. Needs a DOM (vitest `environment: 'happy-dom'` or `'jsdom'`).
 *
 * ```tsx
 * const game = await mountGame(
 *   <World>
 *     <Camera2D x={0} y={0} />
 *     <Entity id="a"><Transform x={10} y={20} /><Sprite width={8} height={8} color="#f00" /></Entity>
 *   </World>,
 * )
 * game.frame()
 * expect(game.drawCalls).toBe(1)
 * game.unmount()
 * ```
 */
export async function mountGame(children: React.ReactNode, opts: MountGameOptions = {}): Promise<MountedGame> {
  const s = acquire()
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  let engine: EngineState | null = null
  const onEngine = (e: EngineState): void => {
    engine = e
  }
  const tree = (kids: React.ReactNode) => (
    <Game asyncAssets {...opts.game} width={opts.width ?? 800} height={opts.height ?? 600}>
      <Probe onEngine={onEngine} />
      {kids}
    </Game>
  )
  let done = false
  const unmount = (): void => {
    if (done) return
    done = true
    mounted.delete(game)
    act(() => root.unmount())
    container.remove()
    release()
  }
  try {
    await act(async () => {
      root.render(tree(children))
    })
    const eng = engine as EngineState | null
    const gl = eng ? s.gls.get(eng.canvas) : undefined
    if (!eng || !gl) throw new Error('xipjs/test: <Game> did not start (no engine or no WebGL2 context).')
  } catch (e) {
    unmount()
    throw e
  }
  const eng = engine as unknown as EngineState
  const gl = s.gls.get(eng.canvas)!

  const game: MountedGame = {
    engine: eng,
    canvas: eng.canvas,
    gl,
    frame(count = 1, dt = 1 / 60) {
      if (done) throw new Error('xipjs/test: frame() after unmount()')
      for (let i = 0; i < count; i++) {
        act(() => {
          s.now += dt * 1000
          const cbs = [...s.queue.values()]
          s.queue.clear()
          for (const cb of cbs) cb(s.now)
        })
      }
    },
    get drawCalls() {
      return gl.draws.length
    },
    get instances() {
      let n = 0
      for (const d of gl.draws) if (d.kind === 'instanced') n += d.count
      return n
    },
    get draws() {
      return gl.draws
    },
    frameInstances: () => gl.frameInstances(),
    get renderStats() {
      return eng.stats!.render
    },
    get liveTextures() {
      let n = 0
      for (const t of gl.textures.values()) if (!t.deleted) n++
      return n
    },
    rerender(kids) {
      act(() => root.render(tree(kids)))
    },
    unmount,
  }
  mounted.add(game)
  return game
}

// ── createTestEngine ──────────────────────────────────────────────────────────

/**
 * A real but unstarted engine state (ECS world, events, assets, input, a loop
 * that is never started, a recording canvas) for testing hooks and components
 * without mounting `<Game>`. Provide it with `EngineContext.Provider`.
 * `overrides` replace any field, e.g. `{ loop: myFakeLoop }`.
 */
export function createTestEngine(overrides: Partial<EngineState> = {}): EngineState {
  const stats = createEngineStats()
  const canvas = createRecordingCanvas(800, 600) as unknown as HTMLCanvasElement
  return {
    ecs: new ECSWorld(),
    input: new InputManager(),
    events: new EventBus(),
    assets: new AssetManager(),
    loop: new GameLoop(() => {}),
    canvas,
    entityIds: new Map(),
    systemTimings: new Map(),
    postProcessStack: createPostProcessStack(),
    stats,
    getStats: () => stats,
    ...overrides,
  }
}
