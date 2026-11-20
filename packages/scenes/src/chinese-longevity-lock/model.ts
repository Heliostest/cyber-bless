import * as THREE from 'three'
import { capsuleBetween, closedOutline, creasedSolid, mergeSolids, profiledSolid, roundedRect, roundedSlab, shellGeometry, tubeSolid, type ProfileRing } from './geometry'
import { createLockToonFactory, createOutlineShell } from './toon'

// Product-original lock necklace and display furniture, not a museum replica.
// The curved plate outline, its rim and dome, the two geometric "长命" strokes,
// the five-petal drops, the cord layout, the board, the case and the stand are
// product art. Colours are art parameters, not material or craft claims.
export const LOCK_COLORS = {
  silver: { lit: 0xeaf1f6, base: 0xccd7e1, shade: 0x8b9db0, horizon: 0x9fb0c2, line: 0x4a5968, smallLine: 0x5f6f80 },
  relief: { lit: 0x8a9dae, base: 0x55697b, shade: 0x33414f, horizon: 0x4a5b6b },
  cord: { lit: 0xec975f, base: 0xcd6b34, shade: 0x8f4320, line: 0x5c240e },
  velvet: { lit: 0x5f2534, base: 0x481b28, shade: 0x2d0f18, sheen: 0x2c121a, line: 0x1b070d },
  wood: { lit: 0x6b4732, base: 0x533627, shade: 0x352219, line: 0x1d120c },
  stand: { lit: 0x73625a, base: 0x5c4d45, shade: 0x3d332e, line: 0x221b17 },
} as const

/** Layout in world units; the courtyard floor is y = 0. */
export const LOCK_LAYOUT = {
  stand: { x: -1.06, z: .30, width: 1.70, depth: 2.06, top: .16 },
  case: { x: .90, z: 0, width: 1.84, depth: 2.20, wall: .09, base: .06, top: .50, cushion: .34 },
  /** The lift height that clears the case walls before the board is lowered. */
  carry: .70,
  board: { width: 1.54, depth: 1.90, wood: .05, velvet: .032 },
} as const
const BOARD_TOP = LOCK_LAYOUT.board.wood + LOCK_LAYOUT.board.velvet
/** Plate centre on the board (actor space), and the plate's own heights. */
const PLATE_Z = .20
const PLATE_RINGS: ProfileRing[] = [
  { d: .012, y: 0 }, { d: .002, y: .008 }, { d: 0, y: .018 }, { d: 0, y: .036 },
  // Rounded outer edge up to a raised rim, then into a shallow channel.
  { d: .005, y: .050 }, { d: .012, y: .061 }, { d: .021, y: .069 }, { d: .031, y: .073 },
  { d: .041, y: .071 }, { d: .050, y: .066 }, { d: .058, y: .062 }, { d: .065, y: .061 },
  // The domed face inside the rim.
  { s: .97, y: .063 }, { s: .92, y: .069 }, { s: .84, y: .078 }, { s: .72, y: .088 }, { s: .58, y: .097 },
  { s: .42, y: .104 }, { s: .26, y: .108 }, { s: .12, y: .1095 },
]
/** Right half of the plate outline from the top tab, mirrored; +y points to the cord. */
const PLATE_RIGHT: [number, number][] = [[0, .40], [.08, .39], [.13, .345], [.22, .315], [.36, .33], [.48, .37], [.585, .372], [.645, .31], [.635, .215], [.575, .13], [.555, .03], [.585, -.07], [.585, -.18], [.53, -.28], [.43, -.345], [.31, -.37], [.20, -.395], [.10, -.425]]
const PLATE_BOTTOM = -.44
// Original raised geometric strokes, not a scanned inscription or a font asset.
const LETTERS: [string, number, number[][][]][] = [
  ['long', -.235, [[[.09, -.14], [-.09, -.02]], [[-.14, 0], [.13, 0]], [[-.02, -.17], [-.02, .15], [.07, .10]], [[.01, .02], [.15, .16]]]],
  ['ming', .235, [[[0, -.17], [-.16, -.06]], [[0, -.17], [.16, -.06]], [[-.09, -.035], [.09, -.035]], [[-.13, .01], [-.13, .14], [-.025, .14], [-.025, .01], [-.13, .01]], [[.04, .01], [.14, .01], [.14, .12], [.10, .12]], [[.04, .01], [.04, .18]]]],
]
const LETTER_SCALE = 1.05, LETTER_Z = .02, STROKE = .02
const DROPS = [-.40, 0, .40], FLOWER = .105, NOTCH = .74, LINK = .014, LINK_GAP = .055
const CORD = .03, BAIL = .044

