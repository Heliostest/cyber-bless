import * as THREE from 'three'
import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

type XYZ = [number, number, number]
type Axis = 'x' | 'y' | 'z'
type Flip = 'none' | 'x' | 'y' | 'z'
export type TimberSupport = 'trestle' | 'arched' | 'joined'
export type TimberFinish = 'honey' | 'birch' | 'chestnut' | 'walnut' | 'cedar' | 'lacquerRed'
export type StandSurfaceKind = 'wood' | 'fabric' | 'stone' | 'ceramic'
export type PedestalSurfaceKind = 'stone' | 'wood' | 'ceramic'
export type ObjectCradleStyle = 'pad' | 'tray' | 'cradle' | 'groove'

export interface StandBuildResult {
  root: THREE.Group
  top: THREE.Object3D
  surfaceY: number
  groundY: number
}

export type ContactShadowShape = 'ellipse' | 'rounded-rect'

export interface ContactShadowOptions {
  /** Mesh name (defaults to `<prefix>-contact-ao` or `contact-ao`). */
  name?: string
  /** Naming prefix when `name` is omitted. */
  prefix?: string
  /** Footprint width along X. */
  width: number
  /** Footprint depth along Z. */
  depth: number
  /** Local Y elevation above the ground plane (defaults to `0.0018`). */
  y?: number
  /** Local XZ offset `[x, z]` (defaults to `[0, 0]`). */
  center?: [number, number]
  /** Soft falloff silhouette: `'ellipse'` (default) or `'rounded-rect'`. */
  shape?: ContactShadowShape
  /** Warm purple-umber AO tint (defaults to `0x3f2f2b`). */
  color?: THREE.ColorRepresentation
  /** Peak opacity in `[0, 1]` (defaults to `0.24`). */
  opacity?: number
  /** Optional Y rotation in radians (defaults to `0`). */
  rotationY?: number
}

export interface CraftTableOptions {
  name: string
  /** Retains the scene's existing named support for grounding checks. */
  topName?: string
  width: number
  depth: number
  /** Absolute work surface, not the centre of the top. */
  surfaceY: number
  thickness: number
  center?: [number, number]
  groundY?: number
  sceneId?: string
  support?: TimberSupport
  finish?: TimberFinish
}

export interface OfferingTableOptions {
  name: string
  /** Retains the scene's existing named tabletop for grounding/raycast checks. */
  topName?: string
  width: number
  depth: number
  /** Absolute work/offering surface Y (top of tabletop). */
  surfaceY: number
  thickness?: number
  center?: [number, number]
  groundY?: number
  sceneId?: string
  finish?: TimberFinish
  color?: THREE.ColorRepresentation
  frameColor?: THREE.ColorRepresentation
  planks?: number
  breadboardEnds?: boolean
  legThickness?: number
  legInset?: number
  apron?: boolean
  stretchers?: boolean
  bevel?: number
  contactShadow?: boolean
}

export interface RoundLowTableOptions {
  name: string
  topName?: string
  /** Outer radius along X (and Z when radiusZ is omitted). */
  radius: number
  /** Optional Z radius for oval tables (defaults to radius). */
  radiusZ?: number
  /** Absolute resting surface Y (top of tabletop). */
  surfaceY: number
  thickness?: number
  center?: [number, number]
  groundY?: number
  sceneId?: string
  finish?: TimberFinish
  color?: THREE.ColorRepresentation
  frameColor?: THREE.ColorRepresentation
  legCount?: number
  legRadius?: number
  apron?: boolean
  stretchers?: boolean
  segments?: number
}

export interface ObjectCradleOptions {
  name: string
  topName?: string
  width: number
  depth: number
  /** Absolute resting surface Y where props seat. Defaults to groundY + height. */
  surfaceY?: number
  /** Base height from groundY to resting surfaceY when surfaceY is omitted. */
  height?: number
  center?: [number, number]
  groundY?: number
  sceneId?: string
  style?: ObjectCradleStyle
  /** Shorthand to enable perimeter lip (selects 'tray' when style is omitted). */
  lip?: boolean
  /** Shorthand to enable concave saddle groove (selects 'groove' when style is omitted). */
  groove?: boolean
  kind?: StandSurfaceKind
  finish?: TimberFinish
  color?: THREE.ColorRepresentation
  accentColor?: THREE.ColorRepresentation
  /** Optional liner mat on top of a pad or inside a tray (e.g. linen inset). */
  insetColor?: THREE.ColorRepresentation
  insetKind?: StandSurfaceKind
  axis?: Axis
  grooveAxis?: 'x' | 'z'
  lipHeight?: number
  lipThickness?: number
  grooveDepth?: number
  grooveWidth?: number
  footed?: boolean
  bevel?: number
  roughness?: number
  surfaceScale?: number
  surfaceStrength?: number
  applySurface?: boolean
}

export interface PedestalTierSpec {
  width?: number
  depth?: number
  radius?: number
  radiusZ?: number
  height: number
  bevel?: number
  color?: THREE.ColorRepresentation
}

export interface SteppedPedestalOptions {
  name: string
  topName?: string
  shape?: 'rect' | 'round' | 'oval'
  width?: number
  depth?: number
  radius?: number
  radiusZ?: number
  /** Absolute top resting surface Y. Defaults to groundY + height. */
  surfaceY?: number
  height?: number
  center?: [number, number]
  groundY?: number
  sceneId?: string
  kind?: PedestalSurfaceKind
  finish?: TimberFinish
  color?: THREE.ColorRepresentation
  trimColor?: THREE.ColorRepresentation
  tiers?: number | readonly PedestalTierSpec[]
  moulding?: boolean
  bevel?: number
  segments?: number
  roughness?: number
  surfaceScale?: number
  surfaceStrength?: number
  applySurface?: boolean
}

/** Deterministic lookup from all 21 authored craft-table names to their scene IDs. */
export const CRAFT_TABLE_SCENE_IDS: Readonly<Record<string, string>> = {
  'rooster-table': 'barcelos-clay-rooster',
  'egg-table': 'sorbian-painted-egg',
  'licitar-table': 'croatian-licitar-heart',
  'spoon-table': 'welsh-love-spoon',
  'straw-table': 'lithuanian-straw-garden',
  'ship-table': 'aland-votive-ship',
  'rug-table': 'amazigh-woven-rug',
  'hoop-table': 'hungarian-embroidery-hoop',
  'banner-table': 'breton-banner',
  'copper-table': 'purepecha-copper-bowl',
  'giant-table': 'catalan-festival-giant',
  'cart-table': 'sicilian-painted-cart',
  'tea-table': 'blang-tea',
  'tile-table': 'andalusian-ceramic-tile',
  'birch-bench': 'finnish-birch-basket',
  'woodblock-table': 'chinese-woodblock-print',
  'house-table': 'ndebele-painted-house',
  'fan-table': 'fijian-woven-fan',
  'wire-table': 'slovak-wire-bird',
  'journal-table': 'czech-pilgrim-journal',
  'horse-table': 'dalarna-wooden-horse',
}

const FINISHES = {
  honey: { board: 0xbd9463, frame: 0x8d6742, end: 0xa77e4f, peg: 0xd4b080 },
  birch: { board: 0xc4a47a, frame: 0x997d58, end: 0xb19067, peg: 0xd6ba8e },
  chestnut: { board: 0xae8356, frame: 0x7d593d, end: 0x976f48, peg: 0xc89e6b },
  walnut: { board: 0x7a563c, frame: 0x573b27, end: 0x694932, peg: 0x987152 },
  cedar: { board: 0xb98258, frame: 0x8b5b39, end: 0xa36e47, peg: 0xd09f76 },
  lacquerRed: { board: 0x94362c, frame: 0x6c241d, end: 0x802d24, peg: 0xb45446 },
} satisfies Record<TimberFinish, { board: number; frame: number; end: number; peg: number }>

const SURFACE_PRESETS = {
  stone: { main: 0xb6ac9b, trim: 0x9d9382, roughness: .90, scale: .95, strength: .34 },
  ceramic: { main: 0xd9cfc0, trim: 0xc2b6a4, roughness: .56, scale: 1.10, strength: .28 },
  fabric: { main: 0xdfd3be, trim: 0xcbbca3, roughness: .92, scale: 1.45, strength: .36 },
} as const

type PlankRecipe = {
  dh: number
  ds: number
  dl: number
  scale: number
  strength: number
  roughness: number
  flip: Flip
  offset: XYZ
}

const PLANK_RECIPES_3: readonly PlankRecipe[] = [
  { dh: .006, ds: -.022, dl: .026, scale: .44, strength: .35, roughness: .72, flip: 'none', offset: [.41, .19, .27] },
  { dh: -.007, ds: .036, dl: -.044, scale: .70, strength: .46, roughness: .82, flip: 'y', offset: [-.57, -.31, .53] },
  { dh: .002, ds: .010, dl: -.006, scale: .94, strength: .38, roughness: .75, flip: 'x', offset: [.83, .43, -.39] },
]

