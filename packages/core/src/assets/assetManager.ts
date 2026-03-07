export class AssetManager {
  private images = new Map<string, HTMLImageElement>()
  private imagePromises = new Map<string, Promise<HTMLImageElement>>()
  private audio = new Map<string, AudioBuffer>()
  private audioCtx: AudioContext | null = null
  private activeSources = new Map<string, Set<AudioBufferSourceNode>>()

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext()
    }
    return this.audioCtx
  }

  async loadImage(src: string): Promise<HTMLImageElement> {
    if (this.imagePromises.has(src)) return this.imagePromises.get(src)!
    const promise = (async () => {
      const img = new Image()
      img.src = src
      try {
        await new Promise<void>((resolve, reject) => {
          img.onload  = () => resolve()
          img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
        })
      } catch (err) {
        console.warn(`[Cubeforge] Failed to load image: ${src}`)
        throw err
      }
      this.images.set(src, img)
      return img
    })()
    this.imagePromises.set(src, promise)
    return promise
  }

  /** Resolves once every image that has been requested via loadImage() is settled. */
  async waitForImages(): Promise<void> {
    await Promise.allSettled([...this.imagePromises.values()])
  }

  getImage(src: string): HTMLImageElement | undefined {
    return this.images.get(src)
  }

  async loadAudio(src: string): Promise<AudioBuffer> {
    if (this.audio.has(src)) return this.audio.get(src)!
    const ctx = this.getAudioContext()
    try {
      const response = await fetch(src)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      this.audio.set(src, audioBuffer)
      return audioBuffer
    } catch (err) {
      console.warn(`[Cubeforge] Failed to load audio: ${src}`)
      throw err
    }
  }

  private trackSource(src: string, source: AudioBufferSourceNode): void {
    let set = this.activeSources.get(src)
    if (!set) { set = new Set(); this.activeSources.set(src, set) }
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
      try { source.stop() } catch { /* already stopped */ }
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
    return Promise.all(srcs.map(src => this.loadImage(src)))
  }

  preloadAudio(srcs: string[]): Promise<AudioBuffer[]> {
    return Promise.all(srcs.map(src => this.loadAudio(src)))
  }
}