function plateOutline() {
  const cw = [...PLATE_RIGHT, [0, PLATE_BOTTOM] as [number, number], ...PLATE_RIGHT.slice(1).reverse().map(([x, y]) => [-x, y] as [number, number])]
  return closedOutline(cw.reverse(), 180)
}
/** Lowest outline point under x: where a drop's link leaves the plate. */
function bottomEdge(outline: THREE.Vector2[], x: number) {
  let y = Infinity
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!, b = outline[(i + 1) % outline.length]!
    if ((a.x - x) * (b.x - x) > 0 || a.x === b.x) continue
    y = Math.min(y, a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x))
  }
  return y
}
/** Five rounded petals; one petal points away from the plate, a notch faces it. */
function flowerOutline() {
  const petal = (a: number) => Math.pow(.5 + .5 * Math.cos(5 * (a + Math.PI / 2)), .7)
  const points = Array.from({ length: 100 }, (_, i) => { const a = i / 100 * Math.PI * 2, r = FLOWER * (NOTCH + (1 - NOTCH) * petal(a)); return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r) })
  return { points, petal }
}
const FLOWER_RINGS: ProfileRing[] = [
  { d: .006, y: 0 }, { d: 0, y: .007 }, { d: 0, y: .018 }, { d: .006, y: .029 }, { d: .014, y: .036 }, { d: .022, y: .040 },
  { s: .85, y: .045 }, { s: .68, y: .050 }, { s: .52, y: .054 }, { s: .38, y: .057 },
  // A small raised centre.
  { s: .26, y: .060 }, { s: .14, y: .063 },
]