const PLANK_RECIPES_4: readonly PlankRecipe[] = [
  { dh: .006, ds: -.022, dl: .026, scale: .44, strength: .35, roughness: .72, flip: 'none', offset: [.41, .19, .27] },
  { dh: -.007, ds: .036, dl: -.044, scale: .70, strength: .46, roughness: .82, flip: 'y', offset: [-.57, -.31, .53] },
  { dh: .004, ds: -.008, dl: .008, scale: .94, strength: .36, roughness: .74, flip: 'x', offset: [.83, .43, -.39] },
  { dh: -.005, ds: .026, dl: -.026, scale: .56, strength: .43, roughness: .79, flip: 'z', offset: [-.34, -.22, -.61] },
]

function nameSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

function tintWood(color: THREE.ColorRepresentation, dh: number, ds: number, dl: number): THREE.Color {
  return new THREE.Color(color).offsetHSL(dh, ds, dl)
}

function flipGeometry(geom: THREE.BufferGeometry, flip: Flip) {
  if (flip === 'x') geom.rotateX(Math.PI)
  else if (flip === 'y') geom.rotateY(Math.PI)
  else if (flip === 'z') geom.rotateZ(Math.PI)
}

function ancestorEnvironmentSurfaceY(parent: THREE.Object3D): number | undefined {
  let cursor: THREE.Object3D | null = parent
  while (cursor) {
    const value = cursor.userData?.environmentSurfaceY
    if (typeof value === 'number' && Number.isFinite(value)) return value
    cursor = cursor.parent
  }
  return undefined
}

function resolveGroundY(
  parent: THREE.Object3D,
  options: { groundY?: number; sceneId?: string; name?: string },
  useCraftTableMap = false,
): number {
  if (typeof options.groundY === 'number' && Number.isFinite(options.groundY)) return options.groundY
  if (options.sceneId) return getEnvironmentSurfaceY(options.sceneId)
  const inherited = ancestorEnvironmentSurfaceY(parent)
  if (inherited !== undefined) return inherited
  if (useCraftTableMap && options.name && Object.hasOwn(CRAFT_TABLE_SCENE_IDS, options.name)) {
    return getEnvironmentSurfaceY(CRAFT_TABLE_SCENE_IDS[options.name]!)
  }
  return 0
}

function createStandMaterial(
  kind: StandSurfaceKind,
  {
    color,
    finish = 'honey',
    axis = 'x',
    roughness,
    scale,
    strength,
    applySurface = true,
  }: {
    color?: THREE.ColorRepresentation
    finish?: TimberFinish
    axis?: Axis
    roughness?: number
    scale?: number
    strength?: number
    applySurface?: boolean
  } = {},
): THREE.MeshStandardMaterial {
  if (kind === 'wood') {
    const isLacquer = finish === 'lacquerRed'
    const mat = new THREE.MeshStandardMaterial({
      color: color ?? FINISHES[finish].board,
      roughness: roughness ?? (isLacquer ? .54 : .78),
      metalness: 0,
    })
    if (applySurface) {
      applyCraftSurface(mat, {
        kind: 'wood',
        axis,
        scale: scale ?? (isLacquer ? .72 : .80),
        strength: strength ?? (isLacquer ? .16 : .38),
      })
    }
    return mat
  }
  const preset = SURFACE_PRESETS[kind]
  const mat = new THREE.MeshStandardMaterial({
    color: color ?? preset.main,
    roughness: roughness ?? preset.roughness,
    metalness: 0,
  })
  if (applySurface) {
    applyCraftSurface(mat, {
      kind,
      axis,
      scale: scale ?? preset.scale,
      strength: strength ?? preset.strength,
    })
  }
  return mat
}

const contactShadowPixels: Partial<Record<ContactShadowShape, Uint8Array<ArrayBuffer>>> = {}

function getContactShadowPixels(shape: ContactShadowShape): Uint8Array<ArrayBuffer> {
  let data = contactShadowPixels[shape]
  if (data) return data
  const size = 64
  data = new Uint8Array(size * size * 4)
  for (let iy = 0; iy < size; iy++) {
    const ny = ((iy + 0.5) / size) * 2 - 1
    for (let ix = 0; ix < size; ix++) {
      const nx = ((ix + 0.5) / size) * 2 - 1
      let alpha = 0
      if (shape === 'ellipse') {
        const r = Math.hypot(nx, ny)
        if (r < 1) {
          const edge = 1 - r
          alpha = Math.exp(-2.4 * r * r) * Math.pow(edge, 1.35)
        }
      } else {
        // Rounded-rectangle signed distance field in [-1, 1]^2 fading cleanly to 0 at border.
        const boxHalf = 0.50
        const cornerR = 0.16
        const feather = 1 - (boxHalf + cornerR)
        const qx = Math.max(0, Math.abs(nx) - boxHalf)
        const qy = Math.max(0, Math.abs(ny) - boxHalf)
        const dist = Math.hypot(qx, qy) - cornerR
        const u = THREE.MathUtils.clamp(dist / feather, 0, 1)
        const edge = 1 - u
        alpha = edge * edge * (3 - 2 * edge) * Math.exp(-0.45 * u * u)
      }
      const offset = (iy * size + ix) * 4
      data[offset] = 255
      data[offset + 1] = 255
      data[offset + 2] = 255
      data[offset + 3] = Math.round(THREE.MathUtils.clamp(alpha, 0, 1) * 255)
    }
  }
  contactShadowPixels[shape] = data
  return data
}

function createContactShadowTexture(shape: ContactShadowShape): THREE.DataTexture {
  const size = 64
  const texture = new THREE.DataTexture(getContactShadowPixels(shape), size, size)
  texture.magFilter = texture.minFilter = THREE.LinearFilter
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

/**
 * Adds a lightweight warm purple-umber procedural contact AO plane slightly above
 * the local ground plane. Excluded from grounding sweeps, outlines, outdoor hiding,
 * and pointer/grounding raycasts.
 */
export function addContactShadow(parent: THREE.Object3D, options: ContactShadowOptions): THREE.Mesh {
  const {
    width,
    depth,
    y = 0.0018,
    center = [0, 0],
    shape = 'ellipse',
    color = 0x3f2f2b,
    opacity = 0.24,
    rotationY = 0,
  } = options
  const geom = new THREE.PlaneGeometry(Math.max(0.01, width), Math.max(0.01, depth))
  geom.rotateX(-Math.PI / 2)
  const shadowMap = createContactShadowTexture(shape)
  const mat = new THREE.MeshBasicMaterial({
    color,
    map: shadowMap,
    transparent: true,
    opacity: THREE.MathUtils.clamp(opacity, 0, 1),
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    toneMapped: false,
  })
  const releaseShadowMap = () => {
    mat.removeEventListener('dispose', releaseShadowMap)
    shadowMap.dispose()
  }
  mat.addEventListener('dispose', releaseShadowMap)
  const mesh = new THREE.Mesh(geom, mat)
  mesh.name = options.name ?? (options.prefix ? `${options.prefix}-contact-ao` : 'contact-ao')
  mesh.position.set(center[0], y, center[1])
  if (rotationY) mesh.rotation.y = rotationY
  mesh.userData.effect = true
  mesh.userData.keepInOutdoorEnvironment = true
  mesh.userData.toonSurface = { outline: false }
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.raycast = () => {}
  parent.add(mesh)
  return mesh
}

function addStandMesh(
  prefix: string,
  part: string,
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  p: XYZ,
  owner: THREE.Object3D,
) {
  const mesh = new THREE.Mesh(geometry, mat)
  mesh.name = `${prefix}-${part}`
  mesh.position.set(...p)
  mesh.castShadow = mesh.receiveShadow = true
  owner.add(mesh)
  return mesh
}

function addRoundedStandBox(
  prefix: string,
  part: string,
  size: XYZ,
  p: XYZ,
  mat: THREE.Material,
  owner: THREE.Object3D,
  radius = .018,
  { flip = 'none', offset }: { flip?: Flip; offset?: XYZ } = {},
) {
  const clamped = Math.max(.001, Math.min(radius, size[0] / 3, size[1] / 3, size[2] / 3))
  const geom = new RoundedBoxGeometry(size[0], size[1], size[2], 2, clamped)
  flipGeometry(geom, flip)
  if (offset) {
    geom.translate(offset[0], offset[1], offset[2])
    return addStandMesh(prefix, part, geom, mat, [p[0] - offset[0], p[1] - offset[1], p[2] - offset[2]], owner)
  }
  return addStandMesh(prefix, part, geom, mat, p, owner)
}

function createGroovedSectionGeometry(
  across: number,
  along: number,
  bottomY: number,
  valleyY: number,
  grooveDepth: number,
  grooveWidth: number,
  bevel: number,
  grooveAxis: 'x' | 'z',
): THREE.BufferGeometry {
  const height = Math.max(.004, valleyY - bottomY)
  const b = Math.max(.0008, Math.min(bevel, height * .24, across * .08, along * .08, grooveDepth * .35))
  const halfX = Math.max(.002, across / 2 - b)
  const halfG = Math.min(halfX - .002, Math.max(.002, grooveWidth / 2))
  const y0 = bottomY + b
  const yValley = valleyY - b
  const yShoulder = valleyY + grooveDepth - b
  const shape = new THREE.Shape()
  shape.moveTo(-halfX, y0)
  shape.lineTo(halfX, y0)
  shape.lineTo(halfX, yShoulder)
  if (halfG < halfX - .001) shape.lineTo(halfG, yShoulder)
  const steps = 16
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = halfG * (1 - 2 * t)
    const u = Math.abs(x) / halfG
    const y = yValley + (yShoulder - yValley) * (.5 - .5 * Math.cos(Math.PI * u))
    shape.lineTo(x, y)
  }
  if (halfG < halfX - .001) shape.lineTo(-halfX, yShoulder)
  shape.closePath()
  const extrudeDepth = Math.max(.002, along - b * 2)
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    steps: 1,
    curveSegments: 8,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: b,
    bevelThickness: b,
  })
  geom.translate(0, 0, -extrudeDepth / 2)
  if (grooveAxis === 'x') geom.rotateY(Math.PI / 2)
  return geom
}

