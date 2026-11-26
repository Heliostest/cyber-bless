import * as THREE from 'three'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

type XYZ = [number, number, number]
type Axis = 'x' | 'y' | 'z'
type Flip = 'none' | 'x' | 'y' | 'z'
export type TimberSupport = 'trestle' | 'arched' | 'joined'
export type TimberFinish = 'honey' | 'birch' | 'chestnut'

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
  support?: TimberSupport
  finish?: TimberFinish
}

const FINISHES = {
  honey: { board: 0xbd9463, frame: 0x8d6742, end: 0xa77e4f, peg: 0xd4b080 },
  birch: { board: 0xc4a47a, frame: 0x997d58, end: 0xb19067, peg: 0xd6ba8e },
  chestnut: { board: 0xae8356, frame: 0x7d593d, end: 0x976f48, peg: 0xc89e6b },
} satisfies Record<TimberFinish, Record<string, number>>

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

function tintWood(hex: number, dh: number, ds: number, dl: number): THREE.Color {
  return new THREE.Color(hex).offsetHSL(dh, ds, dl)
}

function flipGeometry(geom: THREE.BufferGeometry, flip: Flip) {
  if (flip === 'x') geom.rotateX(Math.PI)
  else if (flip === 'y') geom.rotateY(Math.PI)
  else if (flip === 'z') geom.rotateZ(Math.PI)
}

/**
 * Original, texture-free timber furniture. No third-party meshes are embedded.
 * Dimensions come from each scene so the craft, contact plane and cue anchors
 * remain unchanged. Everything is a child of root and uses normal tree disposal.
 */
export function addCraftTable(parent: THREE.Object3D, options: CraftTableOptions) {
  const { name, width: w, depth: d, surfaceY, thickness: t, center = [0, 0],
    groundY = 0, support = 'trestle', finish = 'honey' } = options
  const h = surfaceY - groundY, underside = h - t, colors = FINISHES[finish], seed = nameSeed(name)
  const root = new THREE.Group(); root.name = `${name}-furniture`
  root.position.set(center[0], groundY, center[1]); parent.add(root)
  root.userData.furniture = { authored: true, support, finish, surfaceY }
  const wood = (
    color: THREE.ColorRepresentation,
    axis: Axis,
    { scale = .8, strength = .38, roughness = .78 }: { scale?: number; strength?: number; roughness?: number } = {},
  ) => applyCraftSurface(new THREE.MeshStandardMaterial({ color, roughness }), { kind: 'wood', axis, scale, strength })
  const peg = wood(colors.peg, 'y', { scale: 1.14, strength: .34, roughness: .8 })
  const seamMat = new THREE.MeshStandardMaterial({ color: tintWood(colors.frame, -.005, .015, -.14), roughness: .94 })
  const add = (part: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: XYZ, owner: THREE.Object3D = root) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = `${name}-${part}`
    mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; owner.add(mesh)
    return mesh
  }
  const box = (
    part: string,
    size: XYZ,
    p: XYZ,
    mat: THREE.Material,
    owner: THREE.Object3D = root,
    radius = .025,
    { flip = 'none', offset }: { flip?: Flip; offset?: XYZ } = {},
  ) => {
    const geom = new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(n => n / 3)))
    flipGeometry(geom, flip)
    if (offset) {
      // Shift local-space vertices and compensate on mesh.position so world bounds stay
      // identical while each board/rail samples a distinct region of 3D wood grain & knots.
      geom.translate(offset[0], offset[1], offset[2])
      return add(part, geom, mat, [p[0] - offset[0], p[1] - offset[1], p[2] - offset[2]], owner)
    }
    return add(part, geom, mat, p, owner)
  }
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
      beam('leg', [x * 1.035, .015, z * 1.055], [x, underside, z], .15, .15, legMats[legIdx % 2]!, legFlips[legIdx % 4]!)
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
        tintWood(colors.frame, isLeft ? -.004 : .004, .012, isLeft ? -.014 : .016),
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
  return { root, top, surfaceY }
}