export function createLongevityLockModel() {
  const root = new THREE.Group(); root.name = 'longevity-subject'
  const toon = createLockToonFactory(), C = LOCK_COLORS
  const materials = {
    silver: toon.create('longevity-silver-toon', 'silver', C.silver, { bend: 1.8, bands: [.66, .90], horizonGain: .5, side: .45, streak: 1, spot: 1, streakBand: [.865, .91, .60], horizon: C.silver.horizon, sweep: true }),
    small: toon.create('longevity-silver-small-toon', 'silver', C.silver, { bands: [.55, .85], horizonGain: .2, side: .3, spot: 1, streakBand: [.86, .91, .52], horizon: C.silver.horizon }),
    relief: toon.create('longevity-letter-toon', 'relief', C.relief, { bands: [.45, .80], horizonGain: .3, streak: .5, spot: .6, streakBand: [.86, .90, .55], horizon: C.relief.horizon }),
    cord: toon.create('longevity-cord-toon', 'cord', C.cord, { twist: 46, bands: [.42, .82] }),
    velvet: toon.create('longevity-velvet-toon', 'velvet', C.velvet, { sheen: C.velvet.sheen, bands: [.40, .84] }),
    wood: toon.create('longevity-wood-toon', 'wood', C.wood, { bands: [.40, .86] }),
    stand: toon.create('longevity-stand-toon', 'wood', C.stand, { bands: [.40, .86] }),
  }
  const mesh = (parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry, material: THREE.Material, line?: number, x = 0, y = 0, z = 0, lineWidth?: number) => {
    const m = new THREE.Mesh(geometry, material); m.name = name; m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m)
    if (line !== undefined) m.add(createOutlineShell(name + '-line', shellGeometry(geometry), line, lineWidth))
    return m
  }
  /** Small silver parts and thin strokes shade by their bands only (no self-shadow speckle). */
  const small = (m: THREE.Mesh) => { m.receiveShadow = false; return m }
  const L = LOCK_LAYOUT

  // A deeper, plain open case in dark wood with a velvet cushion.
  const box = new THREE.Group(); box.name = 'longevity-gift-case'; box.position.set(L.case.x, 0, L.case.z); root.add(box)
  mesh(box, 'longevity-case-base', roundedSlab(L.case.width, L.case.depth, L.case.base, .012, .08), materials.wood, C.wood.line)
  const inner = [L.case.width - L.case.wall * 2, L.case.depth - L.case.wall * 2] as const
  const ring = new THREE.Shape(roundedRect(L.case.width, L.case.depth, .08))
  ring.holes.push(new THREE.Path(roundedRect(inner[0], inner[1], .04).reverse()))
  const walls = new THREE.ExtrudeGeometry(ring, { depth: L.case.top - L.case.base, bevelEnabled: false, curveSegments: 6 })
  walls.rotateX(-Math.PI / 2); walls.translate(0, L.case.base, 0)
  const caseWalls = mesh(box, 'longevity-case-walls', creasedSolid(walls, 40), materials.wood, C.wood.line)
  const cushionHeight = L.case.cushion - L.case.base
  const pad = mesh(box, 'longevity-case-inner-pad', profiledSolid(roundedRect(inner[0] - .004, inner[1] - .004, .04),
    [{ d: .004, y: 0 }, { d: 0, y: .004 }, { d: 0, y: cushionHeight - .03 }, { d: .008, y: cushionHeight - .012 }, { d: .02, y: cushionHeight - .002 }, { d: .035, y: cushionHeight }, { s: .6, y: cushionHeight }, { s: .3, y: cushionHeight }]),
  materials.velvet, C.velvet.line, 0, L.case.base, 0)

  // The low preparation stand, dark and plain.
  const stand = mesh(root, 'longevity-preparation-stand', roundedSlab(L.stand.width, L.stand.depth, L.stand.top, .02, .08), materials.stand, C.stand.line, L.stand.x, 0, L.stand.z)

  // The carrier: pose-placement moves only `actor`; small product motions live on `motion`.
  const actor = new THREE.Group(); actor.name = 'longevity-carrier'; root.add(actor)
  const motion = new THREE.Group(); motion.name = 'longevity-carrier-motion'; actor.add(motion)
  const board = mesh(motion, 'longevity-carrier-board', roundedSlab(L.board.width, L.board.depth, L.board.wood, .012, .07), materials.wood, C.wood.line)
  const velvet = mesh(motion, 'longevity-carrier-velvet', profiledSolid(roundedRect(L.board.width - .06, L.board.depth - .06, .05),
    [{ d: .004, y: 0 }, { d: 0, y: .004 }, { d: 0, y: .014 }, { d: .006, y: .024 }, { d: .014, y: .030 }, { d: .024, y: L.board.velvet }, { s: .6, y: L.board.velvet }, { s: .3, y: L.board.velvet }]),
  materials.velvet, C.velvet.line, 0, L.board.wood, 0)

  // The original insert carries the complete necklace as one prepared rigid object.
  const outline = plateOutline()
  const lock = mesh(motion, 'longevity-silver-lock', profiledSolid(outline, PLATE_RINGS), materials.silver, C.silver.line, 0, BOARD_TOP, PLATE_Z)
  const faceRay = new THREE.Raycaster(), from = new THREE.Vector3(), to = new THREE.Vector3()
  /** Height of the plate's face under a point in carrier space. */
  const face = (x: number, z: number) => {
    root.updateMatrixWorld(true)
    motion.localToWorld(from.set(x, 2, z)); motion.localToWorld(to.set(x, 1, z))
    faceRay.set(from, to.sub(from).normalize())
    const hit = faceRay.intersectObject(lock, false)[0]
    if (!hit) throw Error('point lies off the lock face')
    return motion.worldToLocal(hit.point.clone()).y
  }
  for (const [name, cx, strokes] of LETTERS) {
    const parts: THREE.BufferGeometry[] = []
    for (const stroke of strokes) for (let j = 1; j < stroke.length; j++) {
      const [ax, az] = stroke[j - 1]!, [bx, bz] = stroke[j]!
      const a = new THREE.Vector3(cx + ax! * LETTER_SCALE, 0, PLATE_Z + LETTER_Z + az! * LETTER_SCALE), b = new THREE.Vector3(cx + bx! * LETTER_SCALE, 0, PLATE_Z + LETTER_Z + bz! * LETTER_SCALE)
      a.y = face(a.x, a.z) + STROKE * .35; b.y = face(b.x, b.z) + STROKE * .35
      parts.push(capsuleBetween(a, b, STROKE, 10, 3))
    }
    small(mesh(motion, `longevity-letter-${name}`, mergeSolids(parts), materials.relief))
  }

  // A rounded bail across the top tab; the cord runs through it.
  const bailZ = PLATE_Z - .40 - .02
  const bailProfile = [[0, -.13], [.030, -.13], [.040, -.122], [BAIL, -.105], [BAIL, .105], [.040, .122], [.030, .13], [0, .13]].map(([r, y]) => new THREE.Vector2(r, y))
  const bailGeometry = new THREE.LatheGeometry(bailProfile, 20); bailGeometry.rotateZ(Math.PI / 2)
  const bail = small(mesh(motion, 'longevity-lock-bail', creasedSolid(bailGeometry, 50), materials.small, C.silver.smallLine, 0, BOARD_TOP + BAIL, bailZ, 1.25))

  // A closed cotton neck cord: through the bail, then round in a natural loop.
  const half: [number, number][] = [[0, 0], [.12, 0], [.21, -.025], [.32, -.095], [.43, -.20], [.49, -.33], [.48, -.45], [.40, -.525], [.27, -.578], [.135, -.597]]
  const loop = [...half, [0, -.60] as [number, number], ...half.slice(1).reverse().map(([x, z]) => [-x, z] as [number, number])]
  const cordCurve = new THREE.CatmullRomCurve3(loop.map(([x, z]) => new THREE.Vector3(x, BOARD_TOP + CORD, bailZ + z)), true, 'centripetal')
  const cord = small(mesh(motion, 'longevity-cotton-neck-cord', tubeSolid(new THREE.TubeGeometry(cordCurve, 240, CORD, 12, true)), materials.cord, C.cord.line, 0, 0, 0, 1.5))

  // Three original five-petal drops on short silver links.
  const { points: petals, petal } = flowerOutline()
  const angles = petals.map(p => Math.atan2(p.y, p.x))
  const drops: THREE.Mesh[] = [], links: THREE.Mesh[] = []
  for (const [i, x] of DROPS.entries()) {
    const edge = PLATE_Z - bottomEdge(outline, x), center = edge + LINK_GAP + FLOWER * NOTCH
    const flower = profiledSolid(petals, FLOWER_RINGS, { lift: (k, p, y) => k >= 3 && k < FLOWER_RINGS.length - 2 ? y * (1 - .07 * (1 - petal(angles[p]!))) : y })
    drops.push(small(mesh(motion, `longevity-flower-drop-${i}`, flower, materials.small, C.silver.smallLine, x, BOARD_TOP, center, 1.1)))
    const link = capsuleBetween(new THREE.Vector3(x, BOARD_TOP + LINK, edge - .02), new THREE.Vector3(x, BOARD_TOP + LINK, center - FLOWER * NOTCH + .016), LINK, 10, 3)
    links.push(small(mesh(motion, `longevity-drop-stem-${i}`, mergeSolids([link]), materials.small, C.silver.smallLine, 0, 0, 0, 1.25)))
  }

  const S = L.stand, K = L.case
  const pose = (step: number, t: number) => {
    const n = THREE.MathUtils.clamp(t, 0, 1)
    if (step === 0) actor.position.set(S.x, S.top + (L.carry - S.top) * n, S.z)
    else if (step === 1) actor.position.set(S.x + (K.x - S.x) * n, L.carry, S.z + (K.z - S.z) * n)
    else actor.position.set(K.x, step === 2 ? L.carry - (L.carry - K.cushion) * n : K.cushion, K.z)
    root.updateMatrixWorld(true)
  }
  pose(0, 0)
  const lockAnchor: [number, number, number] = [0, face(0, PLATE_Z + LETTER_Z) - .01, PLATE_Z + LETTER_Z]
  const boardAnchor: [number, number, number] = [-.4, L.board.wood * .6, L.board.depth / 2]
  return {
    root, actor, motion, board, velvet, cord, lock, bail, drops, links, stand, pad, box, walls: caseWalls, pose, materials, sweep: toon.sweep,
    targets: [actor, actor, actor], roots: [actor, actor, actor], anchors: [boardAnchor, boardAnchor, lockAnchor] as [number, number, number][],
    /** Height of the plate's face under a point in carrier space (for tests and probes). */
    face, plate: { z: PLATE_Z, letterZ: PLATE_Z + LETTER_Z, stroke: STROKE, boardTop: BOARD_TOP, bailZ },
    dispose() {},
  }
}