/**
 * Original, texture-free timber furniture. No third-party meshes are embedded.
 * Dimensions come from each scene so the craft, contact plane and cue anchors
 * remain unchanged. Everything is a child of root and uses normal tree disposal.
 */
export function addCraftTable(parent: THREE.Object3D, options: CraftTableOptions): StandBuildResult {
  const { name, width: w, depth: d, surfaceY, thickness: t, center = [0, 0],
    support = 'trestle', finish = 'honey' } = options
  const groundY = resolveGroundY(parent, options, true)
  const h = surfaceY - groundY, underside = h - t, colors = FINISHES[finish], seed = nameSeed(name)
  const root = new THREE.Group(); root.name = `${name}-furniture`
  root.position.set(center[0], groundY, center[1]); parent.add(root)
  root.userData.furniture = { authored: true, support, finish, surfaceY, groundY }
  const wood = (
    color: THREE.ColorRepresentation,
    axis: Axis,
    { scale = .8, strength = .38, roughness = .78 }: { scale?: number; strength?: number; roughness?: number } = {},
  ) => applyCraftSurface(new THREE.MeshStandardMaterial({ color, roughness }), { kind: 'wood', axis, scale, strength })
  const peg = wood(colors.peg, 'y', { scale: 1.14, strength: .34, roughness: .8 })
  const seamMat = new THREE.MeshStandardMaterial({ color: tintWood(colors.frame, -.005, .015, -.14), roughness: .94 })
  const add = (part: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: XYZ, owner: THREE.Object3D = root) =>
    addStandMesh(name, part, geometry, mat, p, owner)
  const box = (
    part: string,
    size: XYZ,
    p: XYZ,
    mat: THREE.Material,
    owner: THREE.Object3D = root,
    radius = .025,
    opts?: { flip?: Flip; offset?: XYZ },
  ) => addRoundedStandBox(name, part, size, p, mat, owner, radius, opts)
  const beam = (part: string, a: XYZ, b: XYZ, wide: number, deep: number, mat: THREE.Material, flip: Flip = 'none') => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b)
    // Keep leg local origin centered (no offset) so scene interaction tests targeting *-table-leg stay exact.
    const mesh = box(part, [wide, from.distanceTo(to), deep], [0, 0, 0], mat, root, .025, { flip })
    mesh.position.copy(from).add(to).multiplyScalar(.5)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize())
    return mesh
  }
  const dowel = (p: XYZ) => {
    const mesh = add('wooden-peg', new THREE.CylinderGeometry(.022, .022, .008, 10), peg, p)
    mesh.rotation.x = Math.PI / 2; mesh.userData.toonSurface = { outline: false }
  }

  const top = new THREE.Group(); top.name = options.topName ?? `${name}-top`; root.add(top)
  const endWidth = Math.min(.19, w * .06), run = w - endWidth * 2
  // Join 3 (or 4 for deep worktables) generously proportioned planks of unequal widths
  // with subtle micro-chamfer seams and distinct scale/tone/roughness/local phase.
  const baseRatios = d > 2.05 ? [.23, .30, .21, .26] : [.29, .39, .32]
  const recipes = d > 2.05 ? PLANK_RECIPES_4 : PLANK_RECIPES_3
  const plankCount = baseRatios.length
  const ratioShift = seed % plankCount
  const recipeShift = (seed >>> 3) % recipes.length
  const phaseJitter = ((seed >>> 6) % 11 - 5) * .04
  const seamGap = .006
  let cursorZ = -d / 2
  for (let i = 0; i < plankCount; i++) {
    const ratio = baseRatios[(i + ratioShift) % plankCount]!
    const plankDepth = d * ratio
    const zCenter = cursorZ + plankDepth / 2
    const recipe = recipes[(i + recipeShift) % recipes.length]!
    const mat = wood(tintWood(colors.board, recipe.dh, recipe.ds, recipe.dl), 'x', {
      scale: recipe.scale,
      strength: recipe.strength,
      roughness: recipe.roughness,
    })
    box('top-board', [run, t, plankDepth - seamGap], [0, h - t / 2, zCenter], mat, top, .016, {
      flip: recipe.flip,
      offset: [recipe.offset[0] + phaseJitter, recipe.offset[1], recipe.offset[2] - phaseJitter * .6],
    })
    cursorZ += plankDepth
    if (i < plankCount - 1) {
      // Recessed warm joinery shadow strip strictly below surfaceY prevents any light leak
      // while letting the rounded plank chamfers read as a delicate hand-planed seam.
      const seamHeight = Math.max(.02, t - .010)
      const seam = add('top-seam', new THREE.BoxGeometry(run - .010, seamHeight, .011), seamMat, [0, h - .0055 - seamHeight / 2, cursorZ], top)
      seam.castShadow = false; seam.userData.toonSurface = { outline: false }
    }
  }
  for (const side of [-1, 1] as const) {
    const isLeft = side < 0
    const endMat = wood(
      tintWood(colors.end, isLeft ? -.005 : .006, isLeft ? .022 : -.014, isLeft ? -.024 : .018),
      'z',
      { scale: isLeft ? .62 : .88, strength: isLeft ? .43 : .37, roughness: isLeft ? .76 : .82 },
    )
    box('breadboard-end', [endWidth, t, d], [side * (w - endWidth) / 2, h - t / 2, 0], endMat, top, .025, {
      flip: isLeft ? 'none' : 'y',
      offset: isLeft ? [.17, .29, .44 + phaseJitter] : [-.23, -.37, -.51 - phaseJitter],
    })
    for (const z of [-d * .30, d * .30]) {
      const pin = add('end-grain-pin', new THREE.CylinderGeometry(.018, .018, .008, 10), peg, [side * (w - endWidth) / 2, h - .004, z], top)
      pin.userData.toonSurface = { outline: false }
    }
  }

  const span = w * .35, railZ = d * .31
  const legFlips: readonly Flip[] = ['none', 'y', 'x', 'z']
  if (support === 'trestle') {
    const legMats = [
      wood(tintWood(colors.frame, -.005, .02, -.020), 'y', { scale: .60, strength: .48, roughness: .84 }),
      wood(tintWood(colors.frame, .005, -.012, .018), 'y', { scale: .88, strength: .42, roughness: .79 }),
    ]
    let legIdx = 0
    for (const [sideIdx, x] of ([-span, span] as const).entries()) {
      const isLeft = sideIdx === 0
      const footMat = wood(
        tintWood(colors.frame, isLeft ? -.004 : .005, isLeft ? .018 : -.010, isLeft ? -.022 : .016),
        'z',
        { scale: isLeft ? .58 : .84, strength: isLeft ? .44 : .39, roughness: isLeft ? .84 : .79 },
      )
      box('trestle-foot', [.25, .09, d * .80], [x, .045, 0], footMat, root, .035, {
        flip: isLeft ? 'none' : 'y',
        offset: isLeft ? [.19, .14, .37] : [-.24, -.18, -.46],
      })
      for (const side of [-1, 1]) {
        beam('leg', [x, .09, side * d * .28], [x, underside - .06, side * d * .16], .14, .15, legMats[legIdx % 2]!, legFlips[legIdx % 4]!)
        legIdx++
      }
      const capMat = wood(
        tintWood(colors.frame, isLeft ? .004 : -.005, isLeft ? -.012 : .018, isLeft ? .012 : -.016),
        'z',
        { scale: isLeft ? .72 : .96, strength: isLeft ? .41 : .45, roughness: isLeft ? .80 : .85 },
      )
      box('trestle-cap', [.24, .12, d * .76], [x, underside - .06, 0], capMat, root, .025, {
        flip: isLeft ? 'x' : 'z',
        offset: isLeft ? [-.16, .24, -.31] : [.21, -.22, .42],
      })
      dowel([x, underside - .06, d * .38 + .004])
    }
    const stretcherMat = wood(tintWood(colors.frame, -.004, .016, -.010), 'x', { scale: .66, strength: .44, roughness: .83 })
    box('through-stretcher', [span * 2 + .20, .12, .13], [0, underside * .42, 0], stretcherMat, root, .025, {
      offset: [.48 + phaseJitter, -.19, .14],
    })
    for (const [idx, x] of ([-span - .085, span + .085] as const).entries()) {
      const wedgeMat = wood(
        tintWood(colors.end, idx === 0 ? -.005 : .005, .012, idx === 0 ? -.018 : .022),
        'y',
        { scale: idx === 0 ? .92 : 1.18, strength: .42, roughness: idx === 0 ? .78 : .83 },
      )
      box('stretcher-wedge', [.045, .19, .18], [x, underside * .42, 0], wedgeMat, root, .025, { flip: idx === 0 ? 'none' : 'y' })
    }
  } else if (support === 'arched') {
    // Two broad end panels with a real open arch under the stretcher.
    const b = d * .36, inner = d * .16, inset = .012, panelTop = underside - inset * 2
    const outline = new THREE.Shape()
    outline.moveTo(-b + .04, 0); outline.quadraticCurveTo(-b, 0, -b, .04)
    outline.lineTo(-b + .08, panelTop - .04); outline.quadraticCurveTo(-b + .08, panelTop, -b + .12, panelTop)
    outline.lineTo(b - .12, panelTop); outline.quadraticCurveTo(b - .08, panelTop, b - .08, panelTop - .04)
    outline.lineTo(b, .04); outline.quadraticCurveTo(b, 0, b - .04, 0)
    outline.lineTo(inner, 0); outline.lineTo(inner, panelTop * .24)
    outline.bezierCurveTo(inner, panelTop * .69, -inner, panelTop * .69, -inner, panelTop * .24)
    outline.lineTo(-inner, 0); outline.closePath()
    for (const [idx, x] of ([-span, span] as const).entries()) {
      const isLeft = idx === 0
      const panel = new THREE.ExtrudeGeometry(outline, { depth: .16, steps: 1, curveSegments: 6, bevelEnabled: true, bevelSegments: 2, bevelSize: inset, bevelThickness: inset })
      panel.translate(0, inset, -.08); panel.rotateY(isLeft ? Math.PI / 2 : -Math.PI / 2)
      const panelMat = wood(
        tintWood(colors.frame, isLeft ? -.005 : .005, isLeft ? .020 : -.012, isLeft ? -.020 : .018),
        'y',
        { scale: isLeft ? .58 : .84, strength: isLeft ? .47 : .41, roughness: isLeft ? .83 : .78 },
      )
      add('leg', panel, panelMat, [x, 0, 0])
    }
    const stretcherMat = wood(tintWood(colors.frame, -.004, .015, -.012), 'x', { scale: .68, strength: .44, roughness: .82 })
    box('through-stretcher', [span * 2 + .20, .13, .16], [0, underside * .71, 0], stretcherMat, root, .025, {
      offset: [-.43 + phaseJitter, .21, -.16],
    })
    for (const [idx, x] of ([-span - .09, span + .09] as const).entries()) {
      const wedgeMat = wood(
        tintWood(colors.end, idx === 0 ? -.005 : .005, .012, idx === 0 ? -.018 : .022),
        'y',
        { scale: idx === 0 ? .94 : 1.20, strength: .42, roughness: idx === 0 ? .78 : .83 },
      )
      box('stretcher-wedge', [.045, .20, .20], [x, underside * .71, 0], wedgeMat, root, .025, { flip: idx === 0 ? 'none' : 'y' })
    }
  } else {
    const legMats = [
      wood(tintWood(colors.frame, -.005, .020, -.020), 'y', { scale: .62, strength: .47, roughness: .84 }),
      wood(tintWood(colors.frame, .005, -.012, .018), 'y', { scale: .90, strength: .41, roughness: .79 }),
    ]
    let legIdx = 0
    for (const x of [-span, span]) for (const z of [-railZ, railZ]) {
      beam('leg', [x * 1.035, 0, z * 1.055], [x, underside, z], .15, .15, legMats[legIdx % 2]!, legFlips[legIdx % 4]!)
      dowel([x, underside - .085, z + .080])
      legIdx++
    }
    for (const [idx, z] of ([-railZ, railZ] as const).entries()) {
      const isFront = idx === 1
      const apronMat = wood(
        tintWood(colors.frame, isFront ? .005 : -.005, isFront ? -.010 : .018, isFront ? .014 : -.022),
        'x',
        { scale: isFront ? .54 : .82, strength: isFront ? .43 : .46, roughness: isFront ? .78 : .84 },
      )
      box('apron', [span * 2, .16, .09], [0, underside - .08, z], apronMat, root, .025, {
        flip: isFront ? 'none' : 'y',
        offset: isFront ? [.52 + phaseJitter, .17, -.19] : [-.44 - phaseJitter, -.23, .24],
      })
    }
    for (const [idx, x] of ([-span, span] as const).entries()) {
      const isLeft = idx === 0
      const sideMat = wood(
        tintWood(colors.frame, isLeft ? -.004 : .004, isLeft ? .012 : -.010, isLeft ? -.014 : .016),
        'z',
        { scale: isLeft ? .68 : .94, strength: isLeft ? .43 : .39, roughness: isLeft ? .82 : .79 },
      )
      box('side-stretcher', [.10, .11, railZ * 2], [x, underside * .31, 0], sideMat, root, .025, {
        flip: isLeft ? 'none' : 'y',
        offset: isLeft ? [.15, -.18, .38] : [-.19, .22, -.42],
      })
    }
    const lowerMat = wood(tintWood(colors.frame, -.004, .014, -.008), 'x', { scale: .76, strength: .42, roughness: .83 })
    box('lower-stretcher', [span * 2, .10, .10], [0, underside * .31, 0], lowerMat, root, .025, {
      offset: [-.36 + phaseJitter, .16, .21],
    })
  }

  // Warm purple-umber contact AO footprint under the craft table and its supports.
  addContactShadow(root, {
    prefix: name,
    width: w * .96,
    depth: d * .96,
    y: .0018,
    shape: 'rounded-rect',
    opacity: .21,
  })
  if (support === 'trestle') {
    const footPadW = Math.min(.36, Math.max(.22, w - span * 2))
    for (const x of [-span, span] as const) {
      addContactShadow(root, {
        name: `${name}-foot-contact-ao`,
        width: footPadW,
        depth: d * .88,
        y: .002,
        center: [x, 0],
        shape: 'rounded-rect',
        opacity: .22,
      })
    }
  } else if (support === 'arched') {
    const panelPadW = Math.min(.32, Math.max(.20, w - span * 2))
    for (const x of [-span, span] as const) {
      addContactShadow(root, {
        name: `${name}-panel-contact-ao`,
        width: panelPadW,
        depth: d * .82,
        y: .002,
        center: [x, 0],
        shape: 'rounded-rect',
        opacity: .22,
      })
    }
  } else {
    const legPad = Math.min(.32, Math.max(.16, (w / 2 - span * 1.035) * 1.9), Math.max(.16, (d / 2 - railZ * 1.055) * 1.9))
    for (const x of [-span, span] as const) for (const z of [-railZ, railZ] as const) {
      addContactShadow(root, {
        name: `${name}-foot-contact-ao`,
        width: legPad,
        depth: legPad,
        y: .002,
        center: [x * 1.035, z * 1.055],
        shape: 'ellipse',
        opacity: .22,
      })
    }
  }
  return { root, top, surfaceY, groundY }
}

