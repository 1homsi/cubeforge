export interface AssetProgress {
  loaded: number
  total: number
  percent: number
}

export class AssetManager {
  private images = new Map<string, HTMLImageElement>()
  private imagePromises = new Map<string, Promise<HTMLImageElement>>()
  private audio = new Map<string, AudioBuffer>()
  private audioCtx: AudioContext | null = null
  private activeSources = new Map<string, Set<AudioBufferSourceNode>>()
  private _loaded = 0
  private _total = 0
  private _progressListeners = new Set<(p: AssetProgress) => void>()

  /** Base URL prefix applied to all asset paths starting with '/'. Set by Game component. */
  baseURL = ''

  private resolve(src: string): string {
    return this.baseURL && src.startsWith('/') ? this.baseURL + src : src
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext()
    }
    return this.audioCtx
  }

  private emitProgress(): void {
    const p: AssetProgress = {
      loaded: this._loaded,
      total: this._total,
      percent: this._total > 0 ? this._loaded / this._total : 1,
    }
    for (const cb of this._progressListeners) cb(p)
  }

  /** Get current loading progress. */
  getProgress(): AssetProgress {
    return {
      loaded: this._loaded,
      total: this._total,
      percent: this._total > 0 ? this._loaded / this._total : 1,
    }
  }

  /** Subscribe to progress updates. Returns unsubscribe fn. */
  onProgress(cb: (p: AssetProgress) => void): () => void {
    this._progressListeners.add(cb)
    return () => this._progressListeners.delete(cb)
  }

  async loadImage(src: string): Promise<HTMLImageElement> {
    const resolved = this.resolve(src)
    if (this.imagePromises.has(resolved)) return this.imagePromises.get(resolved)!
    this._total++
    this.emitProgress()
    const promise = (async () => {
      const img = new Image()
      img.src = resolved
      try {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
        })
      } catch (err) {
        console.warn(`[Cubeforge] Failed to load image: ${resolved}`)
        throw err
      } finally {
        this._loaded++
        this.emitProgress()
      }
      this.images.set(resolved, img)
      return img
    })()
    this.imagePromises.set(resolved, promise)
    return promise
  }

  /** Resolves once every image that has been requested via loadImage() is settled. */
  async waitForImages(): Promise<void> {
    await Promise.allSettled([...this.imagePromises.values()])
  }

  getImage(src: string): HTMLImageElement | undefined {
    return this.images.get(this.resolve(src))
  }

  /** Returns a read-only snapshot of all loaded images keyed by src. */
  getLoadedImages(): ReadonlyMap<string, HTMLImageElement> {
    return this.images
  }

  async loadAudio(src: string): Promise<AudioBuffer> {
    const resolved = this.resolve(src)
    if (this.audio.has(resolved)) return this.audio.get(resolved)!
    const ctx = this.getAudioContext()
    try {
      const response = await fetch(resolved)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      this.audio.set(resolved, audioBuffer)
      return audioBuffer
    } catch (err) {
      console.warn(`[Cubeforge] Failed to load audio: ${resolved}`)
      throw err
    }
  }

  private trackSource(src: string, source: AudioBufferSourceNode): void {
    let set = this.activeSources.get(src)
    if (!set) {
      set = new Set()
      this.activeSources.set(src, set)
    }
    set.add(source)
    source.onended = () => {
      set!.delete(source)
    }
  }

  playAudio(src: string, volume = 1): void {
    const buffer = this.audio.get(src)
    if (!buffer) return
    const ctx = this.getAudioContext()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gainNode = ctx.createGain()
    gainNode.gain.value = volume
    source.connect(gainNode)
    gainNode.connect(ctx.destination)
    this.trackSource(src, source)
    source.start()
  }

  playLoopAudio(src: string, volume = 1): AudioBufferSourceNode | null {
    const buffer = this.audio.get(src)
    if (!buffer) return null
    const ctx = this.getAudioContext()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const gainNode = ctx.createGain()
    gainNode.gain.value = volume
    source.connect(gainNode)
    gainNode.connect(ctx.destination)
    this.trackSource(src, source)
    source.start()
    return source
  }

  stopAudio(src: string): void {
    const set = this.activeSources.get(src)
    if (!set) return
    for (const source of set) {
      try {
        source.stop()
      } catch {
        /* already stopped */
      }
    }
    set.clear()
  }

  stopAll(): void {
    for (const [src] of this.activeSources) {
      this.stopAudio(src)
    }
    this.activeSources.clear()
  }

  preloadImages(srcs: string[]): Promise<HTMLImageElement[]> {
    return Promise.all(srcs.map((src) => this.loadImage(src)))
  }

  preloadAudio(srcs: string[]): Promise<AudioBuffer[]> {
    return Promise.all(srcs.map((src) => this.loadAudio(src)))
  }
}
