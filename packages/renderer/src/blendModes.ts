/** Blend modes for layers and screen tints. */
export type LayerBlendMode = 'normal' | 'multiply' | 'additive' | 'screen'

/**
 * Set the GL blend function for a mode. `premultiplied` is for shaders that
 * output colour already multiplied by alpha (the text atlas).
 */
export function setBlendFunc(gl: WebGL2RenderingContext, mode: LayerBlendMode, premultiplied = false): void {
  const src = premultiplied ? gl.ONE : gl.SRC_ALPHA
  switch (mode) {
    case 'additive':
      gl.blendFunc(src, gl.ONE)
      break
    case 'multiply':
      gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA)
      break
    case 'screen':
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR)
      break
    default:
      gl.blendFunc(src, gl.ONE_MINUS_SRC_ALPHA)
  }
}

/** 0xRRGGBBAA to 0..1 floats written into `out`. */
export function unpackRGBA(c: number, out: Float32Array | number[]): void {
  out[0] = (c >>> 24) / 255
  out[1] = ((c >>> 16) & 255) / 255
  out[2] = ((c >>> 8) & 255) / 255
  out[3] = (c & 255) / 255
}
