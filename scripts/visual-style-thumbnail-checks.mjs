import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { visualStyleOptions } from '../packages/core/src/visual-style.ts'

export const thumbnailSelector = '.visual-style-filmstrip button[data-style] .visual-style-swatch img'

export async function realThumbnailEvidence(page, { output, prefix, contactSheet = false }) {
  await page.waitForFunction(({ selector, count }) => {
    const images = [...document.querySelectorAll(selector)]
    return images.length === count && images.every(image => image.complete && image.naturalWidth === 160 && image.naturalHeight === 120
      && image.closest('.visual-style-swatch').dataset.previewState === 'ready')
  }, { selector: thumbnailSelector, count: visualStyleOptions.length }, { timeout: 90000 })
  const images = await page.locator(thumbnailSelector).evaluateAll(elements => elements.map(image => {
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data, colors = new Set()
    let opaque = 0, edgeOpaque = 0, edgePixels = 0, edgeAlphaMin = 255, edgeBelow250 = 0, edgeBelow128 = 0, sum = 0, square = 0
    for (let at = 0; at < pixels.length; at += 4) {
      const pixel = at / 4, x = pixel % canvas.width, y = Math.floor(pixel / canvas.width)
      if (x < 2 || y < 2 || x >= canvas.width - 2 || y >= canvas.height - 2) {
        edgePixels++
        const alpha = pixels[at + 3]
        edgeAlphaMin = Math.min(edgeAlphaMin, alpha)
        if (alpha < 250) edgeBelow250++
        if (alpha < 128) edgeBelow128++
        // Resampling can soften the outermost pixel; an empty band is transparent.
        if (alpha >= 128) edgeOpaque++
      }
      if (pixels[at + 3] < 128) continue
      opaque++
      colors.add(`${pixels[at] >> 3},${pixels[at + 1] >> 3},${pixels[at + 2] >> 3}`)
      const value = (pixels[at] + pixels[at + 1] + pixels[at + 2]) / 3
      sum += value; square += value * value
    }
    const clearColumn = x => Array.from({ length: canvas.height }, (_, y) => pixels[(y * canvas.width + x) * 4 + 3]).every(alpha => alpha <= 8)
    const clearRow = y => Array.from({ length: canvas.width }, (_, x) => pixels[(y * canvas.width + x) * 4 + 3]).every(alpha => alpha <= 8)
    const transparentBands = { left: 0, right: 0, top: 0, bottom: 0 }
    while (transparentBands.left < canvas.width && clearColumn(transparentBands.left)) transparentBands.left++
    while (transparentBands.right < canvas.width && clearColumn(canvas.width - 1 - transparentBands.right)) transparentBands.right++
    while (transparentBands.top < canvas.height && clearRow(transparentBands.top)) transparentBands.top++
    while (transparentBands.bottom < canvas.height && clearRow(canvas.height - 1 - transparentBands.bottom)) transparentBands.bottom++
    const card = image.closest('[data-style]'), frame = image.closest('.visual-style-swatch')
    const cardBox = card.getBoundingClientRect(), frameBox = frame.getBoundingClientRect(), imageBox = image.getBoundingClientRect()
    return { style: card.dataset.style, src: image.currentSrc || image.src,
      width: image.naturalWidth, height: image.naturalHeight, colors: colors.size,
      opaque: opaque / (canvas.width * canvas.height), variance: opaque ? square / opaque - (sum / opaque) ** 2 : 0,
      opaqueEdges: edgePixels ? edgeOpaque / edgePixels : 0,
      edgeAlpha: { min: edgeAlphaMin, below250: edgeBelow250, below128: edgeBelow128, pixels: edgePixels }, transparentBands,
      layout: { cardWidth: cardBox.width, cardHeight: cardBox.height, frameWidth: frameBox.width, frameHeight: frameBox.height,
        imageWidth: imageBox.width, imageHeight: imageBox.height, imageX: imageBox.x, imageY: imageBox.y,
        frameX: frameBox.x, frameY: frameBox.y, fit: getComputedStyle(image).objectFit,
        photoWidthRatio: frameBox.width / cardBox.width, photoAreaRatio: frameBox.width * frameBox.height / (cardBox.width * cardBox.height) },
      decorativeOverlay: getComputedStyle(frame, '::after').content }
  }))
  assert.deepEqual(images.map(image => image.style).sort(), visualStyleOptions.map(option => option.id).sort(), 'every shader choice contains an actual scene image')
  assert.equal(new Set(images.map(image => image.src)).size, visualStyleOptions.length, 'shader renders are not the same shared image')
  const metadata = [], composites = []
  for (let index = 0; index < images.length; index++) {
    const image = images[index]
    assert.match(image.src, /^data:image\/(?:webp|png);base64,/, `${image.style}: thumbnail is a captured raster image`)
    assert.ok(image.colors > 12 && image.variance > 8 && image.opaque > .1, `${image.style}: thumbnail contains rendered scene detail rather than an empty/color-only surface`)
    assert.ok(image.opaque > .98 && image.opaqueEdges > .98, `${image.style}: captured image fills its raster edges without transparent letterbox bands (opaque=${image.opaque}, edges=${image.opaqueEdges})`)
    assert.ok(Object.values(image.transparentBands).every(size => size === 0), `${image.style}: no transparent padding row or column is baked into the preview`)
    assert.ok(image.layout.photoWidthRatio >= .85 && image.layout.frameHeight >= 64,
      `${image.style}: enlarged preview fills at least 85% of the card width and remains at least 64px tall (${JSON.stringify(image.layout)})`)
    assert.ok(image.layout.photoAreaRatio >= .55, `${image.style}: the real image occupies most of the card rather than blank space`)
    assert.equal(image.layout.fit, 'cover', `${image.style}: the actual preview covers its rounded frame`)
    assert.ok(Math.abs(image.layout.imageWidth - image.layout.frameWidth) <= .5 && Math.abs(image.layout.imageHeight - image.layout.frameHeight) <= .5
      && Math.abs(image.layout.imageX - image.layout.frameX) <= .5 && Math.abs(image.layout.imageY - image.layout.frameY) <= .5,
    `${image.style}: image reaches every edge of its preview frame`)
    assert.ok(['none', 'normal', '""'].includes(image.decorativeOverlay), `${image.style}: no decorative fake landscape covers the real image`)
    const bytes = Buffer.from(image.src.slice(image.src.indexOf(',') + 1), 'base64')
    const png = await sharp(bytes).png().toBuffer()
    const filename = `${prefix}-${image.style}.png`
    await writeFile(path.join(output, filename), png)
    metadata.push({ ...image, src: undefined, signature: createHash('sha256').update(bytes).digest('hex'), file: filename })
    if (contactSheet) {
      const left = index % 4 * 184 + 12, top = Math.floor(index / 4) * 160 + 10
      composites.push({ input: png, left, top })
      const label = Buffer.from(`<svg width="176" height="28"><text x="88" y="19" text-anchor="middle" font-size="13" font-weight="700" font-family="sans-serif" fill="#4a2a12">${image.style}</text></svg>`)
      composites.push({ input: label, left: index % 4 * 184 + 4, top: top + 121 })
    }
  }
  if (contactSheet) await sharp({ create: { width: 736, height: Math.ceil(images.length / 4) * 160, channels: 4, background: '#fbf3dc' } }).composite(composites).png().toFile(path.join(output, `${prefix}-all-shaders.png`))
  return metadata
}

