// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener<T = any> = (data: T) => void

export class EventBus {
  private listeners = new Map<string, Set<Listener>>()

  on<T>(event: string, listener: Listener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
    return () => this.off(event, listener)
  }

  off<T>(event: string, listener: Listener<T>): void {
    this.listeners.get(event)?.delete(listener)
  }

  emit<T>(event: string, data?: T): void {
    this.listeners.get(event)?.forEach(l => l(data))
  }

  once<T>(event: string, listener: Listener<T>): () => void {
    const wrapper: Listener<T> = (data) => {
      listener(data)
      this.off(event, wrapper)
    }
    return this.on(event, wrapper)
  }

  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }
}
