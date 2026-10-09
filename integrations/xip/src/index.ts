// Components
export { Game } from './components/FullGame'
export { Stage } from './components/Stage'
export { World } from './components/World'
export { Entity } from './components/Entity'
export { Transform } from './components/Transform'
export { Sprite } from './components/Sprite'
export { Text } from './components/Text'
export { RigidBody } from './components/RigidBody'
export { BoxCollider } from './components/BoxCollider'
export { CircleCollider } from './components/CircleCollider'
export { CapsuleCollider } from './components/CapsuleCollider'
export { CompoundCollider } from './components/CompoundCollider'
export { Script } from './components/Script'
export { Camera2D } from './components/Camera2D'
export type { Camera2DProps } from './components/Camera2D'
export type { CameraFollowPoint, CameraFollowPointProvider, CameraFollowLayer, CameraFollowSprite } from '@xip/renderer'
export { Animation } from './components/Animation'
export { AnimatedSprite, defineAnimations } from './components/AnimatedSprite'
export type { AnimatedSpriteProps, AnimationSet } from './components/AnimatedSprite'
export { Animator } from './components/Animator'
export { SquashStretch } from './components/SquashStretch'
export { ParticleEmitter } from './components/ParticleEmitter'
export { VirtualJoystick } from './components/VirtualJoystick'
export type { VirtualJoystickProps } from './components/VirtualJoystick'
export { MovingPlatform } from './components/MovingPlatform'
export type { Waypoint } from './components/MovingPlatform'
export { Checkpoint } from './components/Checkpoint'
export { Tilemap } from './components/Tilemap'
export { TileLayer, useTileLayer } from './components/TileLayer'
export type { TileLayerProps } from './components/TileLayer'
export { TileLayerData, TileLayerCanvasRenderer, visibleTileRange, visibleChunkRange, tileHash } from '@xip/renderer'
export type {
  TileIdArray,
  Tileset,
  TilesetImage,
  TileAnimation,
  TileLayerOptions,
  TileMinFilter,
  TileLayerComponent,
  TileLayerRenderStats,
} from '@xip/renderer'
export { ParallaxLayer } from './components/ParallaxLayer'
export { ScreenFlash } from './components/ScreenFlash'
export { CameraZone } from './components/CameraZone'
export { VirtualCamera } from './components/VirtualCamera'
export type { VirtualCameraProps, VirtualCameraConfig } from './components/VirtualCamera'
export { Trail } from './components/Trail'
export { NineSlice } from './components/NineSlice'
export { AssetLoader } from './components/AssetLoader'
export { Circle } from './components/Circle'
export { Line } from './components/Line'
export { Polygon } from './components/Polygon'
export { Gradient } from './components/Gradient'
export { Mask } from './components/Mask'
export { Joint } from './components/Joint'
export { ConvexCollider } from './components/ConvexCollider'
export { TriangleCollider } from './components/TriangleCollider'
export { SegmentCollider } from './components/SegmentCollider'
export { HeightFieldCollider } from './components/HeightFieldCollider'
export { HalfSpaceCollider } from './components/HalfSpaceCollider'
export { TriMeshCollider } from './components/TriMeshCollider'
export type { ScreenFlashHandle } from './components/ScreenFlash'
export type { TiledObject, TiledLayer } from './components/Tilemap'

