// `cubeforge/test`: headless testing tools. Import from test files only; this
// entry is not part of the `cubeforge` bundle.
export { mountGame, cleanup, createTestEngine } from './test/mountGame'
export type { MountGameOptions, MountedGame } from './test/mountGame'
export { EngineContext, EntityContext } from './context'
export type { EngineState } from './context'
export { RecordingGL, createRecordingCanvas, decodeInstances, installHeadlessCanvasDOM } from '@cubeforge/renderer'
export type {
  RecordedDraw,
  RecordedInstance,
  RecordedTexture,
  RecordingCanvas,
  RecordingGLOptions,
  HeadlessCanvasOptions,
} from '@cubeforge/renderer'
