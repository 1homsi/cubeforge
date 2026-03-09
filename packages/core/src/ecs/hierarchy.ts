import type { EntityId, Component } from './world'
import { ECSWorld } from './world'

export interface HierarchyComponent extends Component {
  readonly type: 'Hierarchy'
  parent: EntityId | null
  children: EntityId[]
}

export function createHierarchy(parent?: EntityId): HierarchyComponent {
  return {
    type: 'Hierarchy',
    parent: parent ?? null,
    children: [],
  }
}

/**
 * Set parent-child relationship. Updates both parent's children array
 * and child's parent reference. Creates Hierarchy components if missing.
 */
export function setParent(world: ECSWorld, child: EntityId, parent: EntityId): void {
  // Ensure both entities have Hierarchy components
  let childH = world.getComponent<HierarchyComponent>(child, 'Hierarchy')
  if (!childH) {
    childH = createHierarchy()
    world.addComponent(child, childH)
  }

  let parentH = world.getComponent<HierarchyComponent>(parent, 'Hierarchy')
  if (!parentH) {
    parentH = createHierarchy()
    world.addComponent(parent, parentH)
  }

  // Remove child from old parent's children if any
  if (childH.parent !== null && childH.parent !== parent) {
    const oldParentH = world.getComponent<HierarchyComponent>(childH.parent, 'Hierarchy')
    if (oldParentH) {
      const idx = oldParentH.children.indexOf(child)
      if (idx !== -1) oldParentH.children.splice(idx, 1)
    }
  }

  // Add child to new parent's children (avoid duplicates)
  if (!parentH.children.includes(child)) {
    parentH.children.push(child)
  }

  // Set child's parent
  childH.parent = parent
}

/**
 * Remove parent-child relationship.
 */
export function removeParent(world: ECSWorld, child: EntityId): void {
  const childH = world.getComponent<HierarchyComponent>(child, 'Hierarchy')
  if (!childH || childH.parent === null) return

  const parentH = world.getComponent<HierarchyComponent>(childH.parent, 'Hierarchy')
  if (parentH) {
    const idx = parentH.children.indexOf(child)
    if (idx !== -1) parentH.children.splice(idx, 1)
  }

  childH.parent = null
}

/**
 * Get all descendants of an entity (recursive BFS).
 */
export function getDescendants(world: ECSWorld, entity: EntityId): EntityId[] {
  const result: EntityId[] = []
  const queue: EntityId[] = [entity]

  while (queue.length > 0) {
    const current = queue.shift()!
    const h = world.getComponent<HierarchyComponent>(current, 'Hierarchy')
    if (!h) continue
    for (const child of h.children) {
      result.push(child)
      queue.push(child)
    }
  }

  return result
}