// Core hooks
export { useGame } from './hooks/useGame'
export { useCamera } from './hooks/useCamera'
export type { CameraControls } from './hooks/useCamera'
export { useCameraLookahead } from './hooks/useCameraLookahead'
export type { CameraLookaheadOptions } from './hooks/useCameraLookahead'
export { useCameraBlend } from './hooks/useCameraBlend'
export type { CameraBlendControls } from './hooks/useCameraBlend'
export { useCinematicSequence } from './hooks/useCinematicSequence'
export type { CinematicStep, CinematicSequenceControls } from './hooks/useCinematicSequence'
export { useSnapshot } from './hooks/useSnapshot'
export type { SnapshotControls } from './hooks/useSnapshot'
export { useEntity } from './hooks/useEntity'
export { useDestroyEntity } from './hooks/useDestroyEntity'
export { useVirtualInput } from './hooks/useVirtualInput'
export type { VirtualInputState } from './hooks/useVirtualInput'
export { useInput } from './hooks/useInput'
export { useInputMap } from './hooks/useInputMap'
export type { BoundInputMap } from './hooks/useInputMap'
export { useEvents, useEvent } from './hooks/useEvents'
export { useCoordinates } from './hooks/useCoordinates'
export { useWorldQuery } from './hooks/useWorldQuery'
export type { CoordinateHelpers } from './hooks/useCoordinates'
export { usePreload } from './hooks/usePreload'
export type { PreloadState } from './hooks/usePreload'
export { useInputContext } from './hooks/useInputContext'
export type { InputContextControls } from './hooks/useInputContext'
export { usePlayerInput } from './hooks/usePlayerInput'
export { useLocalMultiplayer } from './hooks/useLocalMultiplayer'
export { useInputRecorder } from './hooks/useInputRecorder'
export type { InputRecorderControls, InputRecording } from './hooks/useInputRecorder'
export { useGamepad } from './hooks/useGamepad'
export type { GamepadState } from './hooks/useGamepad'
export { usePause } from './hooks/usePause'
export type { PauseControls } from './hooks/usePause'
export { useProfiler, useEngineStats } from './hooks/useProfiler'
export { StatsOverlay } from './components/StatsOverlay'
export type { StatsOverlayProps } from './components/StatsOverlay'
export { createEngineStats, createRenderStats, copyEngineStats } from '@xip/core'
export type { EngineStats, RenderStats } from '@xip/core'
export type { ProfilerData } from './hooks/useProfiler'
export { usePostProcess } from './hooks/usePostProcess'
export { useWebGLPostProcess } from './hooks/useWebGLPostProcess'
export { useDynamicCanvas } from './hooks/useDynamicCanvas'
export type { DynamicCanvasHandle } from './hooks/useDynamicCanvas'
export type { DynamicCanvasOptions, ManagedDynamicCanvas, ResizeDynamicCanvasOptions } from '@xip/renderer'
export { useSpriteLayer } from './hooks/useSpriteLayer'
export { useTextLayer } from './hooks/useTextLayer'
export { useScreenTint } from './hooks/useScreenTint'
export { useCaptureFrame } from './hooks/useCaptureFrame'
export type { CaptureFrame, CaptureFrameOptions, CaptureType } from '@xip/context'
export { useCameraPanZoom } from './hooks/useCameraPanZoom'
export type { CameraPanZoomOptions } from './hooks/useCameraPanZoom'
export type { ScreenTintControls, ScreenTintMode, ScreenTintOptions } from './hooks/useScreenTint'
export type { LayerBlendMode } from '@xip/renderer'
export { TextLayer, GlyphAtlas, TEXT_HIDDEN, TEXT_WORD_WRAP } from '@xip/renderer'
export type { TextLayerOptions, TextRunOptions, GlyphStyleOptions } from '@xip/renderer'
export {
  SpriteLayer,
  SPRITE_FLIP_X,
  SPRITE_FLIP_Y,
  SPRITE_HIDDEN,
  SPRITE_UNTEXTURED,
  SPRITE_ADDITIVE,
  NO_SPRITE,
  SPRITE_SWAY,
} from '@xip/renderer'
export type { SpriteLayerWind } from '@xip/renderer'
export type { SpriteLayerOptions, LayerAtlas, AtlasFrame, PickOptions, FrameHit } from '@xip/renderer'
export { useIdleFrameSkip } from './hooks/useIdleFrameSkip'
export { useAudioListener } from './hooks/useAudioListener'
export { useTouch } from './hooks/useTouch'
export type { TouchControls } from './hooks/useTouch'
export { useGestures } from './hooks/useGestures'
export type { SwipeEvent, PinchEvent, GestureHandlers, GestureOptions } from './hooks/useGestures'
export { useGamepadHaptics } from './hooks/useGamepadHaptics'
export { useTouchHaptics } from './hooks/useTouchHaptics'
export type { TouchHapticsControls } from './hooks/useTouchHaptics'
export { useTimer } from './hooks/useTimer'
export type { TimerControls } from './hooks/useTimer'
export { useCoroutine, wait, waitFrames, waitUntil } from './hooks/useCoroutine'
export type { CoroutineControls, CoroutineYield, CoroutineFactory } from './hooks/useCoroutine'
export { useSceneManager } from './hooks/useSceneManager'
export type { SceneManagerControls } from './hooks/useSceneManager'
export { useSceneTransition } from './hooks/useSceneTransition'
export type { SceneTransitionControls, TransitionEffect } from './hooks/useSceneTransition'
export { SceneTransitionOverlay } from './components/SceneTransitionOverlay'
export { useHitstop } from './hooks/useHitstop'
export { useInputBuffer } from './hooks/useInputBuffer'
export { useComboDetector } from './hooks/useComboDetector'
export type { ComboDetectorResult } from './hooks/useComboDetector'
export { useParent } from './hooks/useParent'
export { useAccessibility } from './hooks/useAccessibility'
export type { AccessibilityControls } from './hooks/useAccessibility'
export { useHMR } from './hooks/useHMR'
export type { HMRControls } from './hooks/useHMR'
export { useSquashStretch } from './hooks/useSquashStretch'
export type { SquashStretchControls } from './hooks/useSquashStretch'
export { useHistory } from './hooks/useHistory'
export type { HistoryControls, HistoryOptions } from './hooks/useHistory'
export { Selection, useSelection } from './hooks/useSelection'
export type { SelectionControls, SelectionProps, SelectOptions } from './hooks/useSelection'
export { TransformHandles } from './components/TransformHandles'
export type { TransformHandlesProps } from './components/TransformHandles'
export { useSnap } from './hooks/useSnap'
export type { SnapControls, SnapOptions, SnapResult } from './hooks/useSnap'
export { EditableText } from './components/EditableText'
export type { EditableTextProps } from './components/EditableText'
export { exportToBlob, exportToDataURL, downloadCanvas } from './utils/export'
export type { ExportOptions } from './utils/export'
export { A11yNode } from './components/A11yNode'
export type { A11yNodeProps } from './components/A11yNode'
export { VectorPath } from './components/VectorPath'
export type { VectorPathProps } from './components/VectorPath'
export { useGrid } from './hooks/useGrid'
export type { GridControls, GridOptions, GridCell } from './hooks/useGrid'
export { useTurnSystem } from './hooks/useTurnSystem'
export type { TurnSystemControls, TurnSystemOptions } from './hooks/useTurnSystem'
export { useHoverable } from './hooks/useHoverable'
export type { HoverableControls, HoverableOptions } from './hooks/useHoverable'
export { useDraggable, useDroppable } from './hooks/useDragDrop'
export type { DraggableControls, DraggableOptions, DroppableControls, DroppableOptions } from './hooks/useDragDrop'
export { useKeyboardFocus, useFocusable } from './hooks/useKeyboardFocus'
export type { KeyboardFocusControls, FocusableOptions } from './hooks/useKeyboardFocus'
export { FocusRing } from './components/FocusRing'
export type { FocusRingProps } from './components/FocusRing'
export {
  saveScene,
  loadScene,
  saveSceneToLocalStorage,
  loadSceneFromLocalStorage,
  deleteSavedScene,
  listSavedScenes,
} from './utils/sceneSerialize'
export type { SceneSaveOptions } from './utils/sceneSerialize'
export { isReducedMotionPreferred, setReducedMotionOverride } from '@xip/core'

