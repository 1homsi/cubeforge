import { beforeEach } from 'vitest'

beforeEach(() => {
  delete (globalThis as unknown as Record<symbol, unknown>)[Symbol.for('xip.audio.state')]
})
