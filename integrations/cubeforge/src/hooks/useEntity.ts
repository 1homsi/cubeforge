import { useContext } from 'react'
import type { EntityId } from '@cubeforge/core'
import { EntityContext } from '../context'

export function useEntity(): EntityId {
  const id = useContext(EntityContext)
  if (id === null) throw new Error('useEntity must be used inside <Entity>')
  return id
}
