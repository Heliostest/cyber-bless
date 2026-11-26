import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

const VANE_HALF_THICKNESS = 0.0055 // 0.011 cardstock thickness (down from blunt 0.018)
const HUB_INNER_RADIUS = 0.047
const HUB_MAX_RADIUS = 0.14
const PIN_HEAD_RADIUS = 0.025
const PIN_SHAFT_RADIUS = 0.011

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Builds a watertight closed thin-cardstock curved pinwheel vane with:
 * - true unit-normal offset thickness (uniform 0.011 cardstock edge),
 * - isotropic unfolded planar UV coordinates for fine `ritual-optics` sheet paper tooth
 *   (no wedge stretching or coarse streaks),
 * - broad curled-in inner paper scoop whose folded corner sweeps cleanly toward the center pin
 *   while leaving `w >= 0.52` (including touch anchor `[.556, .1038, .107]`) intact,
 * - subtle inner-scoop pocket AO and paler cut-paper rim vertex colors.
 */
function buildCurvedPaperVane(): THREE.BufferGeometry {
  const nu = 20
  const nv = 26
  const cols = nu + 1
  const rows = nv + 1

  const mid: THREE.Vector3[][] = Array.from({ length: rows }, () => new Array<THREE.Vector3>(cols))
  for (let j = 0; j <= nv; j++) {
    const w = j / nv
    const inner = smoothstep(0.50, 0.0, w)
    // Continuous full-span arch so the curved diagonal edge sweeps smoothly from pin to outer tip
    // with zero mid-edge kink while still keeping the touch anchor at w=0.60, u=0.20 aligned.
    const archW = Math.sin(Math.PI * w) * Math.pow(1 - w, 0.55)
    const scoopW = Math.sin(Math.PI * w) * Math.pow(1 - w, 0.45)
    for (let i = 0; i <= nu; i++) {
      const u = i / nu
      const baseX = 0.07 + 0.81 * w
      const baseY = (0.011 + 0.019 * u) * (1 - w) + (0.015 + 0.72 * u) * w
      const baseZ = 0.045 + 0.17 * u * (1 - w) + 0.2 * Math.sin(Math.PI * w) * u

      const archX = 0.036 * Math.sin(Math.PI * Math.pow(u, 0.85))
      const tuckX = -0.064 * smoothstep(0.42, 1.0, u)
      const offsetX = 0.004 + archX + tuckX

      const rollY = 0.082 * archW * Math.pow(u, 1.45)

      const riseU = smoothstep(0.0, 0.76, u)
      const targetInnerZ = 0.038 + 0.178 * riseU + 0.016 * Math.sin(Math.PI * riseU)
      const offsetZ = targetInnerZ - (0.045 + 0.17 * u)
      const scoopZ = 0.028 * scoopW * Math.sin(Math.PI * Math.pow(u, 0.85))

      mid[j]![i] = new THREE.Vector3(baseX + offsetX * inner, baseY + rollY, baseZ + offsetZ * inner + scoopZ)
    }
  }

  const normals: THREE.Vector3[][] = Array.from({ length: rows }, () => new Array<THREE.Vector3>(cols))
  const dw = new THREE.Vector3()
  const du = new THREE.Vector3()
  for (let j = 0; j <= nv; j++) {
    const jm = Math.max(0, j - 1)
    const jp = Math.min(nv, j + 1)
    for (let i = 0; i <= nu; i++) {
      const im = Math.max(0, i - 1)
      const ip = Math.min(nu, i + 1)
      dw.subVectors(mid[jp]![i]!, mid[jm]![i]!)
      du.subVectors(mid[j]![ip]!, mid[j]![im]!)
      normals[j]![i] = new THREE.Vector3().crossVectors(dw, du).normalize()
    }
  }

  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const idx: number[] = []

  const pushVertex = (p: THREE.Vector3, uCoord: number, vCoord: number, r: number, g: number, b: number) => {
    const id = pos.length / 3
    pos.push(p.x, p.y, p.z)
    uv.push(uCoord, vCoord)
    col.push(r, g, b)
    return id
  }

  const frontPts: THREE.Vector3[] = []
  const backPts: THREE.Vector3[] = []
  const sheetUvs: [number, number][] = []

  for (let j = 0; j <= nv; j++) {
    const w = j / nv
    for (let i = 0; i <= nu; i++) {
      const u = i / nu
      const m = mid[j]![i]!
      const n = normals[j]![i]!
      frontPts.push(m.clone().addScaledVector(n, VANE_HALF_THICKNESS))
      backPts.push(m.clone().addScaledVector(n, -VANE_HALF_THICKNESS))
      // Isotropic unfolded planar UVs in [0,1]^2 keep paper pulp/tooth grain uniform
      // across both the wide outer blade and the narrower curled inner corner.
      const flatY = (0.011 + 0.019 * u) * (1 - w) + (0.015 + 0.72 * u) * w
      sheetUvs.push([w, THREE.MathUtils.clamp((flatY - 0.011) / 0.725, 0, 1)])
    }
  }

  const sheetCount = rows * cols
  for (let pass = 0; pass < 2; pass++) {
    const isFront = pass === 0
    const pts = isFront ? frontPts : backPts
    for (let j = 0; j <= nv; j++) {
      const w = j / nv
      for (let i = 0; i <= nu; i++) {
        const u = i / nu
        const k = j * cols + i
        const [su, sv] = sheetUvs[k]!
        // Subtle fold-cavity shadow inside the curled scoop and soft highlight on the outer arch.
        const pocket = Math.exp(-w * 4.6) * Math.sin(Math.PI * Math.pow(u, 0.9))
        const pinSeatAo = Math.exp(-w * 7.5) * smoothstep(0.62, 1.0, u)
        const crest = Math.sin(Math.PI * w) * Math.sin(Math.PI * u) * 0.03
        const shade = isFront
          ? THREE.MathUtils.clamp(0.99 - pocket * 0.14 - pinSeatAo * 0.08 + crest, 0.76, 1.03)
          : THREE.MathUtils.clamp(0.93 - pocket * 0.16 - pinSeatAo * 0.06, 0.72, 0.98)
        pushVertex(pts[k]!, su, sv, shade, shade * 0.995, shade * 0.988)
      }
    }
  }

  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const k = j * cols + i
      const b = k + cols
      const c = b + 1
      const d = k + 1
      idx.push(k, b, c, k, c, d)
      idx.push(k + sheetCount, c + sheetCount, b + sheetCount, k + sheetCount, d + sheetCount, c + sheetCount)
    }
  }

  // Watertight cut-paper perimeter rim with split vertices for crisp flat scissor-cut edge normals.
  const boundary: number[] = []
  for (let j = 0; j <= nv; j++) boundary.push(j * cols)
  for (let i = 1; i <= nu; i++) boundary.push(nv * cols + i)
  for (let j = nv - 1; j >= 0; j--) boundary.push(j * cols + nu)
  for (let i = nu - 1; i >= 1; i--) boundary.push(i)

  for (let e = 0; e < boundary.length; e++) {
    const a = boundary[e]!
    const b = boundary[(e + 1) % boundary.length]!
    const [ua, wa] = sheetUvs[a]!
    const [ub, wb] = sheetUvs[b]!
    // Subtle paler warm paper-core tint along the thin 0.011 cut cardstock rim.
    const f0 = pushVertex(frontPts[a]!, ua, wa, 1.06, 1.04, 1.01)
    const f1 = pushVertex(backPts[a]!, ua, wa, 1.03, 1.01, 0.98)
    const f2 = pushVertex(backPts[b]!, ub, wb, 1.03, 1.01, 0.98)
    const f3 = pushVertex(frontPts[b]!, ub, wb, 1.06, 1.04, 1.01)
    idx.push(f0, f1, f2, f0, f2, f3)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

/**
 * Builds the hollow kraft-paper center hub (`pinwheel-hub`) as a single closed genus-1 solid:
 * - Exact open circular inner bore (`r = 0.047`) leaving clear pin clearance around the shaft;
 * - Crisp straight-edged square cardstock backing (`r = 0.099..0.140`, `z = 0.016..0.030`)
 *   rotated to 22.5° so its four corners tuck cleanly behind the four colored blades;
 * - Slender hollow rolled kraft-paper axle sleeve (`r = 0.047..0.061`, `z = 0.030..0.196`)
 *   nested cleanly inside the curved blade pockets without any protruding barrel or puffy lobe.
 */
function buildFoldedPaperHub(): THREE.BufferGeometry {
  const segs = 64 // Multiple of 16 so i=4,20,36,52 hit 22.5°+k*90° (exact HUB_MAX_RADIUS = 0.14)
  const halfSide = HUB_MAX_RADIUS / Math.SQRT2
  const squareAngle = -Math.PI / 8 // Aligns square corners at 22.5°, 112.5°, 202.5°, 292.5° behind the blades

  const rSquare = (theta: number) => {
    const a = theta - squareAngle
    return halfSide / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)))
  }

  type ProfileRing = {
    r: (theta: number) => number
    z: number
    v: number
    shade: number
  }

  // CCW profile in (r, z) so T_theta x T_s points strictly outward on every strip.
  const loop: ProfileRing[] = [
    { r: () => HUB_INNER_RADIUS, z: 0.016, v: 0.0, shade: 0.78 },
    { r: rSquare, z: 0.016, v: 0.22, shade: 0.88 },
    { r: rSquare, z: 0.030, v: 0.27, shade: 1.02 },
    { r: () => 0.061, z: 0.030, v: 0.44, shade: 0.90 },
    { r: () => 0.061, z: 0.196, v: 0.78, shade: 0.85 },
    { r: () => HUB_INNER_RADIUS, z: 0.196, v: 0.86, shade: 0.92 },
  ]

  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const idx: number[] = []

  for (let s = 0; s < loop.length; s++) {
    const p0 = loop[s]!
    const p1 = loop[(s + 1) % loop.length]!
    const isInnerBore = s === loop.length - 1
    const isBackRim = s === 1
    const base = pos.length / 3

    for (let ring = 0; ring < 2; ring++) {
      const def = ring === 0 ? p0 : p1
      for (let i = 0; i <= segs; i++) {
        const ii = i % segs
        const theta = (ii * 2 * Math.PI) / segs
        const rad = def.r(theta)
        pos.push(rad * Math.cos(theta), rad * Math.sin(theta), def.z)
        uv.push(i / segs, def.v)
        const shade = isBackRim ? 1.02 : isInnerBore ? 0.68 : def.shade
        col.push(shade, shade * 0.985, shade * 0.96)
      }
    }

    const row = segs + 1
    for (let i = 0; i < segs; i++) {
      const a0 = base + i
      const a1 = base + i + 1
      const b0 = base + row + i
      const b1 = base + row + i + 1
      idx.push(a0, a1, b1, a0, b1, b0)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

/**
 * Builds a slender brass craft pin (`r = 0.011` shaft) with a neat domed pinhead
 * (`max radius = 0.025`) centered at `(0, 1.85, z)`, strictly watertight with outward normals.
 */
function buildCraftPin(): THREE.BufferGeometry {
  const segs = 28
  const cy = 1.85
  const pos: number[] = []
  const idx: number[] = []

  const addRing = (r: number, z: number) => {
    const start = pos.length / 3
    for (let i = 0; i < segs; i++) {
      const t = (i * 2 * Math.PI) / segs
      pos.push(r * Math.cos(t), cy + r * Math.sin(t), z)
    }
    return start
  }

  const addStrip = (r0: number, z0: number, r1: number, z1: number) => {
    const a = addRing(r0, z0)
    const b = addRing(r1, z1)
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs
      idx.push(a + i, a + j, b + j, a + i, b + j, b + i)
    }
  }

  // Back pin end at z = -0.162 facing -Z
  const backCenter = pos.length / 3
  pos.push(0, cy, -0.162)
  const backEdge = addRing(PIN_SHAFT_RADIUS, -0.162)
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % segs
    idx.push(backCenter, backEdge + j, backEdge + i)
  }

  // Slender pin shaft running from behind the wooden handle through rear bead, paper hub, vanes & front bead
  addStrip(PIN_SHAFT_RADIUS, -0.162, PIN_SHAFT_RADIUS, 0.244)
  addStrip(PIN_SHAFT_RADIUS, 0.244, PIN_HEAD_RADIUS, 0.247)
  addStrip(PIN_HEAD_RADIUS, 0.247, PIN_HEAD_RADIUS, 0.253)

  // Smooth domed brass pinhead crown
  const domeLevels: [number, number][] = [
    [PIN_HEAD_RADIUS, 0.253],
    [0.0228, 0.259],
    [0.0175, 0.2645],
    [0.0095, 0.268],
  ]
  const domeRings = domeLevels.map(([r, z]) => addRing(r, z))
  for (let l = 0; l < domeRings.length - 1; l++) {
    const a = domeRings[l]!
    const b = domeRings[l + 1]!
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs
      idx.push(a + i, a + j, b + j, a + i, b + j, b + i)
    }
  }
  const frontTip = pos.length / 3
  pos.push(0, cy, 0.2695)
  const topRing = domeRings[domeRings.length - 1]!
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % segs
    idx.push(topRing + i, topRing + j, frontTip)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

