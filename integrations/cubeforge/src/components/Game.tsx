import React, { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  ECSWorld,
  GameLoop,
  EventBus,
  AssetManager,
  ScriptSystem,
  type GameLoopMode,
  type Plugin,
  type System,
} from '@cubeforge/core'
import { InputManager } from '@cubeforge/input'
import { RenderSystem, DebugOverlayRenderer, createPostProcessStack, type Sampling } from '@cubeforge/renderer'
import { PhysicsSystem } from '@cubeforge/physics'
import { EngineContext, type EngineState } from '../context'
import { DebugSystem, DevToolsOverlay, MAX_DEVTOOLS_FRAMES, type DevToolsHandle } from '@cubeforge/devtools'

/** Wraps a System to record execution time into a shared timings map. */
function timedSystem(name: string, system: System, timings: Map<string, number>): System {
  return {
    update(world, dt) {
      const t0 = performance.now()
      system.update(world, dt)
      timings.set(name, performance.now() - t0)
    },
  }
}

export interface GameControls {
  pause(): void
  resume(): void
  reset(): void
}

interface GameProps {
  width?: number
  height?: number
  /** Pixels per second squared downward (default 980) */
  gravity?: number
  /** Enable debug overlay: collider wireframes, FPS, entity count */
  debug?: boolean
  /**
   * Canvas scaling strategy (default 'none'):
   * - 'none'    — fixed pixel size, no scaling
   * - 'contain' — CSS scale to fit parent while preserving aspect ratio
   * - 'pixel'   — nearest-neighbor pixel-art scaling via CSS
   */
  scale?: 'none' | 'contain' | 'pixel'
  /** Called once the engine is ready — receives pause/resume/reset controls */
  onReady?: (controls: GameControls) => void
  /** Enable time-travel debugging overlay (frame scrubber + entity inspector). */
  devtools?: boolean
  /** Run the simulation in deterministic mode using a seeded RNG. */
  deterministic?: boolean
  /** Seed for the deterministic RNG (default 0). Only used when deterministic=true. */
  seed?: number
  /**
   * When true, the game loop starts immediately and sprites swap from color → image as
   * they load in the background. When false (default) the loop is held until every
   * sprite that is part of the initial scene has finished loading, so the first frame
   * shown is fully rendered with real assets.
   */
  asyncAssets?: boolean
  /**
   * Default texture sampling for all sprites (default 'nearest').
   * Individual sprites can override via their own `sampling` prop.
   * Use `TextureFilter.NEAREST` for pixel art or `TextureFilter.LINEAR` for smooth scaling.
   */
  sampling?: Sampling
  /** Custom plugins to register after core systems. Each plugin's systems run after Render. */
  plugins?: Plugin[]
  /**
   * Loop mode (default 'realtime'):
   * - 'realtime' — continuous 60fps tick. Use for action games, anything with
   *   continuous motion or physics.
   * - 'onDemand' — sleeps until input arrives or a component calls markDirty().
   *   Use for puzzle games, turn-based games, visual novels, level editors, or any
   *   scene where nothing changes unless the user acts. Saves battery and CPU.
   */
  mode?: GameLoopMode
  style?: CSSProperties
  className?: string
  children?: React.ReactNode
}