// Contact hooks (via @xip/context)
export {
  useTriggerEnter,
  useTriggerExit,
  useTriggerStay,
  useCollisionEnter,
  useCollisionExit,
  useCollisionStay,
  useCircleEnter,
  useCircleExit,
  useCircleStay,
  useCollidingWith,
} from '@xip/context'
export type { ContactData } from '@xip/context'

// Gameplay hooks (via @xip/gameplay)
export { usePlatformerController } from '@xip/gameplay'
export type { PlatformerControllerOptions } from '@xip/gameplay'
export { useTopDownMovement } from '@xip/gameplay'
export type { TopDownMovementOptions } from '@xip/gameplay'
export { useHealth } from '@xip/gameplay'
export type { HealthControls, HealthOptions } from '@xip/gameplay'
export { useDamageZone } from '@xip/gameplay'
export { useAnimationController } from '@xip/gameplay'
export type { AnimationClip, AnimationControllerResult } from '@xip/gameplay'
export { usePersistedBindings } from '@xip/gameplay'
export type { BindingControls } from '@xip/gameplay'
export { useSave } from '@xip/gameplay'
export type { SaveControls, SaveOptions } from '@xip/gameplay'
export { useIDBSave } from '@xip/gameplay'
export type { IDBSaveControls, IDBSaveOptions } from '@xip/gameplay'
export { useSaveSlots } from '@xip/gameplay'
export type { SaveSlotsControls, SaveSlotsOptions, SaveSlot, SaveSlotMeta } from '@xip/gameplay'
export { useRestart } from '@xip/gameplay'
export type { RestartControls } from '@xip/gameplay'
export { useLevelTransition } from '@xip/gameplay'
export type { LevelTransitionControls, TransitionOptions, TransitionType } from '@xip/gameplay'
export { useGameStateMachine } from '@xip/gameplay'
export type { GameState as GameStateDefinition, GameStateMachineResult } from '@xip/gameplay'
export { usePathfinding } from '@xip/gameplay'
export type { PathfindingControls } from '@xip/gameplay'
export { useAISteering } from '@xip/gameplay'
export type { AISteering } from '@xip/gameplay'
export { useKinematicBody } from '@xip/gameplay'
export type { KinematicBodyControls } from '@xip/gameplay'
export { useForces } from '@xip/gameplay'
export type { ForceControls } from '@xip/gameplay'
export { useCharacterController } from '@xip/gameplay'
export type { CharacterControls } from '@xip/gameplay'
export { CharacterController } from '@xip/physics'
export type { CharacterControllerConfig, CharacterCollision, MoveResult } from '@xip/physics'
export { useDropThrough } from '@xip/gameplay'
export { useDialogue } from '@xip/gameplay'
export type { DialogueLine, DialogueScript, DialogueControls } from '@xip/gameplay'
export { useDialogueTree } from '@xip/gameplay'
export type {
  DialogueTreeNode,
  DialogueTreeScript,
  DialogueTreeChoice,
  DialogueTreeControls,
  DialogueVariables,
} from '@xip/gameplay'
export { useBehaviorTree } from '@xip/gameplay'
export type { BTNode, BTStatus, BehaviorTreeControls } from '@xip/gameplay'
export {
  btAction,
  btCondition,
  btWait,
  btSequence,
  btSelector,
  btParallel,
  btInvert,
  btRepeat,
  btRetryUntilSuccess,
  btCooldown,
  btSucceed,
  btFail,
} from '@xip/gameplay'
export { DialogueBox } from '@xip/gameplay'
export type { DialogueBoxProps, DialogueBoxStyle } from '@xip/gameplay'
export { useCutscene } from '@xip/gameplay'
export type { CutsceneStep, CutsceneControls } from '@xip/gameplay'
export { useGameStore } from '@xip/gameplay'
export { useTween } from '@xip/gameplay'
export type { TweenControls } from '@xip/gameplay'
export { useObjectPool } from '@xip/gameplay'
export type { ObjectPool } from '@xip/gameplay'