/**
 * Chamfered multi-plank rectangular offering/dining table or footed low stand.
 * Adapts aprons, stretchers, and leg proportions cleanly across both tall tables
 * and low footed stands while keeping vertical legs grounded at exact groundY.
 */
export function addOfferingTable(parent: THREE.Object3D, options: OfferingTableOptions): StandBuildResult {
  const {
    name,
    width: w,
    depth: d,
    surfaceY,
    center = [0, 0],
    finish = 'honey',
    bevel = .016,
  } = options
  const groundY = resolveGroundY(parent, options)
  const h = Math.max(.03, surfaceY - groundY)
  const t = Math.min(options.thickness ?? THREE.MathUtils.clamp(h * .16, .036, .10), h * .55)
  const underside = h - t
  const seed = nameSeed(name)
  const palette = FINISHES[finish]
  const boardBase = options.color ?? palette.board
  const frameBase = options.frameColor ?? palette.frame
  const isLacquer = finish === 'lacquerRed'

  const root = new THREE.Group()
  root.name = `${name}-furniture`
  root.position.set(center[0], groundY, center[1])
  parent.add(root)
  root.userData.furniture = { authored: true, kind: 'offering-table', finish, surfaceY, groundY }

  const top = new THREE.Group()
  top.name = options.topName ?? `${name}-top`
  root.add(top)

  const defaultPlanks = d < .55 ? 1 : d < 1.15 ? 2 : d > 2.0 ? 4 : 3
  const plankCount = THREE.MathUtils.clamp(Math.round(options.planks ?? defaultPlanks), 1, 4)
  const useBreadboards = options.breadboardEnds ?? (w >= 1.1 && plankCount > 1)
  const endWidth = useBreadboards ? Math.min(.16, w * .07) : 0
  const run = w - endWidth * 2
  const phaseJitter = ((seed >>> 6) % 11 - 5) * .035

  const woodMat = (
    color: THREE.ColorRepresentation,
    axis: Axis,
    { scale = .76, strength = .36, roughness = .78 }: { scale?: number; strength?: number; roughness?: number } = {},
  ) => createStandMaterial('wood', {
    color,
    finish,
    axis,
    scale: isLacquer ? scale * .85 : scale,
    strength: isLacquer ? Math.min(.18, strength * .45) : strength,
    roughness: isLacquer ? Math.min(.58, roughness * .72) : roughness,
  })

  if (plankCount === 1) {
    const mat = woodMat(boardBase, w >= d ? 'x' : 'z', { scale: .68, strength: .36, roughness: .76 })
    addRoundedStandBox(name, 'top-board', [w, t, d], [0, h - t / 2, 0], mat, top, bevel, {
      offset: [.23 + phaseJitter, .11, -.19],
    })
  } else {
    const ratioSets: Record<number, readonly number[]> = {
      2: [.48, .52],
      3: [.30, .39, .31],
      4: [.23, .29, .22, .26],
    }
    const baseRatios = ratioSets[plankCount]!
    const recipes = plankCount === 4 ? PLANK_RECIPES_4 : PLANK_RECIPES_3
    const ratioShift = seed % plankCount
    const recipeShift = (seed >>> 3) % recipes.length
    const seamGap = Math.min(.005, d * .006)
    const seamMat = new THREE.MeshStandardMaterial({ color: tintWood(frameBase, -.005, .015, -.14), roughness: .94 })
    let cursorZ = -d / 2
    for (let i = 0; i < plankCount; i++) {
      const ratio = baseRatios[(i + ratioShift) % plankCount]!
      const plankDepth = d * ratio
      const zCenter = cursorZ + plankDepth / 2
      const recipe = recipes[(i + recipeShift) % recipes.length]!
      const mat = woodMat(tintWood(boardBase, recipe.dh, recipe.ds, recipe.dl), 'x', {
        scale: recipe.scale,
        strength: recipe.strength,
        roughness: recipe.roughness,
      })
      addRoundedStandBox(name, 'top-board', [run, t, Math.max(.02, plankDepth - seamGap)], [0, h - t / 2, zCenter], mat, top, bevel, {
        flip: recipe.flip,
        offset: [recipe.offset[0] + phaseJitter, recipe.offset[1], recipe.offset[2] - phaseJitter * .6],
      })
      cursorZ += plankDepth
      if (i < plankCount - 1) {
        const seamH = Math.max(.012, t - .009)
        const seam = addStandMesh(name, 'top-seam', new THREE.BoxGeometry(Math.max(.02, run - .008), seamH, .009), seamMat, [0, h - .005 - seamH / 2, cursorZ], top)
        seam.castShadow = false
        seam.userData.toonSurface = { outline: false }
      }
    }
    if (useBreadboards) {
      for (const side of [-1, 1] as const) {
        const isLeft = side < 0
        const endMat = woodMat(
          tintWood(options.color ?? palette.end, isLeft ? -.004 : .005, isLeft ? .018 : -.012, isLeft ? -.020 : .014),
          'z',
          { scale: isLeft ? .64 : .86, strength: isLeft ? .40 : .35, roughness: isLeft ? .76 : .80 },
        )
        addRoundedStandBox(name, 'breadboard-end', [endWidth, t, d], [side * (w - endWidth) / 2, h - t / 2, 0], endMat, top, bevel, {
          flip: isLeft ? 'none' : 'y',
          offset: isLeft ? [.16, .24, .36 + phaseJitter] : [-.21, -.28, -.42 - phaseJitter],
        })
      }
    }
  }

  const legSize = Math.min(
    options.legThickness ?? THREE.MathUtils.clamp(Math.min(w, d) * .082, .042, .135),
    w * .22,
    d * .22,
  )
  const insetX = options.legInset ?? Math.min(w * .14, Math.max(legSize * .85, .05))
  const insetZ = options.legInset ?? Math.min(d * .14, Math.max(legSize * .85, .05))
  const legX = Math.max(legSize * .6, w / 2 - insetX - legSize / 2)
  const legZ = Math.max(legSize * .6, d / 2 - insetZ - legSize / 2)
  const legHeight = underside + Math.min(t * .35, .012)
  const legMats = [
    woodMat(tintWood(frameBase, -.004, .016, -.018), 'y', { scale: .64, strength: .44, roughness: .82 }),
    woodMat(tintWood(frameBase, .004, -.010, .016), 'y', { scale: .88, strength: .39, roughness: .78 }),
  ]
  const legFlips: readonly Flip[] = ['none', 'y', 'x', 'z']
  let legIdx = 0
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      addRoundedStandBox(
        name,
        'leg',
        [legSize, legHeight, legSize],
        [sx * legX, legHeight / 2, sz * legZ],
        legMats[legIdx % 2]!,
        root,
        Math.min(.016, legSize * .22, legHeight * .22),
        { flip: legFlips[legIdx % 4]! },
      )
      legIdx++
    }
  }

  const useApron = options.apron ?? (underside >= .08)
  if (useApron) {
    const apronH = Math.min(THREE.MathUtils.clamp(underside * .24, .030, .12), underside * .55)
    const apronThick = Math.min(legSize * .62, .065)
    const apronY = underside - apronH / 2
    for (const [idx, sz] of ([-1, 1] as const).entries()) {
      const mat = woodMat(
        tintWood(frameBase, idx === 1 ? .004 : -.004, idx === 1 ? -.008 : .014, idx === 1 ? .012 : -.018),
        'x',
        { scale: idx === 1 ? .58 : .82, strength: .42, roughness: .80 },
      )
      addRoundedStandBox(name, 'apron', [legX * 2, apronH, apronThick], [0, apronY, sz * legZ], mat, root, .012, {
        flip: idx === 1 ? 'none' : 'y',
        offset: [idx === 1 ? .34 + phaseJitter : -.31 - phaseJitter, .13, -.14],
      })
    }
    for (const [idx, sx] of ([-1, 1] as const).entries()) {
      const mat = woodMat(
        tintWood(frameBase, idx === 0 ? -.004 : .004, .010, idx === 0 ? -.012 : .012),
        'z',
        { scale: idx === 0 ? .66 : .90, strength: .40, roughness: .80 },
      )
      addRoundedStandBox(name, 'side-apron', [apronThick, apronH, legZ * 2], [sx * legX, apronY, 0], mat, root, .012, {
        flip: idx === 0 ? 'none' : 'y',
        offset: [.14, -.12, idx === 0 ? .28 : -.32],
      })
    }
  }

  const useStretchers = options.stretchers ?? (underside >= .24)
  if (useStretchers && underside >= .12) {
    const stretcherH = Math.min(THREE.MathUtils.clamp(legSize * .52, .028, .072), underside * .22)
    const stretcherThick = Math.min(legSize * .56, .068)
    const stretcherY = Math.max(stretcherH / 2 + .018, underside * .28)
    for (const [idx, sx] of ([-1, 1] as const).entries()) {
      const mat = woodMat(tintWood(frameBase, idx === 0 ? -.003 : .003, .010, idx === 0 ? -.012 : .014), 'z', {
        scale: .74,
        strength: .41,
        roughness: .81,
      })
      addRoundedStandBox(name, 'side-stretcher', [stretcherThick, stretcherH, legZ * 2], [sx * legX, stretcherY, 0], mat, root, .010, {
        flip: idx === 0 ? 'none' : 'y',
        offset: [.13, -.15, idx === 0 ? .26 : -.29],
      })
    }
    const crossMat = woodMat(tintWood(frameBase, -.003, .012, -.008), 'x', { scale: .76, strength: .40, roughness: .82 })
    addRoundedStandBox(name, 'lower-stretcher', [legX * 2, stretcherH * .95, stretcherThick], [0, stretcherY, 0], crossMat, root, .010, {
      offset: [-.28 + phaseJitter, .14, .17],
    })
  }

  if (options.contactShadow ?? name !== 'tamagushi-stand') {
    addContactShadow(root, {
      prefix: name,
      width: w * .96,
      depth: d * .96,
      y: .0018,
      shape: 'rounded-rect',
      opacity: .22,
    })
    const legPad = Math.min(
      legSize * 2.2,
      Math.max(legSize, (w / 2 - legX) * 1.95),
      Math.max(legSize, (d / 2 - legZ) * 1.95),
    )
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        addContactShadow(root, {
          name: `${name}-foot-contact-ao`,
          width: legPad,
          depth: legPad,
          y: .002,
          center: [sx * legX, sz * legZ],
          shape: 'ellipse',
          opacity: .20,
        })
      }
    }
  }

  return { root, top, surfaceY, groundY }
}

