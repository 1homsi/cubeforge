# Animator

The **Animator** is the upper layer of Cubeforge's two-layer animation system. It drives an entity's animation clips through a state machine with parameter-based transitions.

## Two-Layer System

| Layer | Component | Responsibility |
|---|---|---|
| **Lower** | `AnimatedSprite` (multi-clip mode) | Holds named clips, resolves which frames to play |
| **Upper** | `Animator` | State machine that sets `currentClip` based on transitions and params |

The Animator evaluates transitions each frame and, when a transition fires, tells the AnimationState which clip to play. You can use either layer independently or combine them.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `initial` | `string` | *required* | Name of the starting state |
| `states` | `Record<string, AnimatorStateDefinition>` | *required* | State definitions with clips and transitions |
| `params` | `Record<string, AnimatorParamValue>` | `{}` | Parameter values checked by transition conditions |
| `playing` | `boolean` | `true` | Whether the state machine is active |

## Defining States

Each state maps to a clip name and declares transitions to other states:

```tsx
import { Animator } from 'cubeforge'
import type { AnimatorStateDefinition } from 'cubeforge'

const states: Record<string, AnimatorStateDefinition> = {
  idle: {
    clip: 'idle',
    transitions: [
      { to: 'walk', when: [{ param: 'speed', op: '>', value: 0.1 }] },
      { to: 'jump', when: [{ param: 'grounded', op: '==', value: false }] },
    ],
  },
  walk: {
    clip: 'walk',
    transitions: [
      { to: 'idle', when: [{ param: 'speed', op: '<=', value: 0.1 }] },
      { to: 'run',  when: [{ param: 'speed', op: '>', value: 5 }] },
      { to: 'jump', when: [{ param: 'grounded', op: '==', value: false }] },
    ],
  },
  run: {
    clip: 'run',
    transitions: [
      { to: 'walk', when: [{ param: 'speed', op: '<=', value: 5 }] },
      { to: 'jump', when: [{ param: 'grounded', op: '==', value: false }] },
    ],
  },
  jump: {
    clip: 'jump',
    transitions: [
      { to: 'idle', when: [{ param: 'grounded', op: '==', value: true }] },
    ],
  },
}
```

### Transition Properties

| Property | Type | Description |
|---|---|---|
| `to` | `string` | Target state name |
| `when` | `AnimatorCondition[]` | All conditions must be true for the transition to fire |
| `priority` | `number` | Higher priority transitions are evaluated first (default `0`) |
| `exitTime` | `number` | Normalized playback progress (0-1) required before this transition can fire |

### State Callbacks

Each state can have `onEnter` and `onExit` callbacks:

```tsx
const states = {
  attack: {
    clip: 'attack',
    onEnter: () => console.log('Attack started'),
    onExit: () => console.log('Attack ended'),
    transitions: [
      { to: 'idle', when: [{ param: 'attacking', op: '==', value: false }] },
    ],
  },
}
```

## Setting Params from Script

Use `setAnimatorParam` inside a Script update function to drive the state machine:

```tsx
import { setAnimatorParam } from 'cubeforge'

const update: ScriptUpdateFn = (entityId, world, input, dt) => {
  const rb = world.getComponent(entityId, 'RigidBody')
  if (!rb) return

  setAnimatorParam(world, entityId, 'speed', Math.abs(rb.velocityX))
  setAnimatorParam(world, entityId, 'grounded', rb.isGrounded)
}
```

## Full Platformer Example

```tsx
import { Entity, Transform, AnimatedSprite, Animator, RigidBody, BoxCollider, Script, defineAnimations } from 'cubeforge'
import type { ScriptUpdateFn } from 'cubeforge'
import { setAnimatorParam } from 'cubeforge'

const anims = defineAnimations({
  idle: { frames: [0],          fps: 1 },
  walk: { frames: [1, 2, 3, 4], fps: 10 },
  run:  { frames: [5, 6, 7, 8], fps: 14 },
  jump: { frames: [9],          fps: 1, loop: false },
})

const animatorStates = {
  idle: {
    clip: 'idle',
    transitions: [
      { to: 'walk', when: [{ param: 'speed', op: '>' as const, value: 0.1 }] },
      { to: 'jump', when: [{ param: 'grounded', op: '==' as const, value: false }] },
    ],
  },
  walk: {
    clip: 'walk',
    transitions: [
      { to: 'idle', when: [{ param: 'speed', op: '<=' as const, value: 0.1 }] },
      { to: 'jump', when: [{ param: 'grounded', op: '==' as const, value: false }] },
    ],
  },
  jump: {
    clip: 'jump',
    transitions: [
      { to: 'idle', when: [{ param: 'grounded', op: '==' as const, value: true }] },
    ],
  },
}

const update: ScriptUpdateFn = (entityId, world, input, dt) => {
  const rb = world.getComponent(entityId, 'RigidBody')
  if (!rb) return
  setAnimatorParam(world, entityId, 'speed', Math.abs(rb.velocityX))
  setAnimatorParam(world, entityId, 'grounded', rb.isGrounded)
}

function Player({ x, y }: { x: number; y: number }) {
  return (
    <Entity id="player">
      <Transform x={x} y={y} />
      <AnimatedSprite
        src="/hero.png" width={32} height={48}
        frameWidth={32} frameHeight={48} frameColumns={8}
        animations={anims} current="idle"
      />
      <Animator
        initial="idle"
        states={animatorStates}
        params={{ speed: 0, grounded: true }}
      />
      <RigidBody friction={0.65} />
      <BoxCollider width={28} height={48} />
      <Script update={update} />
    </Entity>
  )
}
```

## Imperative Helpers

These functions can be called from Script `update` or `init` callbacks:

### `playClip(world, entityId, clipName)`

Directly switch the active clip on an AnimationState component (bypasses the Animator).

### `setAnimationState(world, entityId, stateName)`

Force the Animator to a specific state (resets `_entered` so `onEnter` fires).

### `setAnimatorParam(world, entityId, name, value)`

Set a parameter on the Animator. Transitions are evaluated automatically each frame.
