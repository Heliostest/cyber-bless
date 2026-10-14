import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

type XYZ = [number, number, number]
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
  honey: { board: 0xc8a170, frame: 0x99734c, end: 0xb38a59, peg: 0xe3c192 },
  birch: { board: 0xd2b58c, frame: 0xa98d67, end: 0xc0a078, peg: 0xe8cea4 },
  chestnut: { board: 0xb88e61, frame: 0x886346, end: 0xa07850, peg: 0xd3ac76 },
} satisfies Record<TimberFinish, Record<string, number>>

/**
 * Original, texture-free timber furniture. No third-party meshes are embedded.
 * Dimensions come from each scene so the craft, contact plane and cue anchors
 * remain unchanged. Everything is a child of root and uses normal tree disposal.
 */
export function addCraftTable(parent: THREE.Object3D, options: CraftTableOptions) {
  const { name, width: w, depth: d, surfaceY, thickness: t, center = [0, 0],
    groundY = 0, support = 'trestle', finish = 'honey' } = options
  const h = surfaceY - groundY, underside = h - t, colors = FINISHES[finish]
  const root = new THREE.Group(); root.name = `${name}-furniture`
  root.position.set(center[0], groundY, center[1]); parent.add(root)
  root.userData.furniture = { authored: true, support, finish, surfaceY }
  const material = (color: THREE.ColorRepresentation) => new THREE.MeshStandardMaterial({ color, roughness: .84 })
  const boards = [1, 1.025, .975, 1.012].map(value => material(new THREE.Color(colors.board).multiplyScalar(value)))
  const frame = material(colors.frame), end = material(colors.end), peg = material(colors.peg)
  const grain = material(new THREE.Color(colors.board).lerp(new THREE.Color(colors.frame), .24))
  grain.polygonOffset = true; grain.polygonOffsetFactor = -1; grain.polygonOffsetUnits = -1
  const add = (part: string, geometry: THREE.BufferGeometry, mat: THREE.Material, p: XYZ, owner: THREE.Object3D = root) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = `${name}-${part}`
    mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; owner.add(mesh)
    return mesh
  }
  const box = (part: string, size: XYZ, p: XYZ, mat = frame, owner: THREE.Object3D = root, radius = .025) =>
    add(part, new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(n => n / 3))), mat, p, owner)
  const beam = (part: string, a: XYZ, b: XYZ, wide: number, deep: number) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b)
    const mesh = box(part, [wide, from.distanceTo(to), deep], [0, 0, 0])
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
  const boardCount = d > 2 ? 6 : 5, boardDepth = d / boardCount
  for (let i = 0; i < boardCount; i++) {
    const z = -d / 2 + boardDepth * (i + .5)
    box('top-board', [run, t, boardDepth - .004], [0, h - t / 2, z], boards[i % boards.length], top, .012)
    // Flat grain ribbons stay exactly on the contact plane. Polygon offset
    // avoids z-fighting without raising any resting craft object or its bounds.
    const positions: number[] = [], indices: number[] = []
    for (let j = 0; j <= 12; j++) {
      const x = -run * .42 + run * .84 * j / 12
      const lineZ = z + boardDepth * .20 + Math.sin(j * .52 + i) * .009
      positions.push(x, h, lineZ - .002, x, h, lineZ + .002)
      if (j < 12) { const k = j * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals()
    const stroke = add('quiet-grain', geometry, grain, [0, 0, 0], top)
    stroke.castShadow = false; stroke.userData.toonSurface = { outline: false }
  }
  for (const side of [-1, 1]) {
    box('breadboard-end', [endWidth, t, d], [side * (w - endWidth) / 2, h - t / 2, 0], end, top, .025)
    for (const z of [-d * .30, d * .30]) {
      const pin = add('end-grain-pin', new THREE.CylinderGeometry(.018, .018, .008, 10), peg, [side * (w - endWidth) / 2, h - .004, z], top)
      pin.userData.toonSurface = { outline: false }
    }
  }

  const span = w * .35, railZ = d * .31
  if (support === 'trestle') {
    for (const x of [-span, span]) {
      box('trestle-foot', [.25, .09, d * .80], [x, .045, 0], frame, root, .035)
      for (const side of [-1, 1]) {
        beam('leg', [x, .09, side * d * .28], [x, underside - .06, side * d * .16], .14, .15)
      }
      box('trestle-cap', [.24, .12, d * .76], [x, underside - .06, 0])
      dowel([x, underside - .06, d * .38 + .004])
    }
    box('through-stretcher', [span * 2 + .20, .12, .13], [0, underside * .42, 0])
    for (const x of [-span - .085, span + .085]) box('stretcher-wedge', [.045, .19, .18], [x, underside * .42, 0], end)
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
    const panel = new THREE.ExtrudeGeometry(outline, { depth: .16, steps: 1, curveSegments: 6, bevelEnabled: true, bevelSegments: 2, bevelSize: inset, bevelThickness: inset })
    panel.translate(0, inset, -.08); panel.rotateY(Math.PI / 2)
    for (const x of [-span, span]) add('leg', panel, frame, [x, 0, 0])
    box('through-stretcher', [span * 2 + .20, .13, .16], [0, underside * .71, 0])
    for (const x of [-span - .09, span + .09]) box('stretcher-wedge', [.045, .20, .20], [x, underside * .71, 0], end)
  } else {
    for (const x of [-span, span]) for (const z of [-railZ, railZ]) {
      beam('leg', [x * 1.035, .015, z * 1.055], [x, underside, z], .15, .15)
      dowel([x, underside - .085, z + .080])
    }
    for (const z of [-railZ, railZ]) box('apron', [span * 2, .16, .09], [0, underside - .08, z])
    for (const x of [-span, span]) box('side-stretcher', [.10, .11, railZ * 2], [x, underside * .31, 0])
    box('lower-stretcher', [span * 2, .10, .10], [0, underside * .31, 0])
  }
  return { root, top, surfaceY }
}
