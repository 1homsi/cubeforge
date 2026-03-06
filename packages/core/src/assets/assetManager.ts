export class AssetManager {
  private images = new Map<string, HTMLImageElement>()
  private audio = new Map<string, AudioBuffer>()
  private audioCtx: AudioContext | null = null

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext()
    }
    return this.audioCtx
  }

  async loadImage(src: string): Promise<HTMLImageElement> {
    if (this.images.has(src)) return this.images.get(src)!
    const img = new Image()
    img.src = src
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    })
    this.images.set(src, img)
    return img
  }

  getImage(src: string): HTMLImageElement | undefined {
    return this.images.get(src)
  }

  async loadAudio(src: string): Promise<AudioBuffer> {
    if (this.audio.has(src)) return this.audio.get(src)!
    const ctx = this.getAudioContext()
    const response = await fetch(src)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    this.audio.set(src, audioBuffer)
    return audioBuffer
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
    source.start()
  }

  preloadImages(srcs: string[]): Promise<HTMLImageElement[]> {
    return Promise.all(srcs.map(src => this.loadImage(src)))
  }
}
