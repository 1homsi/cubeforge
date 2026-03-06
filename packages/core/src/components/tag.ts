import type { Component } from '../ecs/world'

export interface TagComponent extends Component {
  readonly type: 'Tag'
  tags: string[]
}

export function createTag(...tags: string[]): TagComponent {
  return { type: 'Tag', tags }
}
