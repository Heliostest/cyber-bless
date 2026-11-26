import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

/** Deterministic 2D hash for handmade craft-paper pulp & woven cotton screen textures. */
function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function periodicNoise(u: number, v: number, periodX: number, periodY: number, seed: number): number {
  const x = u * periodX
  const y = v * periodY
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const x0 = ((ix % periodX) + periodX) % periodX
  const x1 = (x0 + 1) % periodX
  const y0 = ((iy % periodY) + periodY) % periodY
  const y1 = (y0 + 1) % periodY
  const a = hash2(x0, y0, seed)
  const b = hash2(x1, y0, seed)
  const c = hash2(x0, y1, seed)
  const d = hash2(x1, y1, seed)
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, ux), THREE.MathUtils.lerp(c, d, ux), uy)
}

function tileFbm(u: number, v: number, basePeriod: number, seed: number): number {
  return periodicNoise(u, v, basePeriod, basePeriod, seed) * 0.54
    + periodicNoise(u, v, basePeriod * 2, basePeriod * 2, seed + 19) * 0.30
    + periodicNoise(u, v, basePeriod * 4, basePeriod * 4, seed + 47) * 0.16
}

export interface PaperCraftTextures {
  readonly albedoMap: THREE.DataTexture
  readonly backlitMap: THREE.DataTexture
  readonly clothWeaveMap: THREE.DataTexture
  readonly shadowWeaveMap: THREE.DataTexture
  dispose(): void
}

/**
 * Generates deterministic, WebGL- and jsdom-safe procedural textures for the
 * thin dyed pierced-paper bird and backlit woven cloth screen.
 */
export function createPaperCraftTextures(size = 256): PaperCraftTextures {
  // Sparse deterministic fine kozo/mulberry fiber wisps shared across albedo & backlit maps (tileable).
  const fiberField = new Float32Array(size * size)
  const fiberCount = 260
  for (let i = 0; i < fiberCount; i++) {
    const x0 = hash2(i, 1, 71)
    const y0 = hash2(i, 2, 71)
    const angle = hash2(i, 3, 71) * Math.PI * 2
    const len = 0.018 + hash2(i, 4, 71) * 0.042
    const dx = Math.cos(angle) * len
    const dy = Math.sin(angle) * len
    const bend = (hash2(i, 5, 71) - 0.5) * 0.012
    const strength = (hash2(i, 6, 71) < 0.58 ? 1 : -0.7) * (0.032 + hash2(i, 7, 71) * 0.042)
    const steps = 14
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const arc = Math.sin(Math.PI * t) * bend
      const px = (x0 + dx * t - dy * arc * 10 + 4) % 1
      const py = (y0 + dy * t + dx * arc * 10 + 4) % 1
      const cx = Math.floor(px * size)
      const cy = Math.floor(py * size)
      const w = Math.sin(Math.PI * t) * strength
      const idx = cy * size + cx
      fiberField[idx] = THREE.MathUtils.clamp(fiberField[idx]! + w, -0.11, 0.14)
      const nx = (cx + 1) % size
      const nIdx = cy * size + nx
      fiberField[nIdx] = THREE.MathUtils.clamp(fiberField[nIdx]! + w * 0.35, -0.11, 0.14)
    }
  }

  const albedoData = new Uint8Array(size * size * 4)
  const backlitData = new Uint8Array(size * size * 4)
  const clothData = new Uint8Array(size * size * 4)
  const shadowData = new Uint8Array(size * size * 4)

  for (let iy = 0; iy < size; iy++) {
    const v = iy / size
    const laidPaper = Math.sin(v * Math.PI * 2 * 56) * 0.016
    const weft = Math.sin(v * Math.PI * 2 * 84)

    for (let ix = 0; ix < size; ix++) {
      const u = ix / size
      const idx = iy * size + ix
      const off = idx * 4

      // 1. Dyed handmade craft paper albedo: delicate pulp mottling, fine laid ribs & subtle silk-thin kozo wisps.
      const pulp = (tileFbm(u, v, 8, 13) - 0.5) * 0.085
      const tooth = (periodicNoise(u, v, 44, 44, 29) - 0.5) * 0.055
      const fiber = fiberField[idx]!
      const tone = THREE.MathUtils.clamp(0.965 + pulp + tooth + laidPaper + fiber * 0.55, 0.84, 1.06)
      const warmFiber = Math.max(0, fiber) * 0.10
      albedoData[off] = Math.round(THREE.MathUtils.clamp(tone + warmFiber * 0.45, 0, 1) * 255)
      albedoData[off + 1] = Math.round(THREE.MathUtils.clamp(tone + warmFiber * 0.25, 0, 1) * 255)
      albedoData[off + 2] = Math.round(THREE.MathUtils.clamp(tone - warmFiber * 0.06, 0, 1) * 255)
      albedoData[off + 3] = 255

      // 2. Thin-paper night backlighting: soft fine-grain transmission without blotchy patches.
      const density = pulp * 1.15 + Math.abs(fiber) * 0.85 - laidPaper * 0.65
      const trans = THREE.MathUtils.clamp(0.84 - density * 0.88 + tooth * 0.35, 0.62, 1.0)
      backlitData[off] = Math.round(THREE.MathUtils.clamp(trans * 1.04, 0, 1) * 255)
      backlitData[off + 1] = Math.round(THREE.MathUtils.clamp(trans * 0.94, 0, 1) * 255)
      backlitData[off + 2] = Math.round(THREE.MathUtils.clamp(trans * 0.80, 0, 1) * 255)
      backlitData[off + 3] = 255

      // 3. Taut backlit plain-weave cotton cloth texture for screen & matching shadow weave.
      const warp = Math.sin(u * Math.PI * 2 * 96)
      const checker = warp * weft
      const slub = (periodicNoise(u, v, 20, 8, 61) - 0.5) * 0.022 + (periodicNoise(u, v, 8, 24, 83) - 0.5) * 0.018
      const clothMottle = (tileFbm(u, v, 6, 97) - 0.5) * 0.018
      const clothLum = THREE.MathUtils.clamp(0.985 + checker * 0.014 + warp * 0.008 + weft * 0.008 + slub + clothMottle, 0.92, 1.03)
      clothData[off] = Math.round(THREE.MathUtils.clamp(clothLum * 1.008, 0, 1) * 255)
      clothData[off + 1] = Math.round(THREE.MathUtils.clamp(clothLum * 0.996, 0, 1) * 255)
      clothData[off + 2] = Math.round(THREE.MathUtils.clamp(clothLum * 0.972, 0, 1) * 255)
      clothData[off + 3] = 255

      // Shadow-on-cloth micro-weave: lets the woven cotton surface read softly inside projected shadows.
      const shadowLum = THREE.MathUtils.clamp(0.965 + checker * 0.022 + slub * 1.1 + clothMottle * 0.8, 0.88, 1.03)
      shadowData[off] = Math.round(THREE.MathUtils.clamp(shadowLum * 1.015, 0, 1) * 255)
      shadowData[off + 1] = Math.round(THREE.MathUtils.clamp(shadowLum * 0.992, 0, 1) * 255)
      shadowData[off + 2] = Math.round(THREE.MathUtils.clamp(shadowLum * 0.965, 0, 1) * 255)
      shadowData[off + 3] = 255
    }
  }

  const makeTex = (data: Uint8Array<ArrayBuffer>, repeat = 1) => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.magFilter = tex.minFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    tex.repeat.set(repeat, repeat)
    tex.needsUpdate = true
    return tex
  }

  const albedoMap = makeTex(albedoData, 1)
  const backlitMap = makeTex(backlitData, 1)
  const clothWeaveMap = makeTex(clothData, 2)
  const shadowWeaveMap = makeTex(shadowData, 2)

  return {
    albedoMap,
    backlitMap,
    clothWeaveMap,
    shadowWeaveMap,
    dispose() {
      albedoMap.dispose()
      backlitMap.dispose()
      clothWeaveMap.dispose()
      shadowWeaveMap.dispose()
    },
  }
}