/**
 * Turned round or oval low wooden table with chamfered rim, recessed apron,
 * turned vertical-grain (`axis: 'y'`) legs, and optional cross-stretchers.
 */
export function addRoundLowTable(parent: THREE.Object3D, options: RoundLowTableOptions): StandBuildResult {
  const {
    name,
    radius: rx,
    surfaceY,
    center = [0, 0],
    finish = 'honey',
  } = options
  const rz = options.radiusZ ?? rx
  const scaleZ = rz / rx
  const groundY = resolveGroundY(parent, options)
  const h = Math.max(.03, surfaceY - groundY)
  const t = Math.min(options.thickness ?? THREE.MathUtils.clamp(h * .22, .030, .085), h * .55)
  const underside = h - t
  const segments = Math.max(20, Math.round(options.segments ?? 40))
  const palette = FINISHES[finish]
  const boardBase = options.color ?? palette.board
  const frameBase = options.frameColor ?? palette.frame
  const isLacquer = finish === 'lacquerRed'

  const root = new THREE.Group()
  root.name = `${name}-furniture`
  root.position.set(center[0], groundY, center[1])
  parent.add(root)
  root.userData.furniture = { authored: true, kind: 'round-low-table', finish, surfaceY, groundY }

  const top = new THREE.Group()
  top.name = options.topName ?? `${name}-top`
  root.add(top)

  const woodMat = (
    color: THREE.ColorRepresentation,
    axis: Axis,
    { scale = .72, strength = .36, roughness = .76 }: { scale?: number; strength?: number; roughness?: number } = {},
  ) => createStandMaterial('wood', {
    color,
    finish,
    axis,
    scale: isLacquer ? scale * .85 : scale,
    strength: isLacquer ? Math.min(.18, strength * .45) : strength,
    roughness: isLacquer ? Math.min(.56, roughness * .72) : roughness,
  })

  const topBevel = Math.min(.018, t * .28, rx * .08)
  const topProfile = [
    new THREE.Vector2(0, underside),
    new THREE.Vector2(Math.max(.01, rx - topBevel * 1.4), underside),
    new THREE.Vector2(Math.max(.01, rx - topBevel * .35), underside + topBevel * .70),
    new THREE.Vector2(rx, underside + t * .52),
    new THREE.Vector2(Math.max(.01, rx - topBevel * .20), h - topBevel * .62),
    new THREE.Vector2(Math.max(.01, rx - topBevel), h),
    new THREE.Vector2(0, h),
  ]
  const topGeom = new THREE.LatheGeometry(topProfile, segments)
  const topMat = woodMat(boardBase, 'x', { scale: .62, strength: .36, roughness: .75 })
  const topMesh = addStandMesh(name, 'top-board', topGeom, topMat, [0, 0, 0], top)
  topMesh.scale.set(1, 1, scaleZ)

  const useApron = options.apron ?? (underside >= .06)
  if (useApron) {
    const apronH = Math.min(THREE.MathUtils.clamp(underside * .30, .024, .092), underside * .56)
    const apronR = rx * .79
    const apronBevel = Math.min(.008, apronH * .22)
    const apronY0 = underside - apronH
    const apronProfile = [
      new THREE.Vector2(Math.max(.01, apronR - .035), apronY0),
      new THREE.Vector2(Math.max(.01, apronR - apronBevel), apronY0),
      new THREE.Vector2(apronR, apronY0 + apronBevel),
      new THREE.Vector2(apronR, underside + .004),
      new THREE.Vector2(Math.max(.01, apronR - .035), underside + .004),
    ]
    const apronMat = woodMat(tintWood(frameBase, -.003, .012, -.016), 'x', { scale: .74, strength: .42, roughness: .81 })
    const apronMesh = addStandMesh(name, 'apron', new THREE.LatheGeometry(apronProfile, segments), apronMat, [0, 0, 0], root)
    apronMesh.scale.set(1, 1, scaleZ)
  }

  const legCount = Math.max(3, Math.round(options.legCount ?? 4))
  const legR = Math.min(
    options.legRadius ?? THREE.MathUtils.clamp(Math.min(rx, rz) * .068, .022, .065),
    Math.min(rx, rz) * .16,
  )
  const legH = underside + Math.min(t * .30, .012)
  const legProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(legR * .74, 0),
    new THREE.Vector2(legR * .82, Math.min(.012, legH * .14)),
    new THREE.Vector2(legR * .88, legH * .38),
    new THREE.Vector2(legR, legH * .86),
    new THREE.Vector2(legR * .94, legH),
    new THREE.Vector2(0, legH),
  ]
  const legMats = [
    woodMat(tintWood(frameBase, -.004, .016, -.018), 'y', { scale: .68, strength: .44, roughness: .82 }),
    woodMat(tintWood(frameBase, .004, -.010, .016), 'y', { scale: .92, strength: .40, roughness: .79 }),
  ]
  const legCoords: [number, number][] = []
  for (let i = 0; i < legCount; i++) {
    const angle = (i * Math.PI * 2) / legCount + Math.PI / legCount
    const lx = Math.cos(angle) * rx * .68
    const lz = Math.sin(angle) * rz * .68
    legCoords.push([lx, lz])
    const legGeom = new THREE.LatheGeometry(legProfile, 16)
    const mesh = addStandMesh(name, 'leg', legGeom, legMats[i % 2]!, [lx, 0, lz], root)
    mesh.rotation.y = angle
  }

  const useStretchers = options.stretchers ?? (underside >= .22)
  if (useStretchers && underside >= .12) {
    const stretcherH = Math.min(THREE.MathUtils.clamp(legR * .85, .022, .052), underside * .22)
    const stretcherY = Math.max(stretcherH / 2 + .016, underside * .30)
    const stretcherMat = woodMat(tintWood(frameBase, -.003, .010, -.010), 'x', { scale: .78, strength: .41, roughness: .82 })
    if (legCount % 2 === 0) {
      for (let i = 0; i < legCount / 2; i++) {
        const [ax, az] = legCoords[i]!
        const [bx, bz] = legCoords[i + legCount / 2]!
        const span = Math.hypot(bx - ax, bz - az)
        const bar = addRoundedStandBox(name, 'stretcher', [span, stretcherH, stretcherH * .9], [0, stretcherY, 0], stretcherMat, root, .008)
        bar.rotation.y = -Math.atan2(bz - az, bx - ax)
      }
    } else {
      for (const [lx, lz] of legCoords) {
        const span = Math.hypot(lx, lz)
        const bar = addRoundedStandBox(name, 'stretcher', [span, stretcherH, stretcherH * .9], [lx * .5, stretcherY, lz * .5], stretcherMat, root, .008)
        bar.rotation.y = -Math.atan2(lz, lx)
      }
    }
  }

  addContactShadow(root, {
    prefix: name,
    width: rx * 1.94,
    depth: rz * 1.94,
    y: .0018,
    shape: 'ellipse',
    opacity: .23,
  })
  const legPad = Math.min(legR * 2.8, rx * .30, rz * .30)
  for (const [lx, lz] of legCoords) {
    addContactShadow(root, {
      name: `${name}-foot-contact-ao`,
      width: legPad,
      depth: legPad,
      y: .002,
      center: [lx, lz],
      shape: 'ellipse',
      opacity: .18,
    })
  }

  return { root, top, surfaceY, groundY }
}

