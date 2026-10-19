import { DataTexture, EquirectangularReflectionMapping, FloatType, LinearSRGBColorSpace, RGBAFormat } from 'three'

/** Small local linear HDR environment. No remote preset/CDN, no scene capture loop. */
export function createLabEnvironment() {
  const width = 64, height = 32
  const data = new Float32Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / (height - 1)
    const moon = Math.exp(-((u - 0.72) ** 2 / 0.012 + (v - 0.32) ** 2 / 0.018))
    const warm = Math.exp(-((u - 0.23) ** 2 / 0.009 + (v - 0.56) ** 2 / 0.014))
    const i = (y * width + x) * 4
    data[i] = 0.07 + moon * 0.5 + warm * 1.5
    data[i + 1] = 0.09 + moon * 0.65 + warm * 0.52
    data[i + 2] = 0.16 + moon * 1.0 + warm * 0.16
    data[i + 3] = 1
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, FloatType)
  texture.mapping = EquirectangularReflectionMapping
  texture.colorSpace = LinearSRGBColorSpace
  texture.needsUpdate = true
  return texture
}
