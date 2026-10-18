import * as THREE from 'three'

// Enough for the framed cloth on high-density screens without stalling mobile entry.
const width = 1024, height = 512
let pixels: Uint8Array<ArrayBuffer> | undefined
const blend = (a: number, b: number, t: number) => {
  t = THREE.MathUtils.clamp(t, 0, 1)
  return (Math.round((a >> 16) * (1 - t) + (b >> 16) * t) << 16) |
    (Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t) << 8) |
    Math.round((a & 255) * (1 - t) + (b & 255) * t)
}
const stroke = (distance: number, radius: number, thickness: number, aa: number) =>
  1 - THREE.MathUtils.smoothstep(Math.abs(distance - radius), thickness - aa, thickness + aa)

/** Original dyed-cloth print. Pixel data is shared; each rig owns its GPU texture. */
export function createKoinoboriPrint() {
  if (!pixels) {
    pixels = new Uint8Array(width * height * 4)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const u = (x + .5) / width, v = (y + .5) / height, h = Math.cos(v * Math.PI * 2)
      let color = blend(0x367e87, 0x64b2b0, .5 - h * .2)
      if (u > .30 && u < .845) {
        // Staggered overlapping semicircles face the tail, independent of mesh density.
        const row = Math.floor(v * 8), sy = (v * 8 - row - .5) / .56
        const column = (u - .30) / .085 - (row % 2) * .5
        const sx = (column - Math.floor(column) + .10) / .96, arc = Math.hypot(sx, sy)
        color = blend(color, 0x8bc4bd, (1 - THREE.MathUtils.smoothstep(arc, .55, 1)) * .45)
        color = blend(color, 0x245f6c, stroke(arc, 1, .034, .013))
        color = blend(color, 0xf3dfaa, stroke(arc, .91, .039, .013))
        color = blend(color, 0xaad2c4, stroke(arc, .73, .014, .013) * .75)
      }
      // A light belly and darker dorsal strip read as ink on one continuous cloth.
      color = blend(color, 0xefdfb8, THREE.MathUtils.smoothstep(-h, .74, .96) * .82)
      color = blend(color, 0x286575, THREE.MathUtils.smoothstep(h, .80, .98) * .42)
      if (u < .33) {
        const gill = Math.hypot((u - .135) / .175, h / .94)
        if (u > .17) {
          color = blend(color, 0x245866, stroke(gill, 1, .055, .006))
          color = blend(color, 0xf1d9a1, stroke(gill, .96, .025, .006))
          color = blend(color, 0xc9654f, stroke(gill, .86, .045, .006))
          color = blend(color, 0xf1d9a1, stroke(gill, .77, .014, .006))
        }
        if (u < .037) color = 0xc9654f
        color = blend(color, 0xf1d9a1, stroke(u, .037, .005, 1 / width))
        color = blend(color, 0x245866, stroke(u, .049, .003, 1 / width))
      }
      if (u > .845) {
        color = blend(0x347e88, 0x7dbbb5, .45 - h * .18)
        const ray = Math.abs(Math.sin(Math.PI * (h * 5 + (u - .845) * 2)))
        color = blend(color, 0x245f6c, 1 - THREE.MathUtils.smoothstep(ray, .13, .20))
        color = blend(color, 0xf0daaa, (1 - THREE.MathUtils.smoothstep(ray, .035, .10)) * .88)
      }
      color = blend(color, 0xf1d9a1, stroke(u, .847, .004, 1 / width))
      color = blend(color, 0x245866, stroke(u, .858, .003, 1 / width))
      const at = (y * width + x) * 4
      pixels[at] = color >> 16; pixels[at + 1] = (color >> 8) & 255; pixels[at + 2] = color & 255; pixels[at + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height)
  texture.name = 'koinobori-dyed-cloth'
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}
