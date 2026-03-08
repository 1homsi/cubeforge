import React, { useState } from 'react'
import { Entity } from './Entity'
import { Transform } from './Transform'
import { Sprite } from './Sprite'
import { BoxCollider } from './BoxCollider'
import { useTriggerEnter } from '@cubeforge/context'

interface CheckpointProps {
  x: number
  y: number
  width?: number
  height?: number
  color?: string
  /** Called once when a 'player'-tagged entity enters the checkpoint */
  onActivate?: () => void
}

/** Inner component — lives inside the Entity so it can use contact hooks. */
function CheckpointActivator({ onActivate }: { onActivate?: () => void }) {
  const [used, setUsed] = useState(false)

  useTriggerEnter(() => {
    if (used) return
    setUsed(true)
    onActivate?.()
  }, { tag: 'player' })

  return null
}

/**
 * A trigger zone that fires `onActivate` once when a player-tagged entity enters it.
 *
 * @example
 * <Checkpoint x={800} y={450} onActivate={() => setCheckpoint(800)} />
 */
export function Checkpoint({
  x, y,
  width = 24, height = 48,
  color = '#ffd54f',
  onActivate,
}: CheckpointProps): React.ReactElement {
  return (
    <Entity tags={['checkpoint']}>
      <Transform x={x} y={y} />
      <Sprite width={width} height={height} color={color} zIndex={5} />
      <BoxCollider width={width} height={height} isTrigger />
      <CheckpointActivator onActivate={onActivate} />
    </Entity>
  )
}
