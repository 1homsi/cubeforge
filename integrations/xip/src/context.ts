// Shared engine contexts live in @xip/context so all integration
// packages can import from one place without circular dependencies.
export { EngineContext, EntityContext } from '@xip/context'
export type { EngineState } from '@xip/context'
