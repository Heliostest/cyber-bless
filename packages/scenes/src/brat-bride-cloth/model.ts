import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import {
  CLOTH_D,
  CLOTH_W,
  clothGridCoord,
  createClothSmoothing,
  sampleFlatCloth,
  sampleGatheredCloth,
  type ClothSmoothingOptions,
  type ClothSurfaceState,
} from './cloth-smoothing'

const THICKNESS = 0.0088

/** Original window and cloth: the lift, carry drape, sill landing and smoothing are product choreography. */
export function createBratBrideModel(options: ClothSmoothingOptions = {}) {
  const root = new THREE.Group(); root.name = 'brat-cloth-subject'
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .86 })
  const stone = material(0xaaa6b1), woodY = material(0x80584d), woodX = material(0x80584d), glass = material(0x35435f), benchMat = material(0xb18061), benchSideMat = material(0x9b6e53)
  applyCraftSurface(woodY, { kind: 'wood', strength: .4, axis: 'y' })
  applyCraftSurface(woodX, { kind: 'wood', strength: .4, axis: 'x' })
  applyCraftSurface(benchMat, { kind: 'wood', strength: .4, axis: 'x' })
  applyCraftSurface(benchSideMat, { kind: 'wood', strength: .4, axis: 'z' })
  applyCraftSurface(stone, { kind: 'stone', strength: .45 })
  const box = (name: string, size: [number, number, number], at: [number, number, number], mat: THREE.Material, bevel = .016) => {
    const r = Math.min(bevel, size[0] / 3, size[1] / 3, size[2] / 3)
    const g = new RoundedBoxGeometry(size[0], size[1], size[2], 2, r).toNonIndexed(), mesh = new THREE.Mesh(g, mat)
    mesh.name = name; mesh.position.set(...at); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh
  }
  // Compact chamfered stone wall footing grounded on the courtyard without a giant 3.6×3.35 m slab.
  const board = box('window-plinth', [3.32, .08, .50], [0, .04, -.22], stone, .016)
  box('window-lower-wall', [2.66, .68, .34], [0, .42, -.22], stone, .016)
  // Piers meet the lintel underside at y = 2.04 with distinct lintel depth so no faces are coplanar.
  box('window-left-pier', [.28, 1.96, .36], [-1.47, 1.06, -.22], stone, .018)
  box('window-right-pier', [.28, 1.96, .36], [1.47, 1.06, -.22], stone, .018)
  box('window-lintel', [3.26, .17, .40], [0, 2.125, -.22], stone, .018)
  const sill = box('outside-windowsill', [3.25, .12, 1.30], [0, .82, .30], stone, .018)
  // Sculpted stone corbels support the cantilevered sill against the lower wall.
  const corbelShape = new THREE.Shape()
  corbelShape.moveTo(-.05, .76)
  corbelShape.lineTo(.80, .76)
  corbelShape.lineTo(.80, .64)
  corbelShape.quadraticCurveTo(.42, .60, .20, .42)
  corbelShape.quadraticCurveTo(.10, .34, -.05, .34)
  corbelShape.closePath()
  const corbelGeo = new THREE.ExtrudeGeometry(corbelShape, { depth: .18, steps: 1, curveSegments: 8, bevelEnabled: true, bevelThickness: .012, bevelSize: .010, bevelSegments: 2 })
  corbelGeo.rotateY(-Math.PI / 2)
  corbelGeo.translate(.09, 0, 0)
  for (const [label, x] of [['left', -1.16], ['right', 1.16]] as const) {
    const corbel = new THREE.Mesh(corbelGeo.toNonIndexed(), stone)
    corbel.name = `window-corbel-${label}`
    corbel.position.set(x, 0, 0)
    corbel.castShadow = corbel.receiveShadow = true
    root.add(corbel)
  }
  corbelGeo.dispose()
  box('window-night-pane', [2.62, 1.12, .06], [0, 1.49, -.31], glass, .008)
  for (const x of [-1.27, 1.27]) box(`window-frame-${x}`, [.065, 1.18, .10], [x, 1.49, -.24], woodY, .010)
  for (const y of [.91, 2.07]) box(`window-crossbar-${y}`, [2.60, .065, .10], [0, y, -.24], woodX, .010)
  box('window-mullion', [.035, 1.16, .10], [0, 1.49, -.24], woodY, .006)
  box('window-middle-bar', [2.60, .035, .10], [0, 1.49, -.24], woodX, .006)
  const bench = box('preparing-bench', [2.12, .06, .98], [0, .29, 1.75], benchMat, .016)
  for (const x of [-.83, .83]) for (const z of [1.42, 2.08]) box(`bench-leg-${x}-${z}`, [.11, .265, .11], [x, .1325, z], woodY, .016)
  for (const z of [1.42, 2.08]) box(`bench-apron-${z}`, [1.66, .055, .048], [0, .238, z], benchMat, .010)
  for (const x of [-.83, .83]) box(`bench-stretcher-${x}`, [.055, .048, .66], [x, .11, 1.75], benchSideMat, .010)

  // Top and underside share the same curved 3D parameterization; all four sides remain sealed.
  // Non-uniform edge clustering gives a crisp woven selvage hem rather than a wide mat-like bevel.
  const nx = 36, nz = 18, points: number[][] = [], faces: number[] = [], colors: number[] = []
  const top = new THREE.Color(0x477d84), hem = new THREE.Color(0xb6c7bd), seam = new THREE.Color(0x3f7178), bottom = new THREE.Color(0x385f69)
  const rimEdgeColor = hem.clone().lerp(top, 0.22)
  const uCoords = new Float64Array(nx + 1)
  const vCoords = new Float64Array(nz + 1)
  for (let i = 0; i <= nx; i++) uCoords[i] = clothGridCoord(i, nx)
  for (let j = 0; j <= nz; j++) vCoords[j] = clothGridCoord(j, nz)

  const initPt = { x: 0, y: 0, z: 0 }
  for (let side = 0; side < 2; side++) {
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        sampleFlatCloth(uCoords[i]!, vCoords[j]!, initPt)
        points.push([initPt.x, side, initPt.z])
      }
    }
  }
  const layer = (nx + 1) * (nz + 1)
  const at = (i: number, j: number) => j * (nx + 1) + i
  const quad = (a: number, b: number, c: number, d: number) => faces.push(a, b, c, a, c, d)
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1)
      quad(a, d, c, b); quad(a + layer, b + layer, c + layer, d + layer)
    }
  }
  const surfaceVertexCount = faces.length
  const boundary: number[] = []
  for (let j = 0; j <= nz; j++) boundary.push(at(0, j))
  for (let i = 1; i <= nx; i++) boundary.push(at(i, nz))
  for (let j = nz - 1; j >= 0; j--) boundary.push(at(nx, j))
  for (let i = nx - 1; i > 0; i--) boundary.push(at(i, 0))
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i]!, b = boundary[(i + 1) % boundary.length]!
    quad(a, a + layer, b + layer, b)
  }

  const vertices: number[] = []
  const sample: { u: number; v: number; under: boolean; grid: number }[] = []
  for (let vIdx = 0; vIdx < faces.length; vIdx++) {
    const index = faces[vIdx]!
    const [x, side, z] = points[index]!
    vertices.push(x!, 0, z!)
    const grid = index % layer
    const gi = grid % (nx + 1), gj = Math.floor(grid / (nx + 1))
    const u = uCoords[gi]!, v = vCoords[gj]!
    sample.push({ u, v, under: side === 1, grid })
    const isEdgeStrip = vIdx >= surfaceVertexCount
    const edgeDistX = Math.min(u, 1 - u) * CLOTH_W
    const edgeDistZ = Math.min(v, 1 - v) * CLOTH_D
    const edgeDist = Math.min(edgeDistX, edgeDistZ)
    // Refined woven hem: crisp ~2.2cm pale selvage, subtle inner hem-stitch shadow, clean teal linen field.
    const color = isEdgeStrip
      ? rimEdgeColor
      : side === 1
        ? bottom
        : edgeDist < 0.022
          ? hem
          : edgeDist < 0.044
            ? seam
            : top
    colors.push(color.r, color.g, color.b)
  }
  const baseColors = new Float32Array(colors)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const cloth = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .95 }))
  applyCraftSurface(cloth.material, { kind: 'fabric', strength: .28 })
  cloth.name = 'brat-cloth'; cloth.castShadow = cloth.receiveShadow = true
  root.add(cloth)

  // Pre-allocated scratch buffers so every animation & Rapier frame allocates zero typed arrays.
  const surfX = new Float64Array(layer)
  const surfY = new Float64Array(layer)
  const surfZ = new Float64Array(layer)
  const normX = new Float64Array(layer)
  const normY = new Float64Array(layer)
  const normZ = new Float64Array(layer)
  const shadeBuf = new Float64Array(layer)

  // Precompute bench resting pose & sill gathered pose for smooth blending without popping.
  const benchX = new Float64Array(layer)
  const benchY = new Float64Array(layer)
  const benchZ = new Float64Array(layer)
  const sillX = new Float64Array(layer)
  const sillY = new Float64Array(layer)
  const sillZ = new Float64Array(layer)
  const tmpPt = { x: 0, y: 0, z: 0 }

  for (let j = 0; j <= nz; j++) {
    const v = vCoords[j]!
    for (let i = 0; i <= nx; i++) {
      const u = uCoords[i]!
      const k = at(i, j)
      sampleFlatCloth(u, v, tmpPt)
      const fx = tmpPt.x, fz = tmpPt.z
      // Relaxed linen waiting on the wooden bench: two crisp soft rest creases & gently relaxed corner.
      const bd1 = (u - 0.36) - 0.10 * (v - 0.5)
      const bd2 = (u - 0.67) + 0.08 * (v - 0.5)
      const bf1 = Math.exp(-(bd1 * bd1) / (2 * 0.075 * 0.075))
      const bf2 = Math.exp(-(bd2 * bd2) / (2 * 0.068 * 0.068))
      const bEnv = 0.25 + 0.75 * Math.sin(Math.PI * v) ** 0.85
      const cornerSoft = Math.exp(-(((1 - u) / 0.20) ** 2 + ((1 - v) / 0.32) ** 2))
      benchX[k] = fx * 0.974 - 0.018 * cornerSoft - 0.008 * Math.tanh(bd1 / 0.09)
      benchY[k] = Math.max(0, (0.044 * bf1 + 0.032 * bf2) * bEnv + 0.014 * cornerSoft - 0.004)
      benchZ[k] = fz * 0.972 - 0.014 * cornerSoft - (0.010 * bf1 + 0.008 * bf2) * (2 * v - 1) * Math.abs(2 * v - 1)

      sampleGatheredCloth(u, v, tmpPt)
      sillX[k] = tmpPt.x
      sillY[k] = tmpPt.y
      sillZ[k] = tmpPt.z
    }
  }

  function writeSurface(state: ClothSurfaceState) {
    const gx = state.x, gy = state.y, gz = state.z
    for (let j = 0; j <= nz; j++) {
      const j0 = Math.max(0, j - 1), j1 = Math.min(nz, j + 1)
      for (let i = 0; i <= nx; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(nx, i + 1)
        const k = at(i, j)
        const kL = at(i0, j), kR = at(i1, j)
        const kD = at(i, j0), kU = at(i, j1)

        // Tangent along +u and +v; outward top normal is tv x tu (+Y for flat cloth).
        const tux = gx[kR]! - gx[kL]!, tuy = gy[kR]! - gy[kL]!, tuz = gz[kR]! - gz[kL]!
        const tvx = gx[kU]! - gx[kD]!, tvy = gy[kU]! - gy[kD]!, tvz = gz[kU]! - gz[kD]!
        let nxv = tvy * tuz - tvz * tuy
        let nyv = tvz * tux - tvx * tuz
        let nzv = tvx * tuy - tvy * tux
        const len = Math.hypot(nxv, nyv, nzv) || 1
        nxv /= len; nyv /= len; nzv /= len
        if (nyv < 0.42) {
          nyv = 0.42
          const r = Math.hypot(nxv, nyv, nzv) || 1
          nxv /= r; nyv /= r; nzv /= r
        }
        normX[k] = nxv; normY[k] = nyv; normZ[k] = nzv

        // Subtle anime cel fold shading: gentle valley occlusion + ridge crest lift, exact 1.0 when flat.
        const avgY = 0.25 * (gy[kL]! + gy[kR]! + gy[kD]! + gy[kU]!)
        const lap = gy[k]! - avgY
        const slope = Math.sqrt(Math.max(0, 1 - nyv * nyv))
        const crevice = THREE.MathUtils.clamp(-lap * 20.0, 0, 1) * 0.16 + THREE.MathUtils.clamp(slope - 0.10, 0, 0.72) * 0.13
        const crest = THREE.MathUtils.clamp(lap * 15.0, 0, 1) * 0.11
        shadeBuf[k] = THREE.MathUtils.clamp(1 + crest - crevice, 0.75, 1.13)
      }
    }

    const p = geometry.getAttribute('position')
    const c = geometry.getAttribute('color')
    for (let i = 0; i < sample.length; i++) {
      const s = sample[i]!
      const k = s.grid
      const x = gx[k]!, y = gy[k]!, z = gz[k]!
      if (s.under) {
        p.setXYZ(i, x, y, z)
      } else {
        p.setXYZ(i, x + normX[k]! * THICKNESS, y + normY[k]! * THICKNESS, z + normZ[k]! * THICKNESS)
      }
      const sh = s.under ? 0.94 + 0.06 * shadeBuf[k]! : shadeBuf[k]!
      const ci = i * 3
      c.setXYZ(
        i,
        THREE.MathUtils.clamp(baseColors[ci]! * sh, 0, 1),
        THREE.MathUtils.clamp(baseColors[ci + 1]! * sh, 0, 1),
        THREE.MathUtils.clamp(baseColors[ci + 2]! * sh, 0, 1),
      )
    }
    p.needsUpdate = true
    c.needsUpdate = true
    // Exact face normals on the thin sealed rim, smooth analytical normals across top & bottom faces.
    geometry.computeVertexNormals()
    const nAttr = geometry.getAttribute('normal')
    for (let i = 0; i < surfaceVertexCount; i++) {
      const s = sample[i]!
      const k = s.grid
      const sign = s.under ? -1 : 1
      nAttr.setXYZ(i, normX[k]! * sign, normY[k]! * sign, normZ[k]! * sign)
    }
    nAttr.needsUpdate = true
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  }

  /**
   * Computes a pinched-pickup hanging cloth shape in cloth-local coordinates with real
   * world-space support clearance against bench, plinth, windowsill, and rear wall.
   */
  function evaluateCarrySurface(
    lift: number,
    sillBlend: number,
    grabX: number,
    grabZ: number,
    swayX: number,
    swayZ: number,
  ) {
    const L = THREE.MathUtils.clamp(lift, 0, 1)
    const S = THREE.MathUtils.clamp(sillBlend, 0, 1)
    const gx0 = THREE.MathUtils.clamp(grabX, -0.52, 0.52)
    const gz0 = THREE.MathUtils.clamp(grabZ, -0.20, 0.20)
    const baseX = cloth.position.x, baseY = cloth.position.y, baseZ = cloth.position.z

    for (let j = 0; j <= nz; j++) {
      const v = vCoords[j]!
      for (let i = 0; i <= nx; i++) {
        const u = uCoords[i]!
        const k = at(i, j)
        sampleFlatCloth(u, v, tmpPt)
        const cx = tmpPt.x
        const cz = tmpPt.z

        // Rest base blends smoothly from bench waiting pose to sill gathered pose.
        const rx = benchX[k]! * (1 - S) + sillX[k]! * S
        const ry = benchY[k]! * (1 - S) + sillY[k]! * S
        const rz = benchZ[k]! * (1 - S) + sillZ[k]! * S

        // Graceful pinched-hand gravity drape around (gx0, gz0) with fine radial linen pleats & carry sway.
        const dx = cx - gx0
        const dz = cz - gz0
        const r = Math.hypot(dx / 0.84, dz / 0.54)
        const angle = Math.atan2(dz, dx)
        const gather = 0.16 + 0.08 * Math.min(1.15, r)
        const fluteEnv = THREE.MathUtils.smoothstep(r, 0.20, 1.05)
        const flute = (0.7 * Math.sin(angle * 5.0 + r * 1.4 + 0.3) + 0.3 * Math.cos(angle * 3.0 - 0.5)) * fluteEnv
        const hangX = gx0 + dx * (1 - gather) + swayX * (0.08 + 0.28 * r) + 0.011 * flute * Math.cos(angle)
        const hangZ = gz0 + dz * (1 - gather * 0.86) + swayZ * (0.08 + 0.28 * r) + 0.009 * flute * Math.sin(angle)
        const pinchPeak = 0.072 * Math.exp(-r * r * 5.0)
        const droop = -(0.195 * (1 - Math.exp(-r * r * 1.42)) + 0.020 * flute)
        const hangY = pinchPeak + droop

        let x = rx * (1 - L) + hangX * L
        let y = ry * (1 - L) + hangY * L
        let z = rz * (1 - L) + hangZ * L

        // World-space solid clearance: never slice through bench, plinth, stone sill, or rear wall.
        let wx = baseX + x
        let wy = baseY + y
        let wz = baseZ + z

        // Rear stone wall front face sits at z = -0.04 (lintel/piers/lower wall).
        if (wz < -0.015) {
          wz = -0.015
          z = wz - baseZ
        }
        // Outside stone windowsill: x in [-1.625, 1.625], z in [-0.35, 0.95], y in [0.76, 0.88].
        // When carried above/over the sill, rest cleanly on top (y = 0.88); when hanging in front
        // below the sill lip, drape cleanly forward of the vertical stone face (no upward shark-fin).
        if (Math.abs(wx) <= 1.66 && wz >= -0.37 && wz <= 0.975 && wy < 0.885) {
          if (baseY >= 0.86 || baseZ <= 0.96) {
            wy = 0.88
          } else {
            wz = 0.975
            z = wz - baseZ
          }
        }
        // Preparing bench: x in [-1.06, 1.06], z in [1.26, 2.24], top y = 0.32.
        if (Math.abs(wx) <= 1.08 && wz >= 1.24 && wz <= 2.26 && wy < 0.32) {
          wy = 0.32
        }
        // Plinth top at y = 0.08.
        if (wy < 0.085) wy = 0.085

        surfX[k] = x
        surfY[k] = wy - baseY
        surfZ[k] = z
      }
    }
    writeSurface({ x: surfX, y: surfY, z: surfZ })
  }

  const clamp = (n: number) => THREE.MathUtils.clamp(n, 0, 1)
  const smoothing = createClothSmoothing(nx, nz, state => {
    surfX.set(state.x)
    surfY.set(state.y)
    surfZ.set(state.z)
    writeSurface(state)
  }, options)

  function setCarryPose(lift: number, sillBlend: number, grabX = 0, grabZ = 0, swayX = 0, swayZ = 0) {
    evaluateCarrySurface(lift, sillBlend, grabX, grabZ, swayX, swayZ)
    root.updateMatrixWorld(true)
  }

  function pose(step: number, t: number) {
    t = clamp(t)
    let y = .32, z = 1.75, lift = 0, sillBlend = 0
    if (step === 0) {
      y = THREE.MathUtils.lerp(.32, 1.18, t)
      lift = Math.sin(t * Math.PI * 0.5)
      sillBlend = 0
    } else if (step === 1) {
      y = 1.18
      z = THREE.MathUtils.lerp(1.75, .48, t)
      lift = 1
      sillBlend = t
    } else if (step === 2) {
      y = THREE.MathUtils.lerp(1.18, .88, t)
      z = .48
      lift = 1 - t
      sillBlend = 1
    } else if (step >= 3) {
      y = .88
      z = .48
      lift = 0
      sillBlend = 1
    }
    cloth.position.set(0, y, z)
    evaluateCarrySurface(lift, sillBlend, 0, 0, 0, 0)
    root.updateMatrixWorld(true)
  }

  pose(0, 0)
  return {
    root,
    cloth,
    board,
    bench,
    sill,
    pose,
    setCarryPose,
    currentSurface: (): ClothSurfaceState => ({ x: surfX, y: surfY, z: surfZ }),
    smoothing,
    targets: [cloth, cloth, cloth],
    roots: [cloth, cloth, cloth],
    anchors: [[0, .03, 0], [0, .03, 0], [0, .03, 0]] as [number, number, number][],
    dispose() { smoothing.dispose() },
  }
}
