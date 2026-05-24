import { useContext, useEffect, useRef } from 'react'
import { WeatherSystem, type WeatherType } from '@cubeforge/renderer3d'
import { Engine3DContext } from '../context3d'

export interface Weather3DProps {
  type: WeatherType
  particleCount?: number
  windX?: number
  windZ?: number
  transitionTime?: number
}

export function Weather3D({ type, particleCount = 2000, windX = 0, windZ = 0, transitionTime = 0 }: Weather3DProps) {
  const engine = useContext(Engine3DContext)
  const weatherRef = useRef<WeatherSystem | null>(null)

  if (process.env.NODE_ENV !== 'production') {
    if (!engine) {
      console.warn('[CubeForge3D] <Weather3D> must be inside a <Game3D>.')
    }
  }

  useEffect(() => {
    if (!engine) return

    const weather = new WeatherSystem(engine.scene, {
      particleCount,
      windX,
      windZ,
    })
    weather.setWeather(type, transitionTime)
    weatherRef.current = weather

    const frameListener = (dt: number) => {
      weather.update(engine.camera, dt)
    }
    engine._frameListeners.add(frameListener)

    return () => {
      engine._frameListeners.delete(frameListener)
      weatherRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // React to weather type changes
  useEffect(() => {
    weatherRef.current?.setWeather(type, transitionTime ?? 0)
  }, [type, transitionTime])

  // React to wind changes
  useEffect(() => {
    weatherRef.current?.setWind(windX ?? 0, windZ ?? 0)
  }, [windX, windZ])

  return null
}
