import React, { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ECSWorld, GameLoop, EventBus, AssetManager, ScriptSystem, type Plugin, type System, type EntityId } from '@cubeforge/core'
import { InputManager } from '@cubeforge/input'
import { Canvas2DRenderer, RenderSystem } from '@cubeforge/renderer'
import { PhysicsSystem } from '@cubeforge/physics'
import { EngineContext, type EngineState } from '../context'
import { DebugSystem, DevToolsOverlay, MAX_DEVTOOLS_FRAMES, type DevToolsHandle } from '@cubeforge/devtools'
import { WebGLRenderSystem } from '@cubeforge/webgl-renderer'

/** Wraps a System to record execution time into a shared timings map. */
function timedSystem(
  name: string,
  system: System,
  timings: Map<string, number>,
): System {
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
  /** Custom plugins to register after core systems. Each plugin's systems run after Render. */
  plugins?: Plugin[]
  /**
   * Renderer to use (default: WebGL2).
   * - omit or undefined — WebGL2 instanced renderer (default)
   * - 'canvas2d' — Canvas2D renderer (opt-in for compatibility or pixel art)
   * - CustomClass — any class implementing System with (canvas, entityIds) constructor
   */
  renderer?: 'canvas2d' | (new (canvas: HTMLCanvasElement, entityIds: Map<string, EntityId>) => System)
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
  onReady,
  plugins,
  renderer: CustomRenderer,
  style,
  className,
  children,
}: GameProps) {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const debugCanvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef     = useRef<HTMLDivElement>(null)
  const [engine, setEngine] = useState<EngineState | null>(null)
  const [assetsReady, setAssetsReady] = useState(asyncAssets)
  const devtoolsHandle = useRef<DevToolsHandle>({ buffer: [] })

  useEffect(() => {
    const canvas = canvasRef.current!
    const ecs = new ECSWorld()
    if (deterministic) ecs.setDeterministicSeed(seed)
    const input = new InputManager()
    const events = new EventBus()
    const assets = new AssetManager()
    const physics = new PhysicsSystem(gravity, events)
    const entityIds = new Map<string, number>()

    // Build render system: 'canvas2d' string → Canvas2D, custom class → use it, default → WebGL2
    let canvas2d: Canvas2DRenderer | undefined
    let builtinRenderSystem: RenderSystem | undefined
    let renderSystem: System
    let activeRenderSystem: System

    if (CustomRenderer === 'canvas2d') {
      canvas2d = new Canvas2DRenderer(canvas)
      builtinRenderSystem = new RenderSystem(canvas2d, entityIds)
      renderSystem = builtinRenderSystem
    } else if (CustomRenderer) {
      // Custom renderer class passed explicitly
      renderSystem = new (CustomRenderer as new (canvas: HTMLCanvasElement, entityIds: Map<string, EntityId>) => System)(canvas, entityIds)
    } else {
      // Default: WebGL2 with Canvas2D fallback
      try {
        renderSystem = new WebGLRenderSystem(canvas, entityIds)
      } catch (e) {
        console.warn('[Cubeforge] WebGL2 unavailable, falling back to Canvas2D:', e)
        canvas2d = new Canvas2DRenderer(canvas)
        builtinRenderSystem = new RenderSystem(canvas2d, entityIds)
        renderSystem = builtinRenderSystem
      }
    }
    activeRenderSystem = renderSystem

    // Debug system: always uses a separate overlay canvas (or falls back to the main canvas2d renderer)
    let debugSystem: DebugSystem | null = null
    if (debug) {
      const debugCanvas2dEl = debugCanvasRef.current
      if (debugCanvas2dEl) {
        const debugCanvas2d = new Canvas2DRenderer(debugCanvas2dEl)
        debugSystem = new DebugSystem(debugCanvas2d)
      } else if (canvas2d) {
        // Fallback for pure Canvas2D mode where we don't have a separate overlay canvas
        debugSystem = new DebugSystem(canvas2d)
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

    const loop = new GameLoop((dt) => {
      ecs.update(dt)
      input.flush()
      if (devtools) {
        const handle = devtoolsHandle.current
        handle.buffer.push(ecs.getSnapshot())
        if (handle.buffer.length > MAX_DEVTOOLS_FRAMES) handle.buffer.shift()
        handle.onFrame?.()
      }
    })

    const state: EngineState = {
      ecs,
      input,
      renderer: canvas2d,
      renderSystem: builtinRenderSystem,
      activeRenderSystem,
      physics,
      events,
      assets,
      loop,
      canvas,
      entityIds,
      systemTimings,
    }
    setEngine(state)

    // Register plugin systems and call their onInit hooks
    if (plugins) {
      // Sort by priority descending (higher priority registered first)
      const pluginNames = new Set(plugins.map(p => p.name))
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
      pause:  () => loop.pause(),
      resume: () => loop.resume(),
      reset:  () => {
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
        const parentW = wrapper.parentElement?.clientWidth  ?? width
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

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

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

  return (
    <EngineContext.Provider value={engine}>
      <div ref={wrapperRef} style={wrapperStyle}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={canvasStyle}
          className={className}
        />
        {debug && (
          <canvas
            ref={debugCanvasRef}
            width={width}
            height={height}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          />
        )}
        {!assetsReady && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#0a0a0f',
            pointerEvents: 'none',
          }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#4fc3f7',
                  animation: 'cubeforge-loading-dot 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
            <span style={{
              fontFamily: 'monospace', fontSize: 11,
              letterSpacing: 3, color: '#37474f',
            }}>
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
        <DevToolsOverlay
          handle={devtoolsHandle.current}
          loop={engine.loop}
          ecs={engine.ecs}
          engine={engine}
        />
      )}
    </EngineContext.Provider>
  )
}