/** Builds a compact flattened craft spacer bead centered on the pin axis `(0, 1.85, zCenter)`. */
function buildSpacerBead(radiusXY: number, halfDepthZ: number, zCenter: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 24, 16)
  g.scale(radiusXY, radiusXY, halfDepthZ)
  g.translate(0, 1.85, zCenter)
  g.computeVertexNormals()
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

/** Original pre-bent paper toy with assisted rotation; no airflow or folding solver. */
export function createPinwheelModel() {
  const root = new THREE.Group()
  root.name = 'pinwheel-subject'

  const wood = new THREE.MeshStandardMaterial({ color: '#b9966c', roughness: 0.86 })
  const metal = new THREE.MeshStandardMaterial({ color: '#b89458', metalness: 0.68, roughness: 0.34 })
  const tealBead = new THREE.MeshStandardMaterial({ color: '#5ca699', roughness: 0.78 })
  const ivoryBead = new THREE.MeshStandardMaterial({ color: '#d8c8a7', roughness: 0.80 })

  const hubPaper = createRitualMaterial(
    { color: '#d4bc92', roughness: 0.96, vertexColors: true },
    {
      kind: 'paper',
      strength: 0.24,
      fiber: 'paper',
      paper: { layout: 'sheet', grainScale: 5.5, aspect: 1.2, grain: 0.52, fibers: 0.20, edge: 0.24, highlightGuard: 0.54 },
    },
  )
  const coralPaper = createRitualMaterial(
    { color: '#e59277', roughness: 0.95, vertexColors: true },
    {
      kind: 'paper',
      strength: 0.28,
      fiber: 'paper',
      paper: { layout: 'sheet', grainScale: 5.4, aspect: 1.12, grain: 0.44, fibers: 0.14, edge: 0.22, highlightGuard: 0.42 },
    },
  )
  const tealPaper = createRitualMaterial(
    { color: '#68b9ab', roughness: 0.95, vertexColors: true },
    {
      kind: 'paper',
      strength: 0.28,
      fiber: 'paper',
      paper: { layout: 'sheet', grainScale: 5.4, aspect: 1.12, grain: 0.44, fibers: 0.14, edge: 0.22, highlightGuard: 0.42 },
    },
  )

  const mesh = (name: string, g: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = root) => {
    const o = new THREE.Mesh(g, material)
    o.name = name
    o.castShadow = o.receiveShadow = true
    parent.add(o)
    return o
  }

  const handle = mesh('pinwheel-handle', new THREE.CylinderGeometry(0.05, 0.05, 1.8, 32).translate(0, 0.95, -0.1), wood)
  const pin = mesh('pinwheel-pin', buildCraftPin(), metal)
  const rearBead = mesh('pinwheel-rear-bead', buildSpacerBead(0.038, 0.022, -0.016), tealBead)
  const frontBead = mesh('pinwheel-front-bead', buildSpacerBead(0.038, 0.014, 0.232), ivoryBead)

  const rotor = new THREE.Group()
  rotor.name = 'pinwheel-rotor'
  rotor.position.y = 1.85
  root.add(rotor)

  const hub = mesh('pinwheel-hub', buildFoldedPaperHub(), hubPaper, rotor)
  const blades = Array.from({ length: 4 }, (_, i) =>
    mesh('pinwheel-vane-' + i, buildCurvedPaperVane().rotateZ((i * Math.PI) / 2), i % 2 === 0 ? coralPaper : tealPaper, rotor),
  )

  // Three durable checkpoints: picked up, played, explicitly put back.
  // The scene owns the freely rotating rotor; placement only moves the rigid toy.
  function pose(step: number, n: number) {
    const t = THREE.MathUtils.clamp(Number.isFinite(n) ? n : 0, 0, 1)
    root.position.y = step === 0 ? 0.18 * t : step === 1 ? 0.18 : step === 2 ? 0.18 * (1 - t) : 0
    rotor.rotation.z = 0
    root.updateMatrixWorld(true)
  }
  pose(0, 0)

  return {
    root,
    subject: root,
    rotor,
    handle,
    pin,
    rearBead,
    frontBead,
    hub,
    blades,
    pose,
    targets: [handle, blades[0], handle],
    roots: [root, root, root],
    anchors: [
      [0, 0.4, -0.049],
      [0.556, 0.1038, 0.107],
      [0, 0.4, -0.049],
    ] as [number, number, number][],
  }
}