export async function sceneCanvasMetrics(page) {
  return page.locator('.library-scene-stage canvas').evaluate(canvas => {
    const box = canvas.getBoundingClientRect()
    return { width: canvas.width, height: canvas.height, cssWidth: box.width, cssHeight: box.height,
      cssText: canvas.style.cssText, connectedCanvases: document.querySelectorAll('.library-scene-stage canvas').length,
      webglContexts: window.__thumbnailWebglContexts ?? 0 }
  })
}

export function installThumbnailTelemetry() {
  window.__thumbnailWebglContexts = 0; window.__thumbnailCaptures = 0
  window.__thumbnailNativeDrags = []
  document.addEventListener('dragstart', event => {
    if (event.target.closest?.('.visual-style-filmstrip')) window.__thumbnailNativeDrags.push({
      tag: event.target.tagName, prevented: event.defaultPrevented,
    })
  })
  const context = HTMLCanvasElement.prototype.getContext, url = HTMLCanvasElement.prototype.toDataURL, seen = new WeakSet()
  HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
    const result = context.call(this, kind, ...args)
    if (/^(?:webgl|webgl2|experimental-webgl)$/.test(kind) && result && !seen.has(this)) {
      seen.add(this); window.__thumbnailWebglContexts++
    }
    return result
  }
  HTMLCanvasElement.prototype.toDataURL = function (...args) {
    if (this.width === 160 && this.height === 120) window.__thumbnailCaptures++
    return url.apply(this, args)
  }
}