// Audio (via @xip/audio)
export { useSound } from '@xip/audio'
export type { SoundControls, SoundOptions, AudioGroup } from '@xip/audio'
export {
  setGroupVolume,
  setMasterVolume,
  getMasterVolume,
  getGroupVolume,
  setGroupMute,
  isGroupMuted,
  stopGroup,
  duck,
  setGroupVolumeFaded,
} from '@xip/audio'
export { useSpatialSound } from '@xip/audio'
export type { SpatialSoundControls, SpatialSoundOptions } from '@xip/audio'
export { setListenerPosition, getListenerPosition } from '@xip/audio'
export { getAudioManager } from '@xip/audio'
export type { AudioManager, ManagedSound, ManagerMusicOptions, ManagerSoundOptions } from '@xip/audio'
export { useMusic } from '@xip/audio'
export type { MusicControls, MusicOptions } from '@xip/audio'
export { useStreamedMusic } from '@xip/audio'
export type { StreamedMusicControls, StreamedMusicOptions } from '@xip/audio'
export { setGroupEffect, clearGroupEffect } from '@xip/audio'
export type {
  GroupEffectOptions,
  ReverbEffectOptions,
  FilterEffectOptions,
  CompressorEffectOptions,
  DelayEffectOptions,
} from '@xip/audio'
export { useAudioAnalyser } from '@xip/audio'
export type { AudioAnalyserOptions, AudioAnalyserControls } from '@xip/audio'
export { useAudioScheduler } from '@xip/audio'
export type { AudioSchedulerOptions, AudioSchedulerControls, BeatHandler, BarHandler } from '@xip/audio'
export { usePreloadAudio } from '@xip/audio'
export type { PreloadAudioResult } from '@xip/audio'
export { useSoundscape } from '@xip/audio'
export type { SoundscapeLayer, SoundscapeOptions, SoundscapeControls } from '@xip/audio'
export { saveAudioSettings, loadAudioSettings } from '@xip/audio'

