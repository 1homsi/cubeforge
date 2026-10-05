// `cubeforge/render`: renderer, camera, sprite and core hooks for data-driven
// games, without physics, audio, net, editor, devtools or gameplay modules.
export { Game } from './components/Game'
export type { GameControls, RendererBackend } from './components/Game'
export { World } from './components/World'
export { Entity } from './components/Entity'
export { Transform } from './components/Transform'
export { Sprite } from './components/Sprite'
export { Camera2D } from './components/Camera2D'
export type { Camera2DProps } from './components/Camera2D'
export type {
  CameraFollowPoint,
  CameraFollowPointProvider,
  CameraFollowLayer,
  CameraFollowSprite,
} from '@cubeforge/renderer'
export { useGame } from './hooks/useGame'
export { useEntity } from './hooks/useEntity'
export { useCamera } from './hooks/useCamera'
export type { CameraControls } from './hooks/useCamera'
export { useDynamicCanvas } from './hooks/useDynamicCanvas'
export type { DynamicCanvasHandle } from './hooks/useDynamicCanvas'
export type { DynamicCanvasOptions, ManagedDynamicCanvas, ResizeDynamicCanvasOptions } from '@cubeforge/renderer'
export { useGestures } from './hooks/useGestures'
export type { SwipeEvent, PinchEvent, GestureHandlers, GestureOptions } from './hooks/useGestures'
export type { EngineState } from './context'
export type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/core'
export type { SpriteComponent } from '@cubeforge/renderer'
export { TileLayer, useTileLayer } from './components/TileLayer'
export { useSpriteLayer } from './hooks/useSpriteLayer'
export { useTextLayer } from './hooks/useTextLayer'
export { useScreenTint } from './hooks/useScreenTint'
export { useCameraPanZoom } from './hooks/useCameraPanZoom'
export type { CameraPanZoomOptions } from './hooks/useCameraPanZoom'
export type { ScreenTintControls, ScreenTintMode } from './hooks/useScreenTint'
export { useCoordinates } from './hooks/useCoordinates'
export { useEngineStats } from './hooks/useProfiler'
export {
  SpriteLayer,
  TextLayer,
  GlyphAtlas,
  TEXT_HIDDEN,
  TEXT_WORD_WRAP,
  SPRITE_FLIP_X,
  SPRITE_FLIP_Y,
  SPRITE_HIDDEN,
  SPRITE_UNTEXTURED,
  TileLayerData,
  tileHash,
} from '@cubeforge/renderer'
export type { TextLayerOptions, TextRunOptions, GlyphStyleOptions } from '@cubeforge/renderer'
export type {
  SpriteLayerOptions,
  LayerAtlas,
  AtlasFrame,
  TileLayerOptions,
  TileMinFilter,
  Tileset,
  TileAnimation,
} from '@cubeforge/renderer'
export { StatsOverlay } from './components/StatsOverlay'
export { Script } from './components/Script'
