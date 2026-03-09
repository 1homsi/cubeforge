import type { System, EntityId, Component } from './world'
import { ECSWorld } from './world'
import type { TransformComponent } from '../components/transform'
import type { HierarchyComponent } from './hierarchy'

/**
 * Stores the computed world-space transform for an entity.
 * Updated each frame by HierarchySystem.
 */
export interface WorldTransformComponent extends Component {
  readonly type: 'WorldTransform'
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

export function createWorldTransform(): WorldTransformComponent {
  return { type: 'WorldTransform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
}

/**
 * Resolves world-space transforms for entities with Hierarchy components.
 * Processes root entities first, then children in topological order so that
 * each parent's WorldTransform is ready before its children are processed.
 */
export class HierarchySystem implements System {
  update(world: ECSWorld, _dt: number): void {
    const entities = world.query('Hierarchy', 'Transform')
    if (entities.length === 0) return

    // Collect roots (entities with no parent or whose parent lacks Transform)
    const roots: EntityId[] = []
    for (const id of entities) {
      const h = world.getComponent<HierarchyComponent>(id, 'Hierarchy')!
      if (h.parent === null || !world.hasComponent(h.parent, 'Transform')) {
        roots.push(id)
      }
    }

    // BFS from roots — topological order
    const queue = roots.slice()
    while (queue.length > 0) {
      const id = queue.shift()!
      const transform = world.getComponent<TransformComponent>(id, 'Transform')!
      const hierarchy = world.getComponent<HierarchyComponent>(id, 'Hierarchy')!

      // Get or create WorldTransform
      let wt = world.getComponent<WorldTransformComponent>(id, 'WorldTransform')
      if (!wt) {
        wt = createWorldTransform()
        world.addComponent(id, wt)
      }

      if (hierarchy.parent === null || !world.hasComponent(hierarchy.parent, 'WorldTransform')) {
        // Root entity: WorldTransform = local Transform
        wt.x = transform.x
        wt.y = transform.y
        wt.rotation = transform.rotation
        wt.scaleX = transform.scaleX
        wt.scaleY = transform.scaleY
      } else {
        // Child entity: compose with parent's WorldTransform
        const pwt = world.getComponent<WorldTransformComponent>(hierarchy.parent, 'WorldTransform')!
        const cos = Math.cos(pwt.rotation)
        const sin = Math.sin(pwt.rotation)

        wt.x = pwt.x + (transform.x * cos - transform.y * sin) * pwt.scaleX
        wt.y = pwt.y + (transform.x * sin + transform.y * cos) * pwt.scaleY
        wt.rotation = pwt.rotation + transform.rotation
        wt.scaleX = pwt.scaleX * transform.scaleX
        wt.scaleY = pwt.scaleY * transform.scaleY
      }

      // Enqueue children that have Transform
      for (const child of hierarchy.children) {
        if (world.hasComponent(child, 'Transform') && world.hasComponent(child, 'Hierarchy')) {
          queue.push(child)
        }
      }
    }
  }
}
