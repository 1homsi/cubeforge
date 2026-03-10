// Components
export { Game } from './components/Game'
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
export { Animation } from './components/Animation'
export { AnimatedSprite, defineAnimations } from './components/AnimatedSprite'
export type { AnimatedSpriteProps, AnimationSet } from './components/AnimatedSprite'
export { Animator } from './components/Animator'
export { SquashStretch } from './components/SquashStretch'
export { ParticleEmitter } from './components/ParticleEmitter'
export { VirtualJoystick } from './components/VirtualJoystick'
export type { VirtualJoystickProps } from './components/VirtualJoystick'
export { MovingPlatform } from './components/MovingPlatform'
export { Checkpoint } from './components/Checkpoint'
export { Tilemap } from './components/Tilemap'
export { ParallaxLayer } from './components/ParallaxLayer'
export { ScreenFlash } from './components/ScreenFlash'
export { CameraZone } from './components/CameraZone'
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
export { useProfiler } from './hooks/useProfiler'
export type { ProfilerData } from './hooks/useProfiler'
export { usePostProcess } from './hooks/usePostProcess'
export { useTouch } from './hooks/useTouch'
export type { TouchControls } from './hooks/useTouch'
export { useTimer } from './hooks/useTimer'
export type { TimerControls } from './hooks/useTimer'
export { useCoroutine, wait, waitFrames, waitUntil } from './hooks/useCoroutine'
export type { CoroutineControls, CoroutineYield, CoroutineFactory } from './hooks/useCoroutine'
export { useSceneManager } from './hooks/useSceneManager'
export type { SceneManagerControls } from './hooks/useSceneManager'
export { useInputBuffer } from './hooks/useInputBuffer'
export { useComboDetector } from './hooks/useComboDetector'
export type { ComboDetectorResult } from './hooks/useComboDetector'
export { useParent } from './hooks/useParent'
export { useAccessibility } from './hooks/useAccessibility'
export type { AccessibilityControls } from './hooks/useAccessibility'
export { useHMR } from './hooks/useHMR'
export type { HMRControls } from './hooks/useHMR'

// Contact hooks (via @cubeforge/context)
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
} from '@cubeforge/context'

// Gameplay hooks (via @cubeforge/gameplay)
export { usePlatformerController } from '@cubeforge/gameplay'
export type { PlatformerControllerOptions } from '@cubeforge/gameplay'
export { useTopDownMovement } from '@cubeforge/gameplay'
export type { TopDownMovementOptions } from '@cubeforge/gameplay'
export { useHealth } from '@cubeforge/gameplay'
export type { HealthControls, HealthOptions } from '@cubeforge/gameplay'
export { useDamageZone } from '@cubeforge/gameplay'
export { useAnimationController } from '@cubeforge/gameplay'
export type { AnimationClip, AnimationControllerResult } from '@cubeforge/gameplay'
export { usePersistedBindings } from '@cubeforge/gameplay'
export type { BindingControls } from '@cubeforge/gameplay'
export { useSave } from '@cubeforge/gameplay'
export type { SaveControls, SaveOptions } from '@cubeforge/gameplay'
export { useRestart } from '@cubeforge/gameplay'
export type { RestartControls } from '@cubeforge/gameplay'
export { useLevelTransition } from '@cubeforge/gameplay'
export type { LevelTransitionControls, TransitionOptions, TransitionType } from '@cubeforge/gameplay'
export { useGameStateMachine } from '@cubeforge/gameplay'
export type { GameState as GameStateDefinition, GameStateMachineResult } from '@cubeforge/gameplay'
export { usePathfinding } from '@cubeforge/gameplay'
export type { PathfindingControls } from '@cubeforge/gameplay'
export { useAISteering } from '@cubeforge/gameplay'
export type { AISteering } from '@cubeforge/gameplay'
export { useKinematicBody } from '@cubeforge/gameplay'
export type { KinematicBodyControls } from '@cubeforge/gameplay'
export { useForces } from '@cubeforge/gameplay'
export type { ForceControls } from '@cubeforge/gameplay'
export { useDropThrough } from '@cubeforge/gameplay'
export { useDialogue } from '@cubeforge/gameplay'
export type { DialogueLine, DialogueScript, DialogueControls } from '@cubeforge/gameplay'
export { useCutscene } from '@cubeforge/gameplay'
export type { CutsceneStep, CutsceneControls } from '@cubeforge/gameplay'
export { useGameStore } from '@cubeforge/gameplay'
export { useTween } from '@cubeforge/gameplay'
export type { TweenControls } from '@cubeforge/gameplay'
export { useObjectPool } from '@cubeforge/gameplay'
export type { ObjectPool } from '@cubeforge/gameplay'