/**
 * Chamfered low presentation pad, lipped wooden tray, twin U-cradle, or
 * continuous concave grooved rest supporting props at exact surfaceY.
 */
export function addObjectCradle(parent: THREE.Object3D, options: ObjectCradleOptions): StandBuildResult {
  const {
    name,
    width: w,
    depth: d,
    center = [0, 0],
    kind = 'wood',
    finish = 'honey',
    grooveAxis = 'x',
    applySurface = true,
  } = options
  const groundY = resolveGroundY(parent, options)
  const surfaceY = typeof options.surfaceY === 'number' && Number.isFinite(options.surfaceY)
    ? options.surfaceY
    : groundY + Math.max(.006, options.height ?? .032)
  const h = Math.max(.006, surfaceY - groundY)
  const style: ObjectCradleStyle = options.style ?? (options.groove ? 'groove' : options.lip ? 'tray' : 'pad')
  const mainAxis: Axis = options.axis ?? (w >= d ? 'x' : 'z')
  const bevel = options.bevel ?? Math.min(.012, Math.min(w, d) * .08, h * .30)
  const seed = nameSeed(name)
  const phaseJitter = ((seed >>> 5) % 9 - 4) * .03

  const root = new THREE.Group()
  root.name = `${name}-cradle`
  root.position.set(center[0], groundY, center[1])
  parent.add(root)
  root.userData.furniture = { authored: true, kind: 'object-cradle', style, surfaceKind: kind, surfaceY, groundY }

  const top = new THREE.Group()
  top.name = options.topName ?? `${name}-top`
  root.add(top)

  const baseColor = options.color ?? (kind === 'wood' ? FINISHES[finish].board : SURFACE_PRESETS[kind].main)
  const accentColor = options.accentColor ?? (kind === 'wood' ? FINISHES[finish].frame : SURFACE_PRESETS[kind].trim)
  const makeMat = (color: THREE.ColorRepresentation, axis: Axis, dl = 0) => createStandMaterial(kind, {
    color: dl === 0 ? color : tintWood(color, 0, 0, dl),
    finish,
    axis,
    roughness: options.roughness,
    scale: options.surfaceScale,
    strength: options.surfaceStrength,
    applySurface,
  })

  if (style === 'pad' || style === 'tray') {
    const footed = options.footed ?? (kind === 'wood' && h >= .045)
    const footH = footed ? Math.min(h * .40, .032) : 0
    const bodyH = Math.max(.005, h - footH)
    const hasInset = options.insetColor !== undefined
    const insetH = hasInset ? Math.min(.005, bodyH * .32) : 0
    const bedH = Math.max(.004, bodyH - insetH)
    const lipT = style === 'tray'
      ? (options.lipThickness ?? THREE.MathUtils.clamp(Math.min(w, d) * .055, .012, .036))
      : 0

    if (footed && footH >= .006) {
      if (style === 'tray') {
        const footSize = Math.min(.058, Math.max(.022, Math.min(w, d) * .09))
        const fx = Math.max(footSize * .6, w / 2 - footSize * 1.1)
        const fz = Math.max(footSize * .6, d / 2 - footSize * 1.1)
        const footMat = makeMat(accentColor, 'y')
        for (const sx of [-1, 1] as const) {
          for (const sz of [-1, 1] as const) {
            addRoundedStandBox(name, 'foot', [footSize, footH + .003, footSize], [sx * fx, (footH + .003) / 2, sz * fz], footMat, root, Math.min(.008, footH * .28))
          }
        }
      } else {
        const plinthMat = makeMat(accentColor, mainAxis)
        addRoundedStandBox(name, 'foot-plinth', [w * .88, footH + .003, d * .88], [0, (footH + .003) / 2, 0], plinthMat, root, Math.min(.010, footH * .30))
      }
    }

    const bedMat = makeMat(baseColor, mainAxis)
    addRoundedStandBox(name, 'bed', [w, bedH, d], [0, footH + bedH / 2, 0], bedMat, top, bevel, {
      offset: [.19 + phaseJitter, .08, -.14],
    })

    if (hasInset) {
      const insetMargin = style === 'tray' ? lipT + .006 : Math.min(.035, Math.min(w, d) * .08)
      const iw = Math.max(.02, w - insetMargin * 2)
      const id = Math.max(.02, d - insetMargin * 2)
      const insetMat = createStandMaterial(options.insetKind ?? 'fabric', {
        color: options.insetColor,
        finish,
        axis: mainAxis,
        applySurface,
      })
      addRoundedStandBox(name, 'inset', [iw, insetH, id], [0, h - insetH / 2, 0], insetMat, top, Math.min(.004, insetH * .45))
    }

    if (style === 'tray') {
      const lipH = options.lipHeight ?? THREE.MathUtils.clamp(Math.min(w, d) * .045, .010, .028)
      const railBottom = Math.max(footH, h - Math.min(.014, bodyH * .50))
      const railH = (h + lipH) - railBottom
      const railY = railBottom + railH / 2
      const railBevel = Math.min(.008, lipT * .32, railH * .30)
      const railXMat = makeMat(accentColor, 'x', .018)
      const railZMat = makeMat(accentColor, 'z', -.012)
      for (const [idx, sz] of ([-1, 1] as const).entries()) {
        addRoundedStandBox(name, 'lip-rail', [w, railH, lipT], [0, railY, sz * (d - lipT) / 2], railXMat, root, railBevel, {
          flip: idx === 0 ? 'none' : 'y',
          offset: [.22 + phaseJitter, .07, idx === 0 ? .13 : -.15],
        })
      }
      const sideLen = Math.max(.01, d - lipT * 2 + .004)
      for (const [idx, sx] of ([-1, 1] as const).entries()) {
        addRoundedStandBox(name, 'lip-rail', [lipT, railH, sideLen], [sx * (w - lipT) / 2, railY, 0], railZMat, root, railBevel, {
          flip: idx === 0 ? 'none' : 'y',
          offset: [idx === 0 ? .11 : -.13, .06, .19 - phaseJitter],
        })
      }
    }
  } else if (style === 'groove') {
    const along = grooveAxis === 'x' ? w : d
    const across = grooveAxis === 'x' ? d : w
    const grooveD = options.grooveDepth ?? THREE.MathUtils.clamp(across * .14, .008, .032)
    const grooveW = THREE.MathUtils.clamp(options.grooveWidth ?? across * .46, across * .14, across * .78)
    const geom = createGroovedSectionGeometry(across, along, 0, h, grooveD, grooveW, bevel, grooveAxis)
    const mat = makeMat(baseColor, grooveAxis)
    addStandMesh(name, 'groove-block', geom, mat, [0, 0, 0], top)
  } else {
    // Twin upright U-cradle saddles mounted on a chamfered base board.
    const baseH = Math.max(.008, Math.min(h * .42, .042))
    const baseMat = makeMat(baseColor, grooveAxis)
    addRoundedStandBox(name, 'base', [w, baseH, d], [0, baseH / 2, 0], baseMat, root, Math.min(bevel, baseH * .32), {
      offset: [.15 + phaseJitter, .06, -.12],
    })
    const along = grooveAxis === 'x' ? w : d
    const across = grooveAxis === 'x' ? d : w
    const saddleThick = THREE.MathUtils.clamp(along * .14, .022, .065)
    const saddleSpan = across * .86
    const grooveD = options.grooveDepth ?? THREE.MathUtils.clamp(saddleSpan * .18, .012, .042)
    const grooveW = THREE.MathUtils.clamp(options.grooveWidth ?? saddleSpan * .48, saddleSpan * .18, saddleSpan * .76)
    const saddleBottom = Math.max(0, baseH * .65)
    const saddleMat = makeMat(accentColor, 'y', .012)
    const offsetDist = Math.max(saddleThick * .75, along * .34)
    for (const side of [-1, 1] as const) {
      const geom = createGroovedSectionGeometry(
        saddleSpan,
        saddleThick,
        saddleBottom,
        h,
        grooveD,
        grooveW,
        Math.min(.006, saddleThick * .22),
        grooveAxis,
      )
      const pos: XYZ = grooveAxis === 'x' ? [side * offsetDist, 0, 0] : [0, 0, side * offsetDist]
      addStandMesh(name, 'saddle', geom, saddleMat, pos, top)
    }
  }

  addContactShadow(root, {
    prefix: name,
    width: w,
    depth: d,
    y: Math.min(.0018, h * .25),
    shape: 'rounded-rect',
    opacity: .22,
  })

  return { root, top, surfaceY, groundY }
}