// DevTools (via @xip/devtools)
export type { DevToolsHandle } from '@xip/devtools'

// Atlas
export type { SpriteAtlas } from './components/spriteAtlas'
export { createAtlas } from './components/spriteAtlas'

// Renderer — WebGL2 instanced renderer (re-exported for advanced use)
export { RenderSystem } from '@xip/renderer'
export { createRenderLayerManager, defaultLayers } from '@xip/renderer'
export type { RenderLayer, RenderLayerManager } from '@xip/renderer'

// Post-processing effects
export { createPostProcessStack, vignetteEffect, scanlineEffect, chromaticAberrationEffect } from '@xip/renderer'
export type { PostProcessEffect, PostProcessStack } from '@xip/renderer'
export type { PostProcessOptions } from '@xip/renderer'

// Types and utilities from engine packages
export { EngineContext, EntityContext } from './context'
export type { EngineState } from './context'
export type { GameControls, RendererBackend } from './components/Game'
export type { EntityId, ECSWorld, ScriptUpdateFn, Plugin, WorldSnapshot, GameLoopMode } from '@xip/core'
export { definePlugin, findByTag, preloadManifest, hotReloadPlugin } from '@xip/core'
export type { HotReloadablePlugin } from '@xip/core'
export type { PreloadManifest, AssetProgress } from '@xip/core'
export type { NavGrid, Vec2Like } from '@xip/core'
export type { HierarchyComponent, WorldTransformComponent } from '@xip/core'
export { createHierarchy, setParent, removeParent, getDescendants, HierarchySystem } from '@xip/core'
export { SpatialHash } from '@xip/core'
export { setAccessibilityOptions, getAccessibilityOptions, announceToScreenReader } from '@xip/core'
export type { AccessibilityOptions } from '@xip/core'
export { hmrSaveState, hmrLoadState, hmrClearState } from '@xip/core'
export { seek, flee, arrive, patrol, wander, pursuit, evade, separation, cohesion, alignment } from '@xip/core'
export { smoothPath } from '@xip/core'
export type { TweenOptions } from '@xip/core'
export { createTimer } from '@xip/core'
export type { GameTimer } from '@xip/core'
export { mergeTileColliders } from '@xip/core'
export type { MergedRect } from '@xip/core'
export {
  overlapBox,
  raycast,
  raycastAll,
  overlapCircle,
  sweepBox,
  projectPoint,
  containsPoint,
  shapeCast,
  intersectShape,
  intersectAABB,
  intersectRay,
  createCompoundCollider,
} from '@xip/physics'
export type { RaycastHit, PointProjection, QueryShape, QueryOpts } from '@xip/physics'
export type { PhysicsHooks } from '@xip/physics'
export { createJoint } from '@xip/physics'
export type { JointComponent, JointType, JointMotor, MotorMode, AxisLock } from '@xip/physics'
export type { CapsuleColliderComponent } from '@xip/physics'
export type { CompoundColliderComponent, ColliderShape } from '@xip/physics'
export type { ConvexPolygonColliderComponent } from '@xip/physics'
export type { TriangleColliderComponent } from '@xip/physics'
export type { SegmentColliderComponent } from '@xip/physics'
export type { HeightFieldColliderComponent } from '@xip/physics'
export type { HalfSpaceColliderComponent } from '@xip/physics'
export type { TriMeshColliderComponent } from '@xip/physics'
export type { CombineRule } from '@xip/physics'
export type { ContactManifold, ContactPoint } from '@xip/physics'
export { velocityAtPoint, kineticEnergy, potentialEnergy, predictPosition } from '@xip/physics'
export {
  addForce,
  addTorque,
  addForceAtPoint,
  applyImpulse,
  applyTorqueImpulse,
  applyImpulseAtPoint,
  resetForces,
  resetTorques,
  setNextKinematicPosition,
  setNextKinematicRotation,
  COLLISION_DYNAMIC_DYNAMIC,
  COLLISION_DYNAMIC_KINEMATIC,
  COLLISION_DYNAMIC_STATIC,
  COLLISION_KINEMATIC_KINEMATIC,
  COLLISION_KINEMATIC_STATIC,
  DEFAULT_ACTIVE_COLLISION_TYPES,
} from '@xip/physics'
export {
  createConvexPolygonCollider,
  createTriangleCollider,
  createSegmentCollider,
  createHeightFieldCollider,
  createHalfSpaceCollider,
  createTriMeshCollider,
} from '@xip/physics'
export {
  setAdditionalMass,
  setMassProperties,
  recomputeMassFromColliders,
  boxArea,
  circleArea,
  capsuleArea,
  polygonArea,
  triangleArea,
  polygonMassProperties,
  triangleMassProperties,
} from '@xip/physics'
export { CollisionPipeline } from '@xip/physics'
export type { CollisionPair, CollisionPipelineResult } from '@xip/physics'
export {
  takeSnapshot,
  restoreSnapshot,
  snapshotToJSON,
  snapshotFromJSON,
  snapshotToBytes,
  snapshotFromBytes,
  snapshotHash,
} from '@xip/physics'
export type { PhysicsSnapshot, PhysicsBodySnapshot, JointSnapshot } from '@xip/physics'
export { DebugRenderPipeline } from '@xip/physics'
export type {
  DebugLine,
  DebugCircle,
  DebugPoint,
  DebugRenderOutput,
  DebugRenderFlags,
  DebugRenderColors,
  DebugRenderBackend,
} from '@xip/physics'
// Low-level physics internals (GJK/EPA, broad phase, TOI, determinism,
// multibody, BVH, pools) have moved to `xipjs/advanced`. Import from there
// if you need them — this trims ~30 symbols from the main autocomplete.
export type {
  InputManager,
  ActionBindings,
  InputMap,
  AxisBinding,
  InputContextName,
  PlayerInput,
  InputRecording as InputRecordingData,
  TouchPoint,
} from '@xip/input'
export { createInputMap, createPlayerInput, createInputRecorder, globalInputContext } from '@xip/input'
export { InputBuffer, ComboDetector } from '@xip/input'
export type { InputBufferOptions, BufferedAction, ComboDefinition, ComboDetectorOptions } from '@xip/input'
export type { TextComponent } from '@xip/renderer'
export type { TransformComponent, Component } from '@xip/core'
export { createTransform, createTag } from '@xip/core'
export { createSprite } from '@xip/renderer'
export type { RigidBodyComponent } from '@xip/physics'
export type { BoxColliderComponent } from '@xip/physics'
export type { CircleColliderComponent } from '@xip/physics'
export type { SpriteComponent } from '@xip/renderer'
export type { AnimationStateComponent } from '@xip/renderer'
export type { TrailComponent } from '@xip/renderer'
export type { SquashStretchComponent } from '@xip/renderer'
export type { ParticlePoolComponent, Particle } from '@xip/renderer'
export type { ParallaxLayerComponent } from '@xip/renderer'
export type { NineSliceComponent } from '@xip/renderer'
export { createNineSlice } from '@xip/renderer'
export { createCircleShape, createLineShape, createPolygonShape } from '@xip/renderer'
export type { CircleShapeComponent, LineShapeComponent, PolygonShapeComponent } from '@xip/renderer'
export { createGradient } from '@xip/renderer'
export type { GradientComponent, GradientStop, GradientType } from '@xip/renderer'
export { createMask } from '@xip/renderer'
export type { MaskComponent, MaskShape } from '@xip/renderer'
export { TextureFilter } from '@xip/renderer'
export type { TextureFilterValue, MagFilterValue, Sampling, BlendMode, SpriteShape } from '@xip/renderer'
export type { TweenHandle } from '@xip/core'
export { Ease, tween } from '@xip/core'
export { createTimeline } from '@xip/core'
export type { TweenTimeline, TimelineEntry } from '@xip/core'
export type { ParticlePreset, ParticleEmitterConfig } from './components/particlePresets'
export { PARTICLE_PRESETS } from './components/particlePresets'
export { HUD, HUDZone, HUDBar, HUDCounter, HUDButton, HUDMenu } from './components/HUD'
export type {
  HUDProps,
  HUDZoneProps,
  HUDBarProps,
  HUDCounterProps,
  HUDPosition,
  HUDButtonProps,
  HUDMenuProps,
  HUDMenuItem,
} from './components/HUD'

