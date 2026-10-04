import { PhysicsSystem } from '@cubeforge/physics'
import { DebugOverlayRenderer } from '@cubeforge/renderer'
import { DebugSystem, DevToolsOverlay, MAX_DEVTOOLS_FRAMES } from '@cubeforge/devtools'
import { Game as GameRoot, type GameFeatures, type GameProps } from './Game'

const fullFeatures: GameFeatures = {
  createPhysics: (gravity, events) => new PhysicsSystem(gravity, events),
  createDebugSystem: (overlay) => new DebugSystem(new DebugOverlayRenderer(overlay)),
  DevToolsOverlay,
  maxDevtoolsFrames: MAX_DEVTOOLS_FRAMES,
}

/** The full `<Game>`: physics, debug overlay and devtools included. */
export function Game(props: GameProps) {
  return <GameRoot {...props} features={props.features ?? fullFeatures} />
}
