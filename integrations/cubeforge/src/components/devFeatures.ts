import { DebugOverlayRenderer } from '@cubeforge/renderer'
import { DebugSystem, DevToolsOverlay, MAX_DEVTOOLS_FRAMES } from '@cubeforge/devtools'
import type { GameFeatures } from './Game'

export const devFeatures: GameFeatures = {
  createDebugSystem: (overlay) => new DebugSystem(new DebugOverlayRenderer(overlay)),
  DevToolsOverlay,
  maxDevtoolsFrames: MAX_DEVTOOLS_FRAMES,
}
