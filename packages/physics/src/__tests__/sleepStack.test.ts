import { describe, expect, it } from 'vitest'
import { ECSWorld, createTransform } from '@cubeforge/core'
import { PhysicsSystem } from '../physicsSystem'
import { createRigidBody, type RigidBodyComponent } from '../components/rigidbody'
import { createBoxCollider } from '../components/boxCollider'

function stack() {
  const world = new ECSWorld()
  world.addSystem(new PhysicsSystem(980))
  const floor = world.createEntity()
  world.addComponent(floor, createTransform(0, 100))
  world.addComponent(floor, createRigidBody({ isStatic: true }))
  world.addComponent(floor, createBoxCollider(400, 20))
  const boxes: number[] = []
  for (let i = 0; i < 4; i++) {
    const e = world.createEntity()
    world.addComponent(e, createTransform(0, 80 - i * 20))
    world.addComponent(e, createRigidBody({ sleepThreshold: 5, sleepDelay: 0.3 }))
    world.addComponent(e, createBoxCollider(20, 20))
    boxes.push(e)
  }
  return { world, boxes }
}

const rb = (w: ECSWorld, id: number) => w.getComponent<RigidBodyComponent>(id, 'RigidBody')!

describe('sleeping stacks', () => {
  it('a 6-box stack settles in order without tunnelling', () => {
    const world = new ECSWorld()
    world.addSystem(new PhysicsSystem(980))
    const floor = world.createEntity()
    world.addComponent(floor, createTransform(0, 100))
    world.addComponent(floor, createRigidBody({ isStatic: true }))
    world.addComponent(floor, createBoxCollider(400, 20))
    const ids: number[] = []
    for (let i = 0; i < 6; i++) {
      const e = world.createEntity()
      world.addComponent(e, createTransform(0, 80 - i * 60))
      world.addComponent(e, createRigidBody())
      world.addComponent(e, createBoxCollider(20, 20))
      ids.push(e)
    }
    for (let f = 0; f < 300; f++) world.update(1 / 60)
    const ys = ids.map((id) => world.getComponent<{ type: 'Transform'; y: number }>(id, 'Transform')!.y)
    ys.forEach((y, i) => expect(Math.abs(y - (80 - i * 20))).toBeLessThan(5))
  })

  it('a resting stack falls asleep and stays asleep', () => {
    const { world, boxes } = stack()
    for (let f = 0; f < 240; f++) world.update(1 / 60)
    expect(boxes.every((id) => rb(world, id).sleeping)).toBe(true)
    for (let f = 0; f < 30; f++) world.update(1 / 60)
    expect(boxes.every((id) => rb(world, id).sleeping)).toBe(true)
  })

  it('removing the bottom box wakes the boxes it supported', () => {
    const { world, boxes } = stack()
    for (let f = 0; f < 240; f++) world.update(1 / 60)
    const y = (id: number) => world.getComponent<{ type: 'Transform'; y: number }>(id, 'Transform')!.y
    const before = y(boxes[1])
    world.destroyEntity(boxes[0])
    for (let f = 0; f < 60; f++) world.update(1 / 60)
    expect(y(boxes[1])).toBeGreaterThan(before + 10)
  })
})