// Audio (via @cubeforge/audio)
export { useSound } from '@cubeforge/audio'
export type { SoundControls, AudioGroup } from '@cubeforge/audio'
export { setGroupVolume, setMasterVolume, getGroupVolume, setGroupMute, stopGroup, duck } from '@cubeforge/audio'
export { useSpatialSound } from '@cubeforge/audio'
export type { SpatialSoundControls, SpatialSoundOptions } from '@cubeforge/audio'
export { setListenerPosition, getListenerPosition } from '@cubeforge/audio'

// DevTools (via @cubeforge/devtools)
export type { DevToolsHandle } from '@cubeforge/devtools'

// Atlas
export type { SpriteAtlas } from './components/spriteAtlas'
export { createAtlas } from './components/spriteAtlas'

// Renderer — WebGL2 instanced renderer (re-exported for advanced use)
export { RenderSystem } from '@cubeforge/renderer'
export { createRenderLayerManager, defaultLayers } from '@cubeforge/renderer'
export type { RenderLayer, RenderLayerManager } from '@cubeforge/renderer'

// Post-processing effects
export { createPostProcessStack, vignetteEffect, scanlineEffect, chromaticAberrationEffect } from '@cubeforge/renderer'
export type { PostProcessEffect, PostProcessStack } from '@cubeforge/renderer'

