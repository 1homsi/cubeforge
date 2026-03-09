import { useState, useCallback } from 'react'

export interface RestartControls {
  readonly restartKey: number
  restart(): void
}

export function useRestart(): RestartControls {
  const [restartKey, setRestartKey] = useState(0)

  const restart = useCallback(() => {
    setRestartKey((k) => k + 1)
  }, [])

  return { restartKey, restart }
}
