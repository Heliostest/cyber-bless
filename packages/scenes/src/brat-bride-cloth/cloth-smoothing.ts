import * as THREE from 'three'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'

export const CLOTH_W = 1.65
export const CLOTH_D = 0.74
const PARTICLE_NU = 17
const PARTICLE_NV = 9
const PARTICLE_RADIUS = 0.014

export interface ClothSmoothingOptions {
  isActive?: () => boolean
  isReducedMotion?: () => boolean
}

export interface ClothSurfaceState {
  readonly x: Float64Array
  readonly y: Float64Array
  readonly z: Float64Array
}

export interface ClothSmoothingSnapshot {
  x: Float64Array
  y: Float64Array
  z: Float64Array
  vx: Float64Array
  vy: Float64Array
  vz: Float64Array
  coverage: Float64Array
  rapierPositions?: Float32Array
  rapierVelocities?: Float32Array
}

/**
 * Non-uniform grid coordinates clustering extra vertices near the four hems so the
 * woven border trim, softly rounded corners, and hem crease mouths stay crisp without
 * blurry mat-like bevels.
 */
export function clothGridCoord(index: number, segments: number): number {
  const t = index / segments
  // Smooth symmetric compression near 0 and 1 (derivative ~0.55 at border, ~1.22 in middle).
  return THREE.MathUtils.clamp(t - 0.072 * Math.sin(2 * Math.PI * t), 0, 1)
}

/**
 * Softly rounded cloth-flat rest coordinates (cloth-local frame, sill top at y = 0).
 * Keeps full 1.65 x 0.74 edge spans while gently rounding the four extreme fabric corners
 * and leaving a whisper-thin (<= 0.002m) organic woven softness when smoothed flat.
 */
export function sampleFlatCloth(u: number, v: number, out: { x: number; y: number; z: number }): void {
  const cx = (u - 0.5) * CLOTH_W
  const cz = (v - 0.5) * CLOTH_D
  const au = Math.abs(2 * u - 1)
  const av = Math.abs(2 * v - 1)
  // Soften only the extreme corner tips (~1.8cm corner rounding) so the cloth never reads like a sharp mat.
  const corner = Math.max(0, au - 0.88) / 0.12 * Math.max(0, av - 0.82) / 0.18
  const round = corner * corner
  const sx = cx >= 0 ? 1 : -1
  const sz = cz >= 0 ? 1 : -1
  out.x = cx - sx * 0.022 * round
  out.z = cz - sz * 0.018 * round
  // Whisper-thin organic woven softness on the smoothed sill (zero edge slope so flatSpan stays exact).
  const envFlat = (Math.sin(Math.PI * u) * Math.sin(Math.PI * v)) ** 2
  const weave = 0.0012 * (0.5 + 0.5 * Math.sin(3.0 * Math.PI * u + 0.6 * Math.PI * v)) * envFlat
  out.y = weave
}

/**
 * Deterministic gathered-cloth landing shape on the outer stone windowsill (cloth-local frame,
 * sill top at y = 0). Forms 4 asymmetric, narrow-crested woven linen folds separated by wide
 * flat sill-contact valleys, with crease mouths gently pinching and scalloping the pale hem
 * so pulling and smoothing outward reads cleanly as real fabric rather than a sculpted foam pad.
 */