/**
 * Shared thin pierced-paper material using `createRitualMaterial` sheet optics.
 * Keeps `transparent: false` for exact opaque raycast hit-testing while rendering
 * matte kozo/xuan fibers, cut-edge pulp variation, and restrained warm night backlighting.
 */
export function createPiercedPaperMaterial(
  textures: PaperCraftTextures,
  color: number,
  emissive: number,
  emissiveIntensity: number,
  scatterStrength = 0.56,
): THREE.MeshStandardMaterial {
  return createRitualMaterial({
    color,
    map: textures.albedoMap,
    emissive,
    emissiveMap: textures.backlitMap,
    emissiveIntensity,
    roughness: 0.95,
    metalness: 0,
    vertexColors: true,
    side: THREE.DoubleSide,
  }, {
    kind: 'paper',
    strength: scatterStrength,
    fiber: 'paper',
    paper: {
      layout: 'sheet',
      grainScale: 4.5,
      aspect: 1,
      grain: 0.44,
      fibers: 0.22,
      // Disable rectangular UV border rim; real cut-paper perimeter & hole walls carry edge light.
      edge: 0,
      highlightGuard: 0.54,
    },
  })
}

/** Adds a pointed willow-leaf / teardrop pierced paper-cut aperture to a 2D shape. */
export function addLeafHole(
  shape: THREE.Shape,
  cx: number,
  cy: number,
  halfLen: number,
  halfWidth: number,
  angle = 0,
): void {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const pt = (lx: number, ly: number): [number, number] => [
    cx + lx * cos - ly * sin,
    cy + lx * sin + ly * cos,
  ]
  const tipL = pt(-halfLen, 0)
  const tipR = pt(halfLen, 0)
  const ctrlTopL = pt(-halfLen * 0.36, halfWidth * 1.28)
  const ctrlTopR = pt(halfLen * 0.36, halfWidth * 1.28)
  const ctrlBotR = pt(halfLen * 0.36, -halfWidth * 1.28)
  const ctrlBotL = pt(-halfLen * 0.36, -halfWidth * 1.28)

  // Clockwise hole winding for Three.js Shape.holes.
  const h = new THREE.Path()
  h.moveTo(tipL[0], tipL[1])
  h.bezierCurveTo(ctrlTopL[0], ctrlTopL[1], ctrlTopR[0], ctrlTopR[1], tipR[0], tipR[1])
  h.bezierCurveTo(ctrlBotR[0], ctrlBotR[1], ctrlBotL[0], ctrlBotL[1], tipL[0], tipL[1])
  h.closePath()
  shape.holes.push(h)
}

