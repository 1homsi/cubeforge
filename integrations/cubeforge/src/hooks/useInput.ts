import { useContext } from 'react'
import type { InputManager } from '@cubeforge/input'
import { EngineContext } from '../context'

export function useInput(): InputManager {
  const engine = useContext(EngineContext)
  if (!engine) throw new Error('useInput must be used inside <Game>')
  return engine.input
}