export function sampleGatheredCloth(u: number, v: number, out: { x: number; y: number; z: number }): void {
  sampleFlatCloth(u, v, out)
  const fx = out.x
  const fz = out.z

  // Four asymmetric, narrow-crested diagonal linen folds resting on flat sill valleys.
  // Sweeps obliquely from front hem toward back hem with natural fabric-pleat tapering.
  const d1 = (u - 0.30) - 0.16 * (v - 0.5)
  const d2 = (u - 0.54) - 0.12 * (v - 0.5)
  const d3 = (u - 0.78) + 0.13 * (v - 0.5)
  const d4 = (u - 0.14) + 0.10 * (v - 0.5)

  const f1 = Math.exp(-(d1 * d1) / (2 * 0.068 * 0.068))
  const f2 = Math.exp(-(d2 * d2) / (2 * 0.060 * 0.060))
  const f3 = Math.exp(-(d3 * d3) / (2 * 0.066 * 0.066))
  const f4 = Math.exp(-(d4 * d4) / (2 * 0.056 * 0.056))

  // Taper naturally toward front & back hems while keeping soft arched crease mouths.
  const spanV1 = 0.28 + 0.72 * Math.sin(Math.PI * (0.08 + 0.84 * v)) ** 0.85
  const spanV2 = 0.32 + 0.68 * Math.sin(Math.PI * (0.06 + 0.88 * v)) ** 0.80
  const spanV3 = 0.26 + 0.74 * Math.sin(Math.PI * (0.10 + 0.82 * (1 - v))) ** 0.85
  const spanV4 = 0.24 + 0.76 * Math.sin(Math.PI * v) ** 0.85

  // Gentle corner untuck on front-left and back-right corners.
  const cornerFL = Math.exp(-((u / 0.20) ** 2 + ((1 - v) / 0.32) ** 2))
  const cornerBR = Math.exp(-(((1 - u) / 0.20) ** 2 + (v / 0.32) ** 2))

  const ridgeY =
    0.104 * f1 * spanV1 +
    0.084 * f2 * spanV2 +
    0.092 * f3 * spanV3 +
    0.052 * f4 * spanV4
  const y = Math.max(0, ridgeY + 0.030 * cornerFL + 0.024 * cornerBR - 0.007)

  // Arc-length-consistent X gathering concentrated through the 4 folds (stays within touch tolerance at 1280px).
  const pull1 = Math.tanh(d1 / 0.085)
  const pull2 = Math.tanh(d2 / 0.075)
  const pull3 = Math.tanh(d3 / 0.080)
  const pull4 = Math.tanh(d4 / 0.070)
  const foldGatherX = -0.019 * pull1 - 0.015 * pull2 - 0.017 * pull3 - 0.010 * pull4
  const gentleSkewX = 0.015 * (v - 0.5) * Math.sin(Math.PI * u)
  const tuckX = 0.020 * cornerFL - 0.018 * cornerBR
  const x = fx * 0.985 + foldGatherX + gentleSkewX + tuckX

  // Gentle, natural organic hem undulation (broad crease-mouth tuck without harsh cutout notches).
  const edgeSign = 2 * v - 1
  const edgeMag = 0.35 + 0.65 * Math.abs(edgeSign)
  const z1 = Math.exp(-(d1 * d1) / (2 * 0.11 * 0.11))
  const z2 = Math.exp(-(d2 * d2) / (2 * 0.10 * 0.10))
  const z3 = Math.exp(-(d3 * d3) / (2 * 0.11 * 0.11))
  const creaseMouthZ = -(0.014 * z1 + 0.011 * z2 + 0.013 * z3) * edgeSign * edgeMag
  const softWaveZ = 0.014 * Math.sin(2.1 * Math.PI * u + 0.35) * Math.abs(edgeSign)
  const tuckZ = -0.020 * cornerFL + 0.016 * cornerBR
  const z = fz * 0.962 + creaseMouthZ + softWaveZ + tuckZ

  out.x = THREE.MathUtils.clamp(x, -0.825, 0.825)
  out.y = THREE.MathUtils.clamp(y, 0, 0.22)
  out.z = THREE.MathUtils.clamp(z, -0.37, 0.37)
}

/**
 * A full-3D supported cloth surface backed by a lazy-loaded unpinned Rapier `SoftBodyDesc.cloth`
 * colliding against the real rigid outer windowsill and rear stone wall.
 * Falls back cleanly to coupled 3D damped springs while WASM initializes or to exact deterministic
 * static targets in reduced-motion mode, preserving stroke coverage, snapshot/restore, and clearance.
 */
