/**
 * ImageLoader — loads images from URL or raw binary data.
 *
 * Used internally by GLTFLoader to decode image sources that arrive as
 * external URIs, data URIs, or raw binary bufferViews.
 *
 * No external dependencies.  Works in any browser environment that exposes
 * the standard Fetch API, createImageBitmap, and URL.createObjectURL.
 */
export class ImageLoader {
  /**
   * Load an image from a URL and return an HTMLImageElement.
   * The element is fully decoded before the promise resolves.
   */
  load(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve(img);
      img.onerror = (_e) => reject(new Error(`ImageLoader: failed to load "${url}"`));
      img.src = url;
    });
  }

  /**
   * Load an image from a URL and return an ImageBitmap (GPU-ready).
   * Preferred over `load()` when the image will be uploaded to WebGL.
   */
  async loadBitmap(url: string): Promise<ImageBitmap> {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`ImageLoader: HTTP ${resp.status} loading "${url}"`);
    }
    const blob = await resp.blob();
    return ImageLoader.fromBlob(blob);
  }

  /**
   * Create an ImageBitmap from a Blob (e.g. after fetching an external image).
   */
  static async fromBlob(blob: Blob): Promise<ImageBitmap> {
    return createImageBitmap(blob, { colorSpaceConversion: 'none' });
  }

  /**
   * Create an ImageBitmap directly from raw bytes + MIME type.
   * Used when a GLTF bufferView contains embedded image data.
   */
  static async fromArrayBuffer(data: ArrayBuffer, mimeType: string): Promise<ImageBitmap> {
    const blob = new Blob([data], { type: mimeType });
    return ImageLoader.fromBlob(blob);
  }
}
