import { hasRitualFontGlyphs, rasterizeFontTextMask } from '@wbr/scene-runtime/glyph-kit'
import * as THREE from 'three'

const STAMP_SIZE = 256
const GLYPH_MASK_SIZE = 128

let cachedStampPixels: Uint8Array | null = null

function hash2D(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) ^ 0x5bf03635
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash2D(ix, iy)
  const b = hash2D(ix + 1, iy)
  const c = hash2D(ix, iy + 1)
  const d = hash2D(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

function sampleMaskBilinear(data: Float32Array, size: number, fx: number, fy: number): number {
  if (fx < 0 || fy < 0 || fx >= size - 1 || fy >= size - 1) return 0
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const i00 = y0 * size + x0
  const v00 = data[i00]!
  const v10 = data[i00 + 1]!
  const v01 = data[i00 + size]!
  const v11 = data[i00 + size + 1]!
  const top = v00 + (v10 - v00) * tx
  const bot = v01 + (v11 - v01) * tx
  return top + (bot - top) * ty
}

function buildUndamaStampPixels(): Uint8Array {
  if (cachedStampPixels) return cachedStampPixels

  if (!hasRitualFontGlyphs('yujiSyuku', '運')) {
    throw new Error('yujiSyuku ritual font subset is missing glyph 運')
  }

  const mask = rasterizeFontTextMask('yujiSyuku', '運', {
    width: GLYPH_MASK_SIZE,
    height: GLYPH_MASK_SIZE,
    padding: 12,
    supersample: 8,
  })

  // Tangent-plane gnomonic projection centered on the upper-front hemisphere facing the camera
  // so brush strokes on the spherical clay ball show zero equirectangular horizontal stretching.
  const uCenter = 0.27
  const vCenter = 0.72
  const phi0 = uCenter * Math.PI * 2
  const theta0 = (1 - vCenter) * Math.PI
  const center = new THREE.Vector3(
    -Math.cos(phi0) * Math.sin(theta0),
    Math.cos(theta0),
    Math.sin(phi0) * Math.sin(theta0),
  ).normalize()
  const right = new THREE.Vector3(0, 1, 0).cross(center).normalize()
  const up = new THREE.Vector3().crossVectors(center, right).normalize()
  const halfSpan = 0.44

  const pixels = new Uint8Array(STAMP_SIZE * STAMP_SIZE * 4)
  const pt = new THREE.Vector3()
  const bleedOffsets: readonly [number, number][] = [
    [-1.4, 0], [1.4, 0], [0, -1.4], [0, 1.4],
    [-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1],
  ]

  for (let y = 0; y < STAMP_SIZE; y++) {
    // flipY = true maps row 0 -> v = 1 (north pole) and row H-1 -> v = 0 (south pole).
    const v = 1 - (y + 0.5) / STAMP_SIZE
    const theta = (1 - v) * Math.PI
    const sinTheta = Math.sin(theta)
    const cosTheta = Math.cos(theta)

    for (let x = 0; x < STAMP_SIZE; x++) {
      const u = (x + 0.5) / STAMP_SIZE
      const phi = u * Math.PI * 2
      pt.set(-Math.cos(phi) * sinTheta, cosTheta, Math.sin(phi) * sinTheta)

      // Unglazed bisque terracotta clay micro-grain and subtle kiln-warmth variation.
      const nCoarse = smoothNoise(x * 0.08 + 3.1, y * 0.08 + 7.4)
      const nFine = smoothNoise(x * 0.34 + 19.2, y * 0.34 + 5.8)
      const speck = hash2D(x + 11, y + 29)
      const grog = speck > 0.965 ? -16 : speck < 0.035 ? 8 : 0
      const kilnTone = (nCoarse - 0.5) * 14 + (nFine - 0.5) * 9 + cosTheta * 5 + grog

      let r = 207 + kilnTone * 0.95
      let g = 150 + kilnTone * 0.78
      let b = 100 + kilnTone * 0.62

      const facing = pt.dot(center)
      if (facing > 0.35) {
        const sx = pt.dot(right)
        const sy = pt.dot(up)
        const radNorm = Math.hypot(sx, sy) / halfSpan
        const gx = (sx / (2 * halfSpan) + 0.5) * (GLYPH_MASK_SIZE - 1)
        const gy = (0.5 - sy / (2 * halfSpan)) * (GLYPH_MASK_SIZE - 1)

        if (gx >= -2 && gx <= GLYPH_MASK_SIZE + 1 && gy >= -2 && gy <= GLYPH_MASK_SIZE + 1) {
          const coreCov = sampleMaskBilinear(mask.data, GLYPH_MASK_SIZE, gx, gy)
          let bleedSum = 0
          for (let k = 0; k < bleedOffsets.length; k++) {
            const [ox, oy] = bleedOffsets[k]!
            bleedSum += sampleMaskBilinear(mask.data, GLYPH_MASK_SIZE, gx + ox, gy + oy)
          }
          const bleedCov = bleedSum / bleedOffsets.length

          // Subtle recessed press-edge warmth and porous vermilion/iron-terracotta absorption.
          const poreBreak = 0.84 + 0.16 * smoothNoise(x * 0.55 + 41.0, y * 0.55 + 13.0)
          const edgeHalo = Math.max(0, bleedCov - coreCov * 0.65) * 0.42
          const inkWeight = THREE.MathUtils.clamp(coreCov * poreBreak + edgeHalo * 0.68, 0, 1)

          if (inkWeight > 0.002) {
            // Subtle warm cinnabar-russet stamped clay ink (darker where stroke pools deeply).
            const pool = THREE.MathUtils.clamp(coreCov * 1.15 - 0.15, 0, 1)
            const inkR = 148 - pool * 16 + (nFine - 0.5) * 10
            const inkG = 66 - pool * 11 + (nFine - 0.5) * 7
            const inkB = 45 - pool * 8 + (nFine - 0.5) * 5
            r = r + (inkR - r) * inkWeight
            g = g + (inkG - g) * inkWeight
            b = b + (inkB - b) * inkWeight
          } else if (radNorm < 1.02) {
            // Barely perceptible tactile stamp-pad flattening aura on porous clay.
            const padDim = (1 - THREE.MathUtils.smoothstep(radNorm, 0.78, 1.02)) * 2.5
            r -= padDim
            g -= padDim * 0.85
            b -= padDim * 0.7
          }
        }
      }

      const idx = (y * STAMP_SIZE + x) * 4
      pixels[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 255)
      pixels[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 255)
      pixels[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 255)
      pixels[idx + 3] = 255
    }
  }

  cachedStampPixels = pixels
  return pixels
}

/**
 * Renders the standard character 「運」 using the bundled Yuji Syuku (SIL OFL 1.1)
 * brush typeface onto a high-resolution (256x256) mipmapped unglazed terracotta
 * stamp DataTexture; local product artwork, no shrine graphics reproduced.
 */
export function createUndamaStampTexture(): THREE.DataTexture {
  const data = new Uint8Array(buildUndamaStampPixels())
  const texture = new THREE.DataTexture(data, STAMP_SIZE, STAMP_SIZE, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = true
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}