export function createClothSmoothing(
  nx: number,
  nz: number,
  write: (surface: ClothSurfaceState) => void,
  options: ClothSmoothingOptions = {},
) {
  const count = (nx + 1) * (nz + 1)
  const posX = new Float64Array(count)
  const posY = new Float64Array(count)
  const posZ = new Float64Array(count)
  const velX = new Float64Array(count)
  const velY = new Float64Array(count)
  const velZ = new Float64Array(count)
  const coverage = new Float64Array(count)

  const uCoords = new Float64Array(nx + 1)
  const vCoords = new Float64Array(nz + 1)
  for (let i = 0; i <= nx; i++) uCoords[i] = clothGridCoord(i, nx)
  for (let j = 0; j <= nz; j++) vCoords[j] = clothGridCoord(j, nz)

  const flatX = new Float64Array(count)
  const flatY = new Float64Array(count)
  const flatZ = new Float64Array(count)
  const gatheredX = new Float64Array(count)
  const gatheredY = new Float64Array(count)
  const gatheredZ = new Float64Array(count)

  const index = (i: number, j: number) => j * (nx + 1) + i
  const tmpSample = { x: 0, y: 0, z: 0 }

  for (let j = 0; j <= nz; j++) {
    const v = vCoords[j]!
    for (let i = 0; i <= nx; i++) {
      const u = uCoords[i]!
      const k = index(i, j)
      sampleFlatCloth(u, v, tmpSample)
      flatX[k] = tmpSample.x
      flatY[k] = tmpSample.y
      flatZ[k] = tmpSample.z
      sampleGatheredCloth(u, v, tmpSample)
      gatheredX[k] = tmpSample.x
      gatheredY[k] = tmpSample.y
      gatheredZ[k] = tmpSample.z
    }
  }

  let rapierBody: ReturnType<RapierSoftBodySession['createCloth']> | null = null
  let rapierReady = false
  let began = false
  let disposed = false
  let wasReduced = false
  let reducedDirty = true

  const pIndex = (i: number, j: number) => i * PARTICLE_NV + j
  const pCount = PARTICLE_NU * PARTICLE_NV
  const pFlatX = new Float32Array(pCount)
  const pFlatY = new Float32Array(pCount)
  const pFlatZ = new Float32Array(pCount)
  const pGatheredX = new Float32Array(pCount)
  const pGatheredY = new Float32Array(pCount)
  const pGatheredZ = new Float32Array(pCount)

  for (let i = 0; i < PARTICLE_NU; i++) {
    const u = i / (PARTICLE_NU - 1)
    for (let j = 0; j < PARTICLE_NV; j++) {
      const v = j / (PARTICLE_NV - 1)
      const k = pIndex(i, j)
      sampleFlatCloth(u, v, tmpSample)
      pFlatX[k] = tmpSample.x
      pFlatY[k] = tmpSample.y
      pFlatZ[k] = tmpSample.z
      sampleGatheredCloth(u, v, tmpSample)
      pGatheredX[k] = tmpSample.x
      pGatheredY[k] = tmpSample.y
      pGatheredZ[k] = tmpSample.z
    }
  }

  const surfaceView: ClothSurfaceState = { x: posX, y: posY, z: posZ }

  function findCoordBracket(coords: Float64Array, value: number): [number, number, number] {
    const last = coords.length - 1
    if (value <= coords[0]!) return [0, 0, 0]
    if (value >= coords[last]!) return [last, last, 0]
    let lo = 0, hi = last
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1
      if (coords[mid]! <= value) lo = mid
      else hi = mid
    }
    const span = coords[hi]! - coords[lo]!
    return [lo, hi, span > 1e-9 ? (value - coords[lo]!) / span : 0]
  }

  function sampleGrid(grid: Float64Array, u: number, v: number): number {
    const [i0, i1, tx] = findCoordBracket(uCoords, THREE.MathUtils.clamp(u, 0, 1))
    const [j0, j1, tz] = findCoordBracket(vCoords, THREE.MathUtils.clamp(v, 0, 1))
    const a = grid[index(i0, j0)]! * (1 - tx) + grid[index(i1, j0)]! * tx
    const b = grid[index(i0, j1)]! * (1 - tx) + grid[index(i1, j1)]! * tx
    return a * (1 - tz) + b * tz
  }

  function syncParticlesFromSurface() {
    if (!rapierBody || !rapierBody.isValid()) return
    for (let i = 0; i < PARTICLE_NU; i++) {
      const u = i / (PARTICLE_NU - 1)
      for (let j = 0; j < PARTICLE_NV; j++) {
        const v = j / (PARTICLE_NV - 1)
        const k = pIndex(i, j)
        const x = sampleGrid(posX, u, v)
        const y = sampleGrid(posY, u, v)
        const z = sampleGrid(posZ, u, v)
        const svx = sampleGrid(velX, u, v)
        const svy = sampleGrid(velY, u, v)
        const svz = sampleGrid(velZ, u, v)
        rapierBody.setParticlePosition(k, { x, y: y + PARTICLE_RADIUS, z })
        rapierBody.setParticleVelocity(k, { x: svx, y: svy, z: svz })
      }
    }
    host.wakeUp()
  }

  function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t
    const t3 = t2 * t
    return 0.5 * (
      2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    )
  }

  function sampleRapierBicubic(
    arr: Float32Array,
    comp: number,
    fi: number,
    fj: number,
  ): number {
    const i1 = Math.min(PARTICLE_NU - 2, Math.floor(fi))
    const j1 = Math.min(PARTICLE_NV - 2, Math.floor(fj))
    const tx = fi - i1
    const tz = fj - j1
    const i0 = Math.max(0, i1 - 1), i2 = Math.min(PARTICLE_NU - 1, i1 + 1), i3 = Math.min(PARTICLE_NU - 1, i1 + 2)
    const j0 = Math.max(0, j1 - 1), j2 = Math.min(PARTICLE_NV - 1, j1 + 1), j3 = Math.min(PARTICLE_NV - 1, j1 + 2)

    const row = (jj: number) =>
      catmullRom(
        arr[pIndex(i0, jj) * 3 + comp]!,
        arr[pIndex(i1, jj) * 3 + comp]!,
        arr[pIndex(i2, jj) * 3 + comp]!,
        arr[pIndex(i3, jj) * 3 + comp]!,
        tx,
      )
    return catmullRom(row(j0), row(j1), row(j2), row(j3), tz)
  }

  function writeFromRapierParticles() {
    if (!rapierBody || !rapierBody.isValid()) return
    const pos = rapierBody.particlePositions()
    const vel = rapierBody.particleVelocities()
    for (let j = 0; j <= nz; j++) {
      const v = vCoords[j]!
      const fj = v * (PARTICLE_NV - 1)
      const j0 = Math.min(PARTICLE_NV - 1, Math.round(fj))
      for (let i = 0; i <= nx; i++) {
        const k = index(i, j)
        const u = uCoords[i]!
        const fi = u * (PARTICLE_NU - 1)
        const i0 = Math.min(PARTICLE_NU - 1, Math.round(fi))

        // C1-smooth bicubic Catmull-Rom upsampling passes through every Rapier particle cleanly
        // without piecewise-linear hem corners or jagged crease kinks.
        const bx = sampleRapierBicubic(pos, 0, fi, fj)
        const by = sampleRapierBicubic(pos, 1, fi, fj)
        const bz = sampleRapierBicubic(pos, 2, fi, fj)

        const kv = pIndex(i0, j0) * 3
        const svx = vel[kv]!
        const svy = vel[kv + 1]!
        const svz = vel[kv + 2]!

        // Keep cloth seated cleanly on the sill top (y >= 0) and within sill/wall bounds.
        posX[k] = THREE.MathUtils.clamp(Number.isFinite(bx) ? bx : flatX[k]!, -0.84, 0.84)
        posY[k] = THREE.MathUtils.clamp(Number.isFinite(by) ? by - PARTICLE_RADIUS : 0, 0, 0.24)
        posZ[k] = THREE.MathUtils.clamp(Number.isFinite(bz) ? bz : flatZ[k]!, -0.40, 0.40)
        velX[k] = Number.isFinite(svx) ? svx : 0
        velY[k] = Number.isFinite(svy) ? svy : 0
        velZ[k] = Number.isFinite(svz) ? svz : 0
      }
    }
    write(surfaceView)
  }

  const host: RapierSoftBodyHost = createRapierSoftBodyHost({
    gravity: { x: 0, y: -9.81, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 6,
    internalPgsIterations: 2,
    sleepSpeedThreshold: 0.008,
    sleepTimeRequired: 0.45,
    isActive: options.isActive,
    isReducedMotion: options.isReducedMotion,
    onReady(session) {
      if (disposed) return
      // Outside windowsill rigid collider in cloth-local frame (top at y = 0).
      session.addFixedBox(
        { x: 0, y: -0.06, z: -0.18 },
        { x: 3.25, y: 0.12, z: 1.3 },
        { friction: 0.86, restitution: 0.02 },
      )
      // Rear window stone wall backstop behind the sill (front face at z = -0.52).
      session.addFixedBox(
        { x: 0, y: 0.55, z: -0.70 },
        { x: 3.25, y: 1.3, z: 0.36 },
        { friction: 0.72, restitution: 0.02 },
      )
      // Unpinned 17x9 cloth: borders and corners gather, curl, and stretch freely in 3D on the sill.
      rapierBody = session.createCloth({
        origin: { x: -CLOTH_W / 2, y: PARTICLE_RADIUS, z: -CLOTH_D / 2 },
        du: { x: CLOTH_W / (PARTICLE_NU - 1), y: 0, z: 0 },
        dv: { x: 0, y: 0, z: CLOTH_D / (PARTICLE_NV - 1) },
        nu: PARTICLE_NU,
        nv: PARTICLE_NV,
        mass: 0.40,
        particleRadius: PARTICLE_RADIUS,
        linearDamping: 3.5,
        edgeSoftness: { naturalFrequency: 7.4, dampingRatio: 0.80 },
        bendSoftness: { naturalFrequency: 6.0, dampingRatio: 0.82 },
        friction: 0.86,
        restitution: 0.02,
        canSleep: true,
      })
      rapierReady = true
      if (began) syncParticlesFromSurface()
    },
  })

  function applyClothForces() {
    if (!rapierBody || !rapierBody.isValid()) return
    rapierBody.resetForces(false)
    const pos = rapierBody.particlePositions()
    const vel = rapierBody.particleVelocities()
    const m = Math.max(rapierBody.mass() / pCount, 1e-4)

    for (let i = 0; i < PARTICLE_NU; i++) {
      const u = i / (PARTICLE_NU - 1)
      for (let j = 0; j < PARTICLE_NV; j++) {
        const v = j / (PARTICLE_NV - 1)
        const k = pIndex(i, j)
        const cov = sampleGrid(coverage, u, v)
        const targetX = pGatheredX[k]! * (1 - cov) + pFlatX[k]! * cov
        const targetY = pGatheredY[k]! * (1 - cov) + pFlatY[k]! * cov + PARTICLE_RADIUS
        const targetZ = pGatheredZ[k]! * (1 - cov) + pFlatZ[k]! * cov

        const px = pos[k * 3]!, py = pos[k * 3 + 1]!, pz = pos[k * 3 + 2]!
        const vx = vel[k * 3]!, vy = vel[k * 3 + 1]!, vz = vel[k * 3 + 2]!

        // Soft shape-memory forces hold narrow unsmoothed linen pleats against tension,
        // while stroked areas relax outward to full width and press onto the stone sill collider.
        const kY = 240 * (1 - cov) + 170 * cov
        const cY = 18 + 10 * cov
        const kXZ = 120 + 55 * cov
        const cXZ = 14 + 5 * cov
        const fy = m * (9.81 * (1 - 0.55 * cov) + kY * (targetY - py) - cY * vy)
        const fx = m * (kXZ * (targetX - px) - cXZ * vx)
        const fz = m * (kXZ * (targetZ - pz) - cXZ * vz)
        rapierBody.addParticleForce(k, { x: fx, y: fy, z: fz }, false)
      }
    }
  }

  function snapToDeterministicTarget() {
    for (let k = 0; k < count; k++) {
      const cov = coverage[k]!
      posX[k] = gatheredX[k]! * (1 - cov) + flatX[k]! * cov
      posY[k] = gatheredY[k]! * (1 - cov) + flatY[k]! * cov
      posZ[k] = gatheredZ[k]! * (1 - cov) + flatZ[k]! * cov
      velX[k] = 0
      velY[k] = 0
      velZ[k] = 0
    }
    write(surfaceView)
  }

  return {
    /** Lazily warms up the Rapier cloth world when active non-reduced handling starts. */
    activate() {
      if (disposed || options.isReducedMotion?.()) return Promise.resolve(null)
      return host.start()
    },
    get rapierReady() {
      return rapierReady
    },
    get sleeping() {
      return host.sleeping
    },
    begin() {
      began = true
      reducedDirty = true
      posX.set(gatheredX)
      posY.set(gatheredY)
      posZ.set(gatheredZ)
      velX.fill(0)
      velY.fill(0)
      velZ.fill(0)
      coverage.fill(0)
      if (rapierReady) syncParticlesFromSurface()
      write(surfaceView)
    },
    /** Seamless hand-off from lowering carry pose into live Rapier sill landing without popping. */
    beginFromSurface(srcX: Float64Array, srcY: Float64Array, srcZ: Float64Array, dropVelocityY = -0.35) {
      began = true
      reducedDirty = true
      coverage.fill(0)
      for (let k = 0; k < count; k++) {
        posX[k] = THREE.MathUtils.clamp(srcX[k]!, -0.84, 0.84)
        posY[k] = THREE.MathUtils.clamp(srcY[k]!, 0, 0.24)
        posZ[k] = THREE.MathUtils.clamp(srcZ[k]!, -0.40, 0.40)
        velX[k] = 0
        velY[k] = posY[k]! > 0.005 ? dropVelocityY : 0
        velZ[k] = 0
      }
      if (rapierReady) syncParticlesFromSurface()
      write(surfaceView)
    },
    stroke(from: THREE.Vector2, to: THREE.Vector2) {
      if (
        ![...from, ...to].every(Number.isFinite) ||
        Math.hypot(to.x - from.x, to.y - from.y) < 0.001 ||
        Math.abs(to.x - from.x) < Math.abs(to.y - from.y) * 0.6
      ) {
        return
      }
      if ([from, to].some((p) => Math.abs(p.x) > 0.86 || Math.abs(p.y) > 0.41)) return
      const dx = to.x - from.x
      const dz = to.y - from.y
      const length2 = dx * dx + dz * dz
      const length = Math.sqrt(length2)
      const ux = dx / length
      const uz = dz / length
      reducedDirty = true

      for (let j = 0; j <= nz; j++) {
        for (let i = 0; i <= nx; i++) {
          const k = index(i, j)
          const mx = 0.55 * posX[k]! + 0.45 * flatX[k]!
          const mz = 0.55 * posZ[k]! + 0.45 * flatZ[k]!
          const t = THREE.MathUtils.clamp(((mx - from.x) * dx + (mz - from.y) * dz) / length2, 0, 1)
          const distance = Math.hypot(mx - from.x - dx * t, mz - from.y - dz * t)
          const pressure = 1 - THREE.MathUtils.smoothstep(distance, 0.08, 0.22)
          coverage[k] = Math.max(coverage[k]!, pressure)
        }
      }

      if (rapierReady && rapierBody && rapierBody.isValid()) {
        host.wakeUp()
        const pos = rapierBody.particlePositions()
        const m = Math.max(rapierBody.mass() / pCount, 1e-4)
        const leadX = to.x + ux * 0.11
        const leadZ = to.y + uz * 0.11
        for (let k = 0; k < pCount; k++) {
          const px = pos[k * 3]!
          const pz = pos[k * 3 + 2]!
          const t = THREE.MathUtils.clamp(((px - from.x) * dx + (pz - from.y) * dz) / length2, 0, 1)
          const distance = Math.hypot(px - from.x - dx * t, pz - from.y - dz * t)
          const pressure = 1 - THREE.MathUtils.smoothstep(distance, 0.06, 0.25)
          if (pressure > 0.02) {
            rapierBody.applyParticleImpulse(
              k,
              {
                x: ux * m * 1.18 * pressure,
                y: -m * 1.60 * pressure,
                z: uz * m * 0.88 * pressure,
              },
              true,
            )
          }
          // Subtle ripple push slightly ahead of the fingertip as folds open outward.
          const leadDist = Math.hypot(px - leadX, pz - leadZ)
          const leadPressure = 1 - THREE.MathUtils.smoothstep(leadDist, 0.04, 0.16)
          if (leadPressure > 0.04) {
            rapierBody.applyParticleImpulse(
              k,
              { x: ux * m * 0.44 * leadPressure, y: m * 0.15 * leadPressure, z: uz * m * 0.30 * leadPressure },
              true,
            )
          }
        }
      }
    },
    progress() {
      let sum = 0
      let samples = 0
      for (let j = 1; j < nz; j++) {
        for (let i = 1; i < nx; i++) {
          sum += coverage[index(i, j)]!
          samples++
        }
      }
      return sum / samples
    },
    finish() {
      coverage.fill(1)
      reducedDirty = true
      if (rapierReady) host.wakeUp()
    },
    update(dt: number, reduced: boolean): boolean {
      if (!Number.isFinite(dt) || dt <= 0) return false
      if (reduced) {
        if (!wasReduced || reducedDirty) {
          snapToDeterministicTarget()
          wasReduced = true
          reducedDirty = false
          return true
        }
        return false
      }
      if (wasReduced) {
        wasReduced = false
        reducedDirty = true
        if (rapierReady) syncParticlesFromSurface()
      }

      if (rapierReady && rapierBody && rapierBody.isValid()) {
        const stepped = host.step(dt, applyClothForces)
        if (stepped) writeFromRapierParticles()
        return stepped
      }

      // Coupled 3D damped spring fallback while Rapier WASM finishes lazy initialization.
      const clampedDt = Math.min(dt, 0.05)
      const steps = Math.ceil(clampedDt / 0.008)
      const h = clampedDt / steps
      for (let step = 0; step < steps; step++) {
        for (let j = 0; j <= nz; j++) {
          for (let i = 0; i <= nx; i++) {
            const k = index(i, j)
            const cov = coverage[k]!
            const tx = gatheredX[k]! * (1 - cov) + flatX[k]! * cov
            const ty = gatheredY[k]! * (1 - cov) + flatY[k]! * cov
            const tz = gatheredZ[k]! * (1 - cov) + flatZ[k]! * cov

            let nSumY = 0, nCount = 0
            if (i > 0) { nSumY += posY[k - 1]!; nCount++ }
            if (i < nx) { nSumY += posY[k + 1]!; nCount++ }
            if (j > 0) { nSumY += posY[k - nx - 1]!; nCount++ }
            if (j < nz) { nSumY += posY[k + nx + 1]!; nCount++ }
            const avgY = nCount > 0 ? nSumY / nCount : posY[k]!

            velX[k]! += (135 * (tx - posX[k]!) - 18 * velX[k]!) * h
            velY[k]! += (190 * (ty - posY[k]!) + 34 * (avgY - posY[k]!) - 21 * velY[k]!) * h
            velZ[k]! += (135 * (tz - posZ[k]!) - 18 * velZ[k]!) * h
          }
        }
        for (let k = 0; k < count; k++) {
          posX[k] = THREE.MathUtils.clamp(posX[k]! + velX[k]! * h, -0.84, 0.84)
          posY[k] = THREE.MathUtils.clamp(posY[k]! + velY[k]! * h, 0, 0.24)
          posZ[k] = THREE.MathUtils.clamp(posZ[k]! + velZ[k]! * h, -0.40, 0.40)
          if (posY[k] === 0) velY[k] = Math.max(0, velY[k]!)
        }
      }
      write(surfaceView)
      return true
    },
    snapshot(): ClothSmoothingSnapshot {
      const snap: ClothSmoothingSnapshot = {
        x: posX.slice(),
        y: posY.slice(),
        z: posZ.slice(),
        vx: velX.slice(),
        vy: velY.slice(),
        vz: velZ.slice(),
        coverage: coverage.slice(),
      }
      if (rapierReady && rapierBody && rapierBody.isValid()) {
        snap.rapierPositions = rapierBody.particlePositions().slice()
        snap.rapierVelocities = rapierBody.particleVelocities().slice()
      }
      return snap
    },
    restore(saved: ClothSmoothingSnapshot) {
      reducedDirty = true
      posX.set(saved.x)
      posY.set(saved.y)
      posZ.set(saved.z)
      velX.set(saved.vx)
      velY.set(saved.vy)
      velZ.set(saved.vz)
      coverage.set(saved.coverage)
      if (rapierReady && rapierBody && rapierBody.isValid()) {
        if (saved.rapierPositions && saved.rapierVelocities) {
          for (let k = 0; k < pCount; k++) {
            rapierBody.setParticlePosition(k, {
              x: saved.rapierPositions[k * 3]!,
              y: saved.rapierPositions[k * 3 + 1]!,
              z: saved.rapierPositions[k * 3 + 2]!,
            })
            rapierBody.setParticleVelocity(k, {
              x: saved.rapierVelocities[k * 3]!,
              y: saved.rapierVelocities[k * 3 + 1]!,
              z: saved.rapierVelocities[k * 3 + 2]!,
            })
          }
          host.wakeUp()
        } else {
          syncParticlesFromSurface()
        }
      }
      write(surfaceView)
    },
    dispose() {
      disposed = true
      rapierBody = null
      rapierReady = false
      host.dispose()
    },
  }
}