export function Game({
  width = 800,
  height = 600,
  gravity = 980,
  debug = false,
  devtools = false,
  scale = 'none',
  deterministic = false,
  seed = 0,
  asyncAssets = false,
  sampling,
  onReady,
  plugins,
  mode = 'realtime',
  style,
  className,
  children,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const debugCanvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [engine, setEngine] = useState<EngineState | null>(null)
  const [assetsReady, setAssetsReady] = useState(asyncAssets)
  const [webglError, setWebglError] = useState<string | null>(null)
  const devtoolsHandle = useRef<DevToolsHandle>({ buffer: [] })

  useEffect(() => {
    const canvas = canvasRef.current!
    const ecs = new ECSWorld()
    if (deterministic) ecs.setDeterministicSeed(seed)
    const input = new InputManager()
    const events = new EventBus()
    const assets = new AssetManager()
    // Apply Vite base URL so assets resolve correctly when deployed to a subdirectory
    const viteEnv = (import.meta as unknown as { env?: { BASE_URL?: string } }).env
    assets.baseURL = (viteEnv?.BASE_URL ?? '/').replace(/\/$/, '')
    ecs.assets = assets
    const physics = new PhysicsSystem(gravity, events)
    const entityIds = new Map<string, number>()

    // Always use the WebGL2 render system
    let renderSystem: RenderSystem
    try {
      renderSystem = new RenderSystem(canvas, entityIds)
    } catch {
      setWebglError(
        'WebGL2 is required to run this game. Please use a modern browser such as Chrome, Firefox, Edge, or Safari 15+.',
      )
      return
    }
    if (sampling) renderSystem.setDefaultSampling(sampling)
    const activeRenderSystem: System = renderSystem

    // Debug system: always uses a separate overlay canvas (Canvas2D for wireframes)
    let debugSystem: DebugSystem | null = null
    if (debug) {
      const debugCanvas2dEl = debugCanvasRef.current
      if (debugCanvas2dEl) {
        const debugCanvas2d = new DebugOverlayRenderer(debugCanvas2dEl)
        debugSystem = new DebugSystem(debugCanvas2d)
      }
    }

    const systemTimings = new Map<string, number>()

    // System order: scripts → physics → render → (debug) → plugins
    ecs.addSystem(timedSystem('ScriptSystem', new ScriptSystem(input), systemTimings))
    ecs.addSystem(timedSystem('PhysicsSystem', physics, systemTimings))
    ecs.addSystem(timedSystem('RenderSystem', renderSystem, systemTimings))
    if (debugSystem) ecs.addSystem(timedSystem('DebugSystem', debugSystem, systemTimings))

    input.attach(canvas)
    canvas.setAttribute('tabindex', '0')

    // Validate dimensions
    if (width <= 0 || height <= 0) {
      console.warn(`[Cubeforge] Invalid Game dimensions: ${width}x${height}. Width and height must be positive.`)
    }

    const loop = new GameLoop(
      (dt) => {
        ecs.update(dt)
        input.flush()
        if (devtools) {
          const handle = devtoolsHandle.current
          handle.buffer.push(ecs.getSnapshot())
          if (handle.buffer.length > MAX_DEVTOOLS_FRAMES) handle.buffer.shift()
          handle.onFrame?.()
        }
      },
      {
        ...(deterministic ? { fixedDt: 1 / 60 } : {}),
        // In onDemand mode, default to a 1/60 step so animations advance predictably.
        ...(mode === 'onDemand' && !deterministic ? { fixedDt: 1 / 60 } : {}),
        mode,
        // During hit-pause, re-render the last frame so the screen isn't blank
        onRender: () => renderSystem.update(ecs, 0),
      },
    )

    // In onDemand mode, wake the loop on input events so the user sees their actions
    // take effect. Without this the scene would be frozen until a component manually
    // called engine.loop.markDirty().
    const dirtyHandler = (): void => loop.markDirty()
    if (mode === 'onDemand') {
      canvas.addEventListener('pointerdown', dirtyHandler)
      canvas.addEventListener('pointerup', dirtyHandler)
      canvas.addEventListener('pointermove', dirtyHandler)
      canvas.addEventListener('wheel', dirtyHandler, { passive: true })
      window.addEventListener('keydown', dirtyHandler)
      window.addEventListener('keyup', dirtyHandler)
      window.addEventListener('resize', dirtyHandler)
    }

    const postProcessStack = createPostProcessStack()

    const state: EngineState = {
      ecs,
      input,
      activeRenderSystem,
      physics,
      events,
      assets,
      loop,
      canvas,
      entityIds,
      systemTimings,
      postProcessStack,
    }
    setEngine(state)

    // Register plugin systems and call their onInit hooks
    if (plugins) {
      // Sort by priority descending (higher priority registered first)
      const pluginNames = new Set(plugins.map((p) => p.name))
      const sorted = [...plugins].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      for (const plugin of sorted) {
        // Validate dependencies
        if (plugin.requires) {
          for (const dep of plugin.requires) {
            if (!pluginNames.has(dep)) {
              console.warn(`[Cubeforge] Plugin "${plugin.name}" requires "${dep}" but it is not registered.`)
            }
          }
        }
        for (const system of plugin.systems) {
          ecs.addSystem(timedSystem(`${plugin.name}`, system, systemTimings))
        }
        plugin.onInit?.(state)
      }
    }

    // Loop is started by the assets-ready effect below once images are loaded.
    // When asyncAssets=true that effect starts it immediately.

    // Expose controls via onReady callback
    onReady?.({
      pause: () => loop.pause(),
      resume: () => loop.resume(),
      reset: () => {
        ecs.clear()
        loop.stop()
        loop.start()
      },
    })

    // Handle contain scaling
    let resizeObserver: ResizeObserver | null = null
    if (scale === 'contain' && wrapperRef.current) {
      const wrapper = wrapperRef.current
      const updateScale = () => {
        const parentW = wrapper.parentElement?.clientWidth ?? width
        const parentH = wrapper.parentElement?.clientHeight ?? height
        const scaleX = parentW / width
        const scaleY = parentH / height
        const s = Math.min(scaleX, scaleY)
        canvas.style.transform = `scale(${s})`
        canvas.style.transformOrigin = 'top left'
        // Apply the same scale to the debug overlay canvas
        const debugEl = debugCanvasRef.current
        if (debugEl) {
          debugEl.style.transform = `scale(${s})`
          debugEl.style.transformOrigin = 'top left'
        }
      }
      updateScale()
      resizeObserver = new ResizeObserver(updateScale)
      if (wrapper.parentElement) resizeObserver.observe(wrapper.parentElement)
    }

    return () => {
      loop.stop()
      input.detach()
      ecs.clear()
      resizeObserver?.disconnect()
      if (mode === 'onDemand') {
        canvas.removeEventListener('pointerdown', dirtyHandler)
        canvas.removeEventListener('pointerup', dirtyHandler)
        canvas.removeEventListener('pointermove', dirtyHandler)
        canvas.removeEventListener('wheel', dirtyHandler)
        window.removeEventListener('keydown', dirtyHandler)
        window.removeEventListener('keyup', dirtyHandler)
        window.removeEventListener('resize', dirtyHandler)
      }
      // Call onDestroy on all plugins
      if (plugins) {
        for (const plugin of plugins) {
          plugin.onDestroy?.(state)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Start loop once initial scene sprites are loaded.
  // Because React runs child effects before parent effects, all Sprite useEffects
  // (which call engine.assets.loadImage) have already fired before this runs —
  // so waitForImages() covers every sprite in the initial scene.
  useEffect(() => {
    if (!engine) return
    let cancelled = false

    if (asyncAssets) {
      engine.loop.start()
      setAssetsReady(true)
      return
    }

    engine.assets.waitForImages().then(() => {
      if (!cancelled) {
        engine.loop.start()
        setAssetsReady(true)
      }
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  // Sync canvas dimensions when width/height props change (HiDPI-aware)
  useEffect(() => {
    if (!engine) return
    const dpr = window.devicePixelRatio || 1
    const physW = Math.round(width * dpr)
    const physH = Math.round(height * dpr)
    const canvas = engine.canvas
    if (canvas.width !== physW) canvas.width = physW
    if (canvas.height !== physH) canvas.height = physH
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }, [width, height, engine])

  // Sync gravity changes
  useEffect(() => {
    engine?.physics.setGravity(gravity)
  }, [gravity, engine])

  const canvasStyle: CSSProperties = {
    display: 'block',
    outline: 'none',
    imageRendering: scale === 'pixel' ? 'pixelated' : undefined,
    ...style,
  }

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    ...(scale === 'contain' ? { width, height, overflow: 'visible' } : {}),
  }

  if (webglError) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          color: '#ef5350',
          fontFamily: 'monospace',
          fontSize: 13,
          padding: 24,
          boxSizing: 'border-box',
          textAlign: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 24 }}>⚠</span>
        <strong>WebGL2 Not Available</strong>
        <span style={{ color: '#78909c', fontSize: 11, maxWidth: 380 }}>{webglError}</span>
      </div>
    )
  }

  return (
    <EngineContext.Provider value={engine}>
      <div ref={wrapperRef} style={wrapperStyle}>
        <canvas ref={canvasRef} width={width} height={height} style={canvasStyle} className={className} />
        {debug && (
          <canvas
            ref={debugCanvasRef}
            width={width}
            height={height}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          />
        )}
        {!assetsReady && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0a0a0f',
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#4fc3f7',
                    animation: 'cubeforge-loading-dot 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                letterSpacing: 3,
                color: '#37474f',
              }}
            >
              LOADING
            </span>
            <style>{`
              @keyframes cubeforge-loading-dot {
                0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
                40%           { transform: scale(1);   opacity: 1;   }
              }
            `}</style>
          </div>
        )}
      </div>
      {engine && children}
      {engine && devtools && (
        <DevToolsOverlay handle={devtoolsHandle.current} loop={engine.loop} ecs={engine.ecs} engine={engine} />
      )}
    </EngineContext.Provider>
  )
}