/** Adds a crisp curved crescent paper-cut aperture to a 2D shape. */
export function addCrescentHole(
  shape: THREE.Shape,
  cx: number,
  cy: number,
  radius: number,
  thickness: number,
  angle = 0,
): void {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const pt = (lx: number, ly: number): [number, number] => [
    cx + lx * cos - ly * sin,
    cy + lx * sin + ly * cos,
  ]
  const tipA = pt(0, radius)
  const tipB = pt(0, -radius)
  const outer1 = pt(radius * 0.92, radius * 0.52)
  const outer2 = pt(radius * 0.92, -radius * 0.52)
  const inner1 = pt(radius * 0.92 - thickness * 1.65, -radius * 0.38)
  const inner2 = pt(radius * 0.92 - thickness * 1.65, radius * 0.38)

  const h = new THREE.Path()
  h.moveTo(tipA[0], tipA[1])
  h.bezierCurveTo(outer1[0], outer1[1], outer2[0], outer2[1], tipB[0], tipB[1])
  h.bezierCurveTo(inner1[0], inner1[1], inner2[0], inner2[1], tipA[0], tipA[1])
  h.closePath()
  shape.holes.push(h)
}

export interface CutPaperGeometryOptions {
  readonly depth: number
  /** Physical UV repeat scale so paper fiber density stays uniform across large and small parts. */
  readonly uvScale?: number
  /** Deterministic UV shift so neighboring pieces don't repeat the same pulp spot. */
  readonly uvOffset?: readonly [number, number]
  /** Optional subtle thin-paper out-of-plane bow/curl (in meters) keeping roots flush. */
  readonly curl?: (x: number, y: number) => number
  /** Optional local AO points (brass rivets / overlapping joints) [x, y, radius, depth]. */
  readonly pinShadows?: readonly (readonly [number, number, number, number])[]
  /** Pale cut-paper pulp edge brightness on outer & pierced-hole walls. */
  readonly edgeBright?: number
}

/**
 * Builds thin pierced-paper ExtrudeGeometry with isotropic physical UVs, subtle
 * handmade camber/curl, organic dye-bath vertex toning, and pale raw-paper cut edges
 * along both the outer silhouette and every interior pierced cutout wall.
 */
export function createCutPaperGeometry(
  shape: THREE.Shape,
  options: CutPaperGeometryOptions,
): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: options.depth,
    bevelEnabled: false,
    curveSegments: 20,
  })

  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const uvScale = options.uvScale ?? 1.28
  const [uo, vo] = options.uvOffset ?? [2.1, 1.7]
  const edgeBright = options.edgeBright ?? 1.15

  // Classify caps vs extruded cut-paper walls BEFORE optional gentle Z-curl.
  const isWall = new Uint8Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const nz = norm.getZ(i)
    const wall = Math.abs(nz) < 0.5
    isWall[i] = wall ? 1 : 0

    // Positive isotropic physical UVs keep paper grain uniform across all bird layers.
    uv.setXY(i, x * uvScale + uo, y * uvScale + vo)

    if (options.curl) {
      pos.setZ(i, z + options.curl(x, y))
    }

    if (wall) {
      // Crisp pale raw-paper cut rim along outer perimeter and every pierced hole wall.
      const frontRim = z > options.depth * 0.5 ? 1.03 : 0.93
      colors[i * 3] = edgeBright * frontRim
      colors[i * 3 + 1] = edgeBright * 0.955 * frontRim
      colors[i * 3 + 2] = edgeBright * 0.885 * frontRim
    } else {
      // Soft hand-dyed paper variation + quiet contact darkening around brass rivets/seams.
      const backTone = nz < 0 ? 0.95 : 1.0
      const dyeMottle = 0.97 + 0.055 * Math.sin(x * 5.2 + y * 3.7 + uo) * Math.cos(y * 6.1 - x * 2.9 + vo)
      let pinAo = 1
      if (options.pinShadows) {
        for (const [px, py, rad, amount] of options.pinShadows) {
          const d = Math.hypot(x - px, y - py) / rad
          if (d < 1) pinAo *= 1 - amount * (1 - d) * (1 - d)
        }
      }
      const shade = backTone * dyeMottle * pinAo
      colors[i * 3] = shade * 1.01
      colors[i * 3 + 1] = shade
      colors[i * 3 + 2] = shade * 0.985
    }
  }

  pos.needsUpdate = true
  uv.needsUpdate = true
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  if (options.curl) {
    // Recompute smooth face normals cleanly; non-indexed ExtrudeGeometry preserves crisp edge walls.
    geometry.computeVertexNormals()
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
