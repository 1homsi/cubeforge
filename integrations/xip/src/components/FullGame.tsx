import { useEffect, useState } from 'react'
import { Game as GameRoot, type GameFeatures, type GameProps } from './Game'

let loaded: GameFeatures | null = null

/**
 * `<Game>` from the main entry. Debug overlay and devtools are loaded with a
 * dynamic import only when `debug` or `devtools` is set, so they never land in
 * a production bundle that doesn't use them.
 */
export function Game(props: GameProps) {
  const wantDev = !props.features && !!(props.debug || props.devtools)
  const [features, setFeatures] = useState<GameFeatures | null>(loaded)

  useEffect(() => {
    if (!wantDev || features) return
    let alive = true
    import('./devFeatures').then((m) => {
      loaded = m.devFeatures
      if (alive) setFeatures(m.devFeatures)
    })
    return () => {
      alive = false
    }
  }, [wantDev, features])

  if (wantDev && !features) return null
  return <GameRoot {...props} features={props.features ?? (wantDev ? features! : undefined)} />
}