// Types and utilities from engine packages
export type { EngineState } from './context'
export type { GameControls } from './components/Game'
export type { EntityId, ECSWorld, ScriptUpdateFn, Plugin, WorldSnapshot } from '@cubeforge/core'
export { definePlugin, findByTag, preloadManifest, hotReloadPlugin } from '@cubeforge/core'
export type { HotReloadablePlugin } from '@cubeforge/core'
export type { PreloadManifest, AssetProgress } from '@cubeforge/core'
export type { NavGrid, Vec2Like } from '@cubeforge/core'
export type { HierarchyComponent, WorldTransformComponent } from '@cubeforge/core'
export { createHierarchy, setParent, removeParent, getDescendants, HierarchySystem } from '@cubeforge/core'
export { SpatialHash } from '@cubeforge/core'
export { setAccessibilityOptions, getAccessibilityOptions, announceToScreenReader } from '@cubeforge/core'
export type { AccessibilityOptions } from '@cubeforge/core'
export { hmrSaveState, hmrLoadState, hmrClearState } from '@cubeforge/core'
export { seek, flee, arrive, patrol, wander } from '@cubeforge/core'
export { createTimer } from '@cubeforge/core'
export type { GameTimer } from '@cubeforge/core'
export { mergeTileColliders } from '@cubeforge/core'
export type { MergedRect } from '@cubeforge/core'
export { overlapBox, raycast, raycastAll, overlapCircle, sweepBox, createCompoundCollider } from '@cubeforge/physics'
export type { RaycastHit } from '@cubeforge/physics'
export { createJoint } from '@cubeforge/physics'
export type { JointComponent, JointType } from '@cubeforge/physics'
export type { CapsuleColliderComponent } from '@cubeforge/physics'
export type { CompoundColliderComponent, ColliderShape } from '@cubeforge/physics'
export type { ConvexPolygonColliderComponent } from '@cubeforge/physics'
export type { TriangleColliderComponent } from '@cubeforge/physics'
export type { SegmentColliderComponent } from '@cubeforge/physics'
export type { HeightFieldColliderComponent } from '@cubeforge/physics'
export type { HalfSpaceColliderComponent } from '@cubeforge/physics'
export type { TriMeshColliderComponent } from '@cubeforge/physics'
export type { CombineRule } from '@cubeforge/physics'
export type { ContactManifold, ContactPoint } from '@cubeforge/physics'
export { velocityAtPoint, kineticEnergy, potentialEnergy, predictPosition } from '@cubeforge/physics'
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
} from '@cubeforge/physics'
export {
  createConvexPolygonCollider,
  createTriangleCollider,
  createSegmentCollider,
  createHeightFieldCollider,
  createHalfSpaceCollider,
  createTriMeshCollider,
} from '@cubeforge/physics'
export { buildBVH, queryBVH, queryBVHCircle } from '@cubeforge/physics'
export type { BVH, Triangle2D } from '@cubeforge/physics'
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
} from '@cubeforge/physics'
export type {
  InputManager,
  ActionBindings,
  InputMap,
  AxisBinding,
  InputContextName,
  PlayerInput,
  InputRecording as InputRecordingData,
  TouchPoint,
} from '@cubeforge/input'
export { createInputMap, createPlayerInput, createInputRecorder, globalInputContext } from '@cubeforge/input'
export { InputBuffer, ComboDetector } from '@cubeforge/input'
export type { InputBufferOptions, BufferedAction, ComboDefinition, ComboDetectorOptions } from '@cubeforge/input'
export type { TextComponent } from '@cubeforge/renderer'
export type { TransformComponent, Component } from '@cubeforge/core'
export { createTransform, createTag } from '@cubeforge/core'
export { createSprite } from '@cubeforge/renderer'
export type { RigidBodyComponent } from '@cubeforge/physics'
export type { BoxColliderComponent } from '@cubeforge/physics'
export type { CircleColliderComponent } from '@cubeforge/physics'
export type { SpriteComponent } from '@cubeforge/renderer'
export type { AnimationStateComponent } from '@cubeforge/renderer'
export type { TrailComponent } from '@cubeforge/renderer'
export type { SquashStretchComponent } from '@cubeforge/renderer'
export type { ParticlePoolComponent, Particle } from '@cubeforge/renderer'
export type { ParallaxLayerComponent } from '@cubeforge/renderer'
export type { NineSliceComponent } from '@cubeforge/renderer'
export { createNineSlice } from '@cubeforge/renderer'
export { createCircleShape, createLineShape, createPolygonShape } from '@cubeforge/renderer'
export type { CircleShapeComponent, LineShapeComponent, PolygonShapeComponent } from '@cubeforge/renderer'
export { createGradient } from '@cubeforge/renderer'
export type { GradientComponent, GradientStop, GradientType } from '@cubeforge/renderer'
export { createMask } from '@cubeforge/renderer'
export type { MaskComponent, MaskShape } from '@cubeforge/renderer'
export { TextureFilter } from '@cubeforge/renderer'
export type { TextureFilterValue, MagFilterValue, Sampling, BlendMode } from '@cubeforge/renderer'
export type { TweenHandle } from '@cubeforge/core'
export { Ease, tween } from '@cubeforge/core'
export { createTimeline } from '@cubeforge/core'
export type { TweenTimeline, TimelineEntry } from '@cubeforge/core'
export type { ParticlePreset } from './components/particlePresets'

// Animation helpers
export { playClip, setAnimationState, setAnimatorParam } from './utils/animationHelpers'
export type {
  AnimatorComponent,
  AnimatorStateDefinition,
  AnimatorTransition,
  AnimatorCondition,
  AnimatorParamValue,
} from '@cubeforge/renderer'
export type { AnimationClipDefinition } from '@cubeforge/renderer'

// Prefab utility
export { definePrefab } from './utils/prefab'
