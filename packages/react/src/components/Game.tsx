import React, { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ECSWorld, GameLoop, EventBus, AssetManager, ScriptSystem } from '@cubeforge/core'
import { InputManager } from '@cubeforge/input'
import { Canvas2DRenderer, RenderSystem } from '@cubeforge/renderer'
import { PhysicsSystem } from '@cubeforge/physics'
import { EngineContext, type EngineState } from '../context'

interface GameProps {
  width?: number
  height?: number
  /** Pixels per second squared downward (default 980 ≈ earth gravity at 100px/m) */
  gravity?: number
  style?: CSSProperties
  className?: string
  children?: React.ReactNode
}

export function Game({
  width = 800,
  height = 600,
  gravity = 980,
  style,
  className,
  children,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [engine, setEngine] = useState<EngineState | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ecs = new ECSWorld()
    const input = new InputManager()
    const renderer = new Canvas2DRenderer(canvas)
    const events = new EventBus()
    const assets = new AssetManager()
    const physics = new PhysicsSystem(gravity, events)
    const entityIds = new Map<string, number>()

    // System order: scripts first, then physics, then render
    ecs.addSystem(new ScriptSystem(input))
    ecs.addSystem(physics)
    ecs.addSystem(new RenderSystem(renderer, entityIds))

    input.attach(canvas)
    // Prevent canvas from stealing focus issues
    canvas.setAttribute('tabindex', '0')

    const loop = new GameLoop((dt) => {
      ecs.update(dt)
      input.flush()
    })

    const state: EngineState = { ecs, input, renderer, physics, events, assets, loop, canvas, entityIds }
    setEngine(state)
    loop.start()

    return () => {
      loop.stop()
      input.detach()
      ecs.clear()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update gravity when prop changes
  useEffect(() => {
    engine?.physics.setGravity(gravity)
  }, [gravity, engine])

  return (
    <EngineContext.Provider value={engine}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: 'block', outline: 'none', ...style }}
        className={className}
      />
      {engine && children}
    </EngineContext.Provider>
  )
}
