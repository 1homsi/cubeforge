export interface BufferedAction {
  action: string
  timestamp: number
  /** Frame number when this action was pressed */
  frame: number
}

export interface InputBufferOptions {
  /** How long (seconds) to keep buffered inputs. Default: 0.2 */
  bufferWindow?: number
  /** Maximum buffer size. Default: 16 */
  maxSize?: number
}

export class InputBuffer {
  private buffer: BufferedAction[] = []
  private frame = 0
  private clockMode: 'auto' | 'manual' = 'auto'
  private manualTime = 0
  private bufferWindow: number
  private maxSize: number

  constructor(opts?: InputBufferOptions) {
    this.bufferWindow = opts?.bufferWindow ?? 0.2
    this.maxSize = opts?.maxSize ?? 16
  }

  /**
   * Record an action press. Call each frame for actions that are pressed.
   */
  record(action: string, timestamp?: number): void {
    const ts = this.resolveTime(timestamp)

    // Don't double-record the same action on the same frame
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].frame === this.frame && this.buffer[i].action === action) {
        return
      }
    }

    this.buffer.push({ action, timestamp: ts, frame: this.frame })

    // Enforce max size by dropping oldest entries
    while (this.buffer.length > this.maxSize) {
      this.buffer.shift()
    }
  }

  /**
   * Consume a buffered action if it exists within the buffer window.
   * Returns true if the action was buffered and consumed.
   * This is key for "input buffering" - e.g., pressing jump slightly
   * before landing should still trigger the jump.
   */
  consume(action: string, currentTime?: number): boolean {
    const now = this.resolveTime(currentTime)
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const entry = this.buffer[i]
      if (entry.action === action && now - entry.timestamp <= this.bufferWindow) {
        this.buffer.splice(i, 1)
        return true
      }
    }
    return false
  }

  /**
   * Check if an action exists in the buffer without consuming it.
   */
  has(action: string, currentTime?: number): boolean {
    const now = this.resolveTime(currentTime)
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const entry = this.buffer[i]
      if (entry.action === action && now - entry.timestamp <= this.bufferWindow) {
        return true
      }
    }
    return false
  }

  /**
   * Call at the start of each frame to increment frame counter and prune old entries.
   */
  update(currentTime?: number): void {
    this.frame++
    const now = this.resolveTime(currentTime)
    // Prune expired entries
    let writeIdx = 0
    for (let i = 0; i < this.buffer.length; i++) {
      if (now - this.buffer[i].timestamp <= this.bufferWindow) {
        this.buffer[writeIdx++] = this.buffer[i]
      }
    }
    this.buffer.length = writeIdx
  }

  /** Clear all buffered inputs */
  clear(): void {
    this.buffer.length = 0
  }

  private resolveTime(timestamp: number | undefined): number {
    if (timestamp !== undefined) {
      this.clockMode = 'manual'
      this.manualTime = timestamp
      return timestamp
    }
    if (this.clockMode === 'manual') return this.manualTime
    return performance.now() / 1000
  }
}
