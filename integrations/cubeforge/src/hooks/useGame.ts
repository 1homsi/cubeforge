import { useContext } from 'react'
import { EngineContext, type EngineState } from '../context'

export function useGame(): EngineState {
  const engine = useContext(EngineContext)
  if (!engine) throw new Error('useGame must be used inside <Game>')
  return engine
}
