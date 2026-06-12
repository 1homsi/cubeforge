import React, { useEffect, useRef, useState, type CSSProperties } from 'react'
import { GameLoop } from '@cubeforge/core'
import { WebGLRenderer3D, Scene, PerspectiveCamera, Vec3 } from '@cubeforge/renderer3d'
import { Engine3DContext, ParentObject3DContext, type Engine3DState } from '../context3d'

export interface Game3DProps {
  width?: number
  height?: number
  /** Vertical FOV in degrees (default 60) */
  fov?: number
  /** Near clip plane (default 0.1) */
  near?: number
  /** Far clip plane (default 2000) */
  far?: number
  /** Clear color RGB (default [0.1, 0.1, 0.1]) */
  background?: [r: number, g: number, b: number]
  /** Enable shadow maps (default false) */
  shadows?: boolean
  /** Enable bloom + tone mapping post-process (default false) */
  postProcess?: boolean
  /** Device pixel ratio (default window.devicePixelRatio) */
  pixelRatio?: number
  /** Canvas scaling strategy (default 'none') */
  scale?: 'none' | 'contain'
  /** Called once the engine is ready */
  onReady?: (state: Engine3DState) => void
  style?: CSSProperties
  className?: string
  children?: React.ReactNode
}

export function Game3D({
  width = 800,
  height = 600,
  fov = 60,
  near = 0.1,
  far = 2000,
  background = [0.1, 0.1, 0.1],
  shadows = false,
  postProcess = false,
  pixelRatio,
  scale = 'none',
  onReady,
  style,
  className,
  children,
}: Game3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [engine, setEngine] = useState<Engine3DState | null>(null)
  const [webglError, setWebglError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current!

    let renderer: WebGLRenderer3D
    try {
      renderer = new WebGLRenderer3D({
        canvas,
        antialias: true,
        shadowMap: shadows,
        postProcess,
        pixelRatio: pixelRatio ?? window.devicePixelRatio,
      })
    } catch (err) {
      console.error('[Game3D] WebGLRenderer3D init failed:', err)
      setWebglError(
        err instanceof Error
          ? err.message
          : 'WebGL2 is required to run this scene. Please use a modern browser such as Chrome, Firefox, Edge, or Safari 15+.',
      )
      return
    }

    renderer.shadowMap.enabled = shadows

    const scene = new Scene()
    scene.background = new Vec3(background[0], background[1], background[2])

    const aspect = width / height
    const camera = new PerspectiveCamera(fov, aspect, near, far)
    camera.position.set(0, 5, 10)
    camera.lookAt(new Vec3(0, 0, 0))

    const frameListeners = new Set<(dt: number) => void>()

    const state: Engine3DState = {
      renderer,
      scene,
      camera,
      loop: null as unknown as GameLoop, // set below
      canvas,
      time: 0,
      _frameListeners: frameListeners,
    }

    const loop = new GameLoop((dt) => {
      state.time += dt
      for (const fn of frameListeners) {
        fn(dt)
      }
      renderer.render(scene, state.camera)
    })

    state.loop = loop
    setEngine(state)
    loop.start()
    onReady?.(state)

    // Contain scaling
    let resizeObserver: ResizeObserver | null = null
    if (scale === 'contain' && wrapperRef.current) {
      const wrapper = wrapperRef.current
      const updateScale = () => {
        const parentW = wrapper.parentElement?.clientWidth ?? width
        const parentH = wrapper.parentElement?.clientHeight ?? height
        const s = Math.min(parentW / width, parentH / height)
        canvas.style.transform = `scale(${s})`
        canvas.style.transformOrigin = 'top left'
      }
      updateScale()
      resizeObserver = new ResizeObserver(updateScale)
      if (wrapper.parentElement) resizeObserver.observe(wrapper.parentElement)
    }

    return () => {
      loop.stop()
      resizeObserver?.disconnect()
      renderer.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync renderer size when width/height props change
  useEffect(() => {
    if (!engine) return
    engine.renderer.setSize(width, height)
    engine.camera.aspect = width / height
    engine.camera.updateProjectionMatrix()
  }, [width, height, engine])

  const canvasStyle: CSSProperties = {
    display: 'block',
    outline: 'none',
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
        <span style={{ fontSize: 24 }}>&#9888;</span>
        <strong>WebGL2 Not Available</strong>
        <span style={{ color: '#78909c', fontSize: 11, maxWidth: 380 }}>{webglError}</span>
      </div>
    )
  }

  return (
    <Engine3DContext.Provider value={engine}>
      <div ref={wrapperRef} style={wrapperStyle}>
        <canvas ref={canvasRef} width={width} height={height} style={canvasStyle} className={className} />
      </div>
      {engine && <ParentObject3DContext.Provider value={engine.scene}>{children}</ParentObject3DContext.Provider>}
    </Engine3DContext.Provider>
  )
}
