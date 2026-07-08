import { describe, it, expect, vi, afterEach } from 'vitest'

import { ImageLoader } from '../loaders'

// The network / decode paths of ImageLoader ultimately funnel into
// createImageBitmap(blob, options).  We stub that global so we can assert the
// pure logic (Blob construction, MIME propagation, option passing) without any
// real image decoding or network I/O.

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ImageLoader.fromArrayBuffer', () => {
  it('wraps raw bytes in a Blob with the given MIME type and forwards to createImageBitmap', async () => {
    const captured: { blob?: Blob; options?: unknown } = {}
    const fakeBitmap = { close: () => {} } as unknown as ImageBitmap
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async (blob: Blob, options?: unknown) => {
        captured.blob = blob
        captured.options = options
        return fakeBitmap
      }),
    )

    const bytes = new Uint8Array([1, 2, 3, 4]).buffer
    const result = await ImageLoader.fromArrayBuffer(bytes, 'image/png')

    expect(result).toBe(fakeBitmap)
    expect(captured.blob).toBeInstanceOf(Blob)
    expect(captured.blob!.type).toBe('image/png')
    expect(captured.blob!.size).toBe(4)
    expect(captured.options).toEqual({ colorSpaceConversion: 'none' })
  })

  it('propagates a different MIME type (jpeg)', async () => {
    let seen: Blob | undefined
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async (blob: Blob) => {
        seen = blob
        return {} as ImageBitmap
      }),
    )
    await ImageLoader.fromArrayBuffer(new Uint8Array([0]).buffer, 'image/jpeg')
    expect(seen!.type).toBe('image/jpeg')
  })
})

describe('ImageLoader.fromBlob', () => {
  it('passes the blob straight through with colorSpaceConversion none', async () => {
    const calls: unknown[] = []
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async (blob: Blob, options?: unknown) => {
        calls.push([blob, options])
        return {} as ImageBitmap
      }),
    )
    const blob = new Blob([new Uint8Array([9, 9])], { type: 'image/webp' })
    await ImageLoader.fromBlob(blob)
    expect(calls).toHaveLength(1)
    expect((calls[0] as [Blob, unknown])[0]).toBe(blob)
    expect((calls[0] as [Blob, unknown])[1]).toEqual({ colorSpaceConversion: 'none' })
  })
})

describe('ImageLoader.load', () => {
  // Deterministically drive the onload / onerror callbacks by stubbing the
  // Image constructor. This avoids relying on happy-dom's image decoding.
  class FakeImage {
    crossOrigin = ''
    onload: (() => void) | null = null
    onerror: ((e: unknown) => void) | null = null
    private _src = ''
    set src(value: string) {
      this._src = value
      // Fire on the microtask queue so the handlers are attached first.
      queueMicrotask(() => {
        if (value.includes('good')) this.onload?.()
        else this.onerror?.(new Error('boom'))
      })
    }
    get src(): string {
      return this._src
    }
  }

  it('resolves with the image element on successful load', async () => {
    vi.stubGlobal('Image', FakeImage)
    const loader = new ImageLoader()
    const img = await loader.load('good.png')
    expect(img).toBeInstanceOf(FakeImage)
    expect((img as unknown as FakeImage).crossOrigin).toBe('anonymous')
  })

  it('rejects with a descriptive error when the image fails to load', async () => {
    vi.stubGlobal('Image', FakeImage)
    const loader = new ImageLoader()
    await expect(loader.load('bad.png')).rejects.toThrow(/failed to load "bad\.png"/)
  })
})