/**
 * Chamfered multi-tier rectangular shrine plinth or turned cylindrical/oval low pedestal
 * with base/cap mouldings and procedural stone, wood, or ceramic craft surfaces.
 */
export function addSteppedPedestal(parent: THREE.Object3D, options: SteppedPedestalOptions): StandBuildResult {
  const {
    name,
    center = [0, 0],
    kind = 'stone',
    finish = 'honey',
    moulding = true,
    applySurface = true,
  } = options
  const groundY = resolveGroundY(parent, options)
  const explicitTiers = Array.isArray(options.tiers) && options.tiers.length > 0 ? options.tiers : undefined
  const inferredShape: 'rect' | 'round' | 'oval' = options.shape ?? (
    options.radius !== undefined
      ? (options.radiusZ !== undefined && Math.abs(options.radiusZ - options.radius) > 1e-4 ? 'oval' : 'round')
      : 'rect'
  )

  let surfaceY: number
  let h: number
  if (typeof options.surfaceY === 'number' && Number.isFinite(options.surfaceY)) {
    surfaceY = options.surfaceY
    h = Math.max(.02, surfaceY - groundY)
  } else if (explicitTiers) {
    h = Math.max(.02, explicitTiers.reduce((sum, tier) => sum + Math.max(.005, tier.height), 0))
    surfaceY = groundY + h
  } else {
    h = Math.max(.02, options.height ?? .24)
    surfaceY = groundY + h
  }

  const root = new THREE.Group()
  root.name = `${name}-pedestal`
  root.position.set(center[0], groundY, center[1])
  parent.add(root)
  root.userData.furniture = { authored: true, kind: 'stepped-pedestal', shape: inferredShape, surfaceKind: kind, surfaceY, groundY }

  const top = new THREE.Group()
  top.name = options.topName ?? `${name}-top`
  root.add(top)

  const mainColor = options.color ?? (kind === 'wood' ? FINISHES[finish].board : SURFACE_PRESETS[kind].main)
  const trimColor = options.trimColor ?? (kind === 'wood' ? FINISHES[finish].frame : SURFACE_PRESETS[kind].trim)
  const makeMat = (color: THREE.ColorRepresentation, axis: Axis, dl = 0) => createStandMaterial(kind, {
    color: dl === 0 ? color : tintWood(color, 0, 0, dl),
    finish,
    axis,
    roughness: options.roughness,
    scale: options.surfaceScale,
    strength: options.surfaceStrength,
    applySurface,
  })

  if (inferredShape === 'rect') {
    const baseW = options.width ?? (options.radius ? options.radius * 2 : 1.0)
    const baseD = options.depth ?? (options.radiusZ ? options.radiusZ * 2 : baseW)
    const tiers: { w: number; d: number; h: number; bevel: number; color: THREE.ColorRepresentation }[] = []

    if (explicitTiers) {
      const rawTotal = explicitTiers.reduce((sum, tier) => sum + Math.max(.005, tier.height), 0)
      const scaleY = h / rawTotal
      explicitTiers.forEach((tier, idx) => {
        const w = tier.width ?? (tier.radius ? tier.radius * 2 : baseW)
        const d = tier.depth ?? (tier.radiusZ ? tier.radiusZ * 2 : tier.width ?? baseD)
        const th = Math.max(.005, tier.height) * scaleY
        tiers.push({
          w,
          d,
          h: th,
          bevel: tier.bevel ?? options.bevel ?? Math.min(.018, th * .24, Math.min(w, d) * .05),
          color: tier.color ?? (idx === 0 || idx === explicitTiers.length - 1 ? trimColor : mainColor),
        })
      })
    } else {
      const count = THREE.MathUtils.clamp(Math.round(typeof options.tiers === 'number' ? options.tiers : 2), 1, 8)
      if (count === 1) {
        if (moulding && h >= .08) {
          const baseH = h * .24
          const capH = h - baseH
          tiers.push(
            { w: baseW, d: baseD, h: baseH, bevel: options.bevel ?? Math.min(.016, baseH * .24), color: trimColor },
            { w: baseW * .94, d: baseD * .94, h: capH, bevel: options.bevel ?? Math.min(.018, capH * .22), color: mainColor },
          )
        } else {
          tiers.push({ w: baseW, d: baseD, h, bevel: options.bevel ?? Math.min(.016, h * .24), color: mainColor })
        }
      } else {
        // Architectural stepped plinth: generous base footing, stepped shaft tiers, and subtle cap slab.
        const rawWeights: number[] = []
        for (let i = 0; i < count; i++) {
          if (i === 0) rawWeights.push(1.25)
          else if (i === count - 1) rawWeights.push(moulding ? .78 : 1.0)
          else rawWeights.push(1.0)
        }
        const weightSum = rawWeights.reduce((a, b) => a + b, 0)
        for (let i = 0; i < count; i++) {
          const frac = i / (count - 1)
          let scaleXZ = 1 - frac * .18
          if (moulding && count >= 3 && i === count - 1) scaleXZ = Math.min(.96, scaleXZ + .05)
          const th = (h * rawWeights[i]!) / weightSum
          const tw = baseW * scaleXZ
          const td = baseD * scaleXZ
          const isAccent = i === 0 || (moulding && i === count - 1)
          tiers.push({
            w: tw,
            d: td,
            h: th,
            bevel: options.bevel ?? Math.min(.018, th * .24, Math.min(tw, td) * .05),
            color: isAccent ? trimColor : tintWood(mainColor, 0, 0, (i % 2 === 0 ? .012 : -.010)),
          })
        }
      }
    }

    let cursorY = 0
    tiers.forEach((tier, idx) => {
      const isTop = idx === tiers.length - 1
      const owner = isTop ? top : root
      const axis: Axis = kind === 'wood' && tier.h > Math.min(tier.w, tier.d) * .75 ? 'y' : tier.w >= tier.d ? 'x' : 'z'
      const mat = makeMat(tier.color, axis, isTop ? .016 : 0)
      addRoundedStandBox(
        name,
        isTop ? 'cap' : `tier-${idx}`,
        [tier.w, tier.h, tier.d],
        [0, cursorY + tier.h / 2, 0],
        mat,
        owner,
        tier.bevel,
        { offset: [(idx - .5) * .17, idx * .11, -.13 * (idx % 2 ? 1 : -1)] },
      )
      cursorY += tier.h
    })
    const baseTier = tiers[0]
    addContactShadow(root, {
      prefix: name,
      width: baseTier ? baseTier.w : baseW,
      depth: baseTier ? baseTier.d : baseD,
      y: .0018,
      shape: 'rounded-rect',
      opacity: .24,
    })
  } else {
    const rx = options.radius ?? (options.width ? options.width / 2 : .45)
    const rz = options.radiusZ ?? (options.depth ? options.depth / 2 : rx)
    const scaleZ = rz / rx
    const segments = Math.max(20, Math.round(options.segments ?? 44))
    let baseShadowW = rx * 2
    let baseShadowD = rz * 2

    if (explicitTiers) {
      const rawTotal = explicitTiers.reduce((sum, tier) => sum + Math.max(.005, tier.height), 0)
      const scaleY = h / rawTotal
      let cursorY = 0
      explicitTiers.forEach((tier, idx) => {
        const isTop = idx === explicitTiers.length - 1
        const owner = isTop ? top : root
        const tr = tier.radius ?? (tier.width ? tier.width / 2 : rx)
        const trz = tier.radiusZ ?? (tier.depth ? tier.depth / 2 : tr * scaleZ)
        if (idx === 0) {
          baseShadowW = tr * 2
          baseShadowD = trz * 2
        }
        const th = Math.max(.005, tier.height) * scaleY
        const tb = Math.min(tier.bevel ?? options.bevel ?? .012, th * .28, tr * .12)
        const pts = [
          new THREE.Vector2(0, cursorY),
          new THREE.Vector2(Math.max(.005, tr - tb), cursorY),
          new THREE.Vector2(tr, cursorY + tb),
          new THREE.Vector2(tr, cursorY + th - tb),
          new THREE.Vector2(Math.max(.005, tr - tb), cursorY + th),
          new THREE.Vector2(0, cursorY + th),
        ]
        const mat = makeMat(tier.color ?? (idx === 0 || isTop ? trimColor : mainColor), kind === 'wood' ? 'y' : 'x')
        const mesh = addStandMesh(name, isTop ? 'cap' : `tier-${idx}`, new THREE.LatheGeometry(pts, segments), mat, [0, 0, 0], owner)
        mesh.scale.set(1, 1, trz / tr)
        cursorY += th
      })
    } else {
      const tierCount = THREE.MathUtils.clamp(Math.round(typeof options.tiers === 'number' ? options.tiers : 2), 1, 6)
      const capH = Math.min(h * .30, Math.max(.016, h * .20))
      const baseH = Math.min((h - capH) * .45, Math.max(.014, h * .22))
      const capBottom = h - capH
      const b = Math.min(options.bevel ?? .012, capH * .28, baseH * .28, rx * .08)
      const waistR = rx * (moulding ? .88 : .94)
      const capR = rx * (moulding ? .95 : .93)

      const bodyPts: THREE.Vector2[] = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(Math.max(.005, rx - b), 0),
        new THREE.Vector2(rx, b),
        new THREE.Vector2(rx, Math.max(b + .002, baseH - b)),
        new THREE.Vector2(Math.max(.005, rx - b), baseH),
      ]
      if (capBottom > baseH + .004) {
        bodyPts.push(new THREE.Vector2(waistR, baseH + Math.min(.012, (capBottom - baseH) * .25)))
        if (tierCount >= 3 && capBottom - baseH > .04) {
          const midY = (baseH + capBottom) * .5
          bodyPts.push(
            new THREE.Vector2(waistR, midY - .008),
            new THREE.Vector2(waistR * 1.045, midY),
            new THREE.Vector2(waistR, midY + .008),
          )
        }
        bodyPts.push(new THREE.Vector2(waistR, capBottom))
      }
      bodyPts.push(new THREE.Vector2(0, capBottom))

      const bodyMat = makeMat(mainColor, 'y')
      const bodyMesh = addStandMesh(name, 'shaft', new THREE.LatheGeometry(bodyPts, segments), bodyMat, [0, 0, 0], root)
      bodyMesh.scale.set(1, 1, scaleZ)

      const capPts: THREE.Vector2[] = [
        new THREE.Vector2(0, capBottom),
        new THREE.Vector2(waistR, capBottom),
        new THREE.Vector2(capR, capBottom + Math.min(b * 1.4, capH * .38)),
        new THREE.Vector2(capR, h - b),
        new THREE.Vector2(Math.max(.005, capR - b), h),
        new THREE.Vector2(0, h),
      ]
      const capMat = makeMat(trimColor, kind === 'wood' ? 'x' : 'y', .018)
      const capMesh = addStandMesh(name, 'cap', new THREE.LatheGeometry(capPts, segments), capMat, [0, 0, 0], top)
      capMesh.scale.set(1, 1, scaleZ)
    }

    addContactShadow(root, {
      prefix: name,
      width: baseShadowW,
      depth: baseShadowD,
      y: .0018,
      shape: 'ellipse',
      opacity: .24,
    })
  }

  return { root, top, surfaceY, groundY }
}