// Animation helpers
export { playClip, setAnimationState, setAnimatorParam } from './utils/animationHelpers'
export type {
  AnimatorComponent,
  AnimatorStateDefinition,
  AnimatorTransition,
  AnimatorCondition,
  AnimatorParamValue,
} from '@xip/renderer'
export type { AnimationClipDefinition } from '@xip/renderer'

// Prefab utility
export { definePrefab } from './utils/prefab'

// Multiplayer React hooks
export { useNetworkSync } from './hooks/useNetworkSync'
export type { NetworkSyncOptions } from './hooks/useNetworkSync'
export { useRemotePlayer } from './hooks/useRemotePlayer'
export type { RemotePlayerOptions, RemotePlayerControls } from './hooks/useRemotePlayer'

// Re-export net primitives used alongside the hooks
export {
  Room,
  syncEntity,
  ClientPrediction,
  useNetworkInput,
  createWebSocketTransport,
  createWebRTCTransport,
  isBinaryTransport,
  InterpolationBuffer,
} from '@xip/net'
export type {
  NetMessage,
  RoomConfig,
  SyncConfig,
  PredictionConfig,
  NetworkInputConfig,
  NetTransport,
  BinaryNetTransport,
  WebSocketTransportOptions,
  WebRTCTransportConfig,
  WebRTCTransport,
  InterpolationState,
  InterpolationBufferConfig,
} from '@xip/net'

// Core: delta + binary snapshots
export type { DeltaSnapshot } from '@xip/core'
export { applyDeltaSnapshot } from '@xip/core'

// Scene editor (dev-mode tooling)
export { EditorShell, SceneHierarchy, EntityInspector } from '@xip/editor'
export { NumberField, TextField, BoolField, ColorField, Vec2Field } from '@xip/editor'
export { useEditorState } from '@xip/editor'
export type { EditorShellProps, SceneHierarchyProps, EntityInspectorProps, EditorState, EntityInfo } from '@xip/editor'
