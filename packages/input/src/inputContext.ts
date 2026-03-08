/**
 * Stack-based input context manager.
 *
 * Contexts allow different parts of the game to claim input priority.
 * The active context is always the top of the stack.
 *
 * Built-in context names: 'gameplay' | 'ui' | 'pause' | 'cutscene'
 * You can push any string as a custom context.
 *
 * @example
 * ```ts
 * const ctx = createInputContext()
 * ctx.push('pause')
 * console.log(ctx.active) // 'pause'
 * ctx.pop('pause')
 * console.log(ctx.active) // 'gameplay' (default)
 * ```
 */

export type BuiltinContext = 'gameplay' | 'ui' | 'pause' | 'cutscene'
export type InputContextName = BuiltinContext | string

export interface InputContextManager {
  /** Push a context onto the stack. */
  push(ctx: InputContextName): void
  /** Pop a specific context from the stack (removes first occurrence from top). */
  pop(ctx: InputContextName): void
  /** The currently active (top) context. */
  readonly active: InputContextName
  /** Full stack, bottom to top. */
  readonly stack: InputContextName[]
  /** Subscribe to context changes. Returns unsubscribe fn. */
  onChange(cb: (ctx: InputContextName) => void): () => void
}

export function createInputContext(defaultCtx: InputContextName = 'gameplay'): InputContextManager {
  const _stack: InputContextName[] = [defaultCtx]
  const _listeners = new Set<(ctx: InputContextName) => void>()

  function notify(): void {
    const current = _stack[_stack.length - 1] ?? defaultCtx
    for (const cb of _listeners) cb(current)
  }

  return {
    push(ctx) {
      _stack.push(ctx)
      notify()
    },
    pop(ctx) {
      // Remove the topmost occurrence
      for (let i = _stack.length - 1; i >= 0; i--) {
        if (_stack[i] === ctx) {
          _stack.splice(i, 1)
          notify()
          return
        }
      }
    },
    get active() {
      return _stack[_stack.length - 1] ?? defaultCtx
    },
    get stack() {
      return [..._stack]
    },
    onChange(cb) {
      _listeners.add(cb)
      return () => _listeners.delete(cb)
    },
  }
}

/** Singleton context manager shared across the game. */
export const globalInputContext = createInputContext()
