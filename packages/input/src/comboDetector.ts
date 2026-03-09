export interface ComboDefinition {
  /** Name of the combo (e.g., 'hadouken', 'shoryuken') */
  name: string
  /** Sequence of actions that trigger this combo */
  sequence: string[]
  /** Maximum time (seconds) allowed between consecutive inputs. Default: 0.3 */
  maxInterval?: number
  /** Callback when combo is detected */
  onTrigger?: () => void
}

export interface ComboDetectorOptions {
  /** All combo definitions to detect */
  combos: ComboDefinition[]
}

export class ComboDetector {
  private combos: ComboDefinition[]
  private history: { action: string; time: number }[] = []
  private maxHistoryLength = 20

  constructor(opts: ComboDetectorOptions) {
    this.combos = opts.combos
  }

  /**
   * Feed an action into the detector. Call when an action is pressed.
   * Returns the name of any combo that was completed, or null.
   */
  feed(action: string, time?: number): string | null {
    const ts = time ?? performance.now() / 1000
    this.history.push({ action, time: ts })

    // Trim history to max length
    while (this.history.length > this.maxHistoryLength) {
      this.history.shift()
    }

    // Check each combo against the end of history
    for (const combo of this.combos) {
      if (this.matchCombo(combo)) {
        combo.onTrigger?.()
        return combo.name
      }
    }

    return null
  }

  private matchCombo(combo: ComboDefinition): boolean {
    const seq = combo.sequence
    const maxInterval = combo.maxInterval ?? 0.3

    if (seq.length === 0) return false
    if (this.history.length < seq.length) return false

    // Check the last N entries in history match the sequence
    const startIdx = this.history.length - seq.length
    for (let i = 0; i < seq.length; i++) {
      if (this.history[startIdx + i].action !== seq[i]) {
        return false
      }
    }

    // Check timing between consecutive inputs
    for (let i = 1; i < seq.length; i++) {
      const dt = this.history[startIdx + i].time - this.history[startIdx + i - 1].time
      if (dt > maxInterval) {
        return false
      }
    }

    return true
  }

  /** Clear input history */
  clear(): void {
    this.history.length = 0
  }
}
