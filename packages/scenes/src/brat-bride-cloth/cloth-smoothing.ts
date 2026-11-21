import * as THREE from 'three'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'

const CLOTH_W = 1.65
const CLOTH_D = 0.74
const PARTICLE_NU = 17
const PARTICLE_NV = 9
const PARTICLE_RADIUS = 0.014

export interface ClothSmoothingOptions {
  isActive?: () => boolean
  isReducedMotion?: () => boolean
}

export interface ClothSmoothingSnapshot {
  heights: Float64Array
  velocity: Float64Array
  coverage: Float64Array
  rapierPositions?: Float32Array
  rapierVelocities?: Float32Array
}

/**
 * A supported cloth height field backed by a lazy-loaded Rapier `SoftBodyDesc.cloth`
 * colliding against a real rigid windowsill box. Falls back smoothly to coupled damped
 * springs before WASM initializes or in reduced-motion static snaps, while preserving
 * exact horizontal stroke coverage, progress, snapshot/restore and sill clearance.
 */
export function createClothSmoothing(
  nx: number,
  nz: number,
  write: (heights: Float64Array) => void,
  options: ClothSmoothingOptions = {},
) {
  const count = (nx + 1) * (nz + 1)
  const heights = new Float64Array(count)
  const velocity = new Float64Array(count)
  const coverage = new Float64Array(count)
  const rest = new Float64Array(count)
  const index = (i: number, j: number) => j * (nx + 1) + i

  // Soft natural cloth gather: clear diagonal multi-fold ridges resting on the sill.
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx
      const v = j / nz
      const envelope = Math.sin(Math.PI * u) ** 1.65 * Math.sin(Math.PI * v) ** 1.55
      const ridges = 0.62 + 0.38 * Math.cos(6.5 * Math.PI * u + 1.35 * v * Math.PI)
      rest[index(i, j)] = 0.155 * envelope * ridges
    }
  }

  let rapierBody: ReturnType<RapierSoftBodySession['createCloth']> | null = null
  let rapierReady = false
  let began = false
  let disposed = false

  const pIndex = (i: number, j: number) => i * PARTICLE_NV + j
  const pCount = PARTICLE_NU * PARTICLE_NV
  const particleRest = new Float32Array(pCount)
  for (let i = 0; i < PARTICLE_NU; i++) {
    const u = i / (PARTICLE_NU - 1)
    for (let j = 0; j < PARTICLE_NV; j++) {
      const v = j / (PARTICLE_NV - 1)
      const envelope = Math.sin(Math.PI * u) ** 1.65 * Math.sin(Math.PI * v) ** 1.55
      const ridges = 0.62 + 0.38 * Math.cos(6.5 * Math.PI * u + 1.35 * v * Math.PI)
      particleRest[pIndex(i, j)] = 0.155 * envelope * ridges
    }
  }

  function sampleGrid(grid: Float64Array, u: number, v: number): number {
    const fx = THREE.MathUtils.clamp(u, 0, 1) * nx
    const fz = THREE.MathUtils.clamp(v, 0, 1) * nz
    const i0 = Math.floor(fx), i1 = Math.min(nx, i0 + 1), tx = fx - i0
    const j0 = Math.floor(fz), j1 = Math.min(nz, j0 + 1), tz = fz - j0
    const a = grid[index(i0, j0)]! * (1 - tx) + grid[index(i1, j0)]! * tx
    const b = grid[index(i0, j1)]! * (1 - tx) + grid[index(i1, j1)]! * tx
    return a * (1 - tz) + b * tz
  }

  function syncParticlesFromHeightField() {
    if (!rapierBody || !rapierBody.isValid()) return
    for (let i = 0; i < PARTICLE_NU; i++) {
      const u = i / (PARTICLE_NU - 1)
      const x = (u - 0.5) * CLOTH_W
      for (let j = 0; j < PARTICLE_NV; j++) {
        const v = j / (PARTICLE_NV - 1)
        const z = (v - 0.5) * CLOTH_D
        const h = sampleGrid(heights, u, v)
        const vy = sampleGrid(velocity, u, v)
        const k = pIndex(i, j)
        rapierBody.setParticlePosition(k, { x, y: h + PARTICLE_RADIUS, z })
        rapierBody.setParticleVelocity(k, { x: 0, y: vy, z: 0 })
      }
    }
    host.wakeUp()
  }

  function writeFromRapierParticles() {
    if (!rapierBody || !rapierBody.isValid()) return
    const pos = rapierBody.particlePositions()
    const vel = rapierBody.particleVelocities()
    for (let j = 0; j <= nz; j++) {
      const v = j / nz
      const fj = v * (PARTICLE_NV - 1)
      const j0 = Math.floor(fj), j1 = Math.min(PARTICLE_NV - 1, j0 + 1), tz = fj - j0
      for (let i = 0; i <= nx; i++) {
        const k = index(i, j)
        if (i === 0 || j === 0 || i === nx || j === nz) {
          heights[k] = 0
          velocity[k] = 0
          continue
        }
        const u = i / nx
        const fi = u * (PARTICLE_NU - 1)
        const i0 = Math.floor(fi), i1 = Math.min(PARTICLE_NU - 1, i0 + 1), tx = fi - i0
        const y00 = pos[pIndex(i0, j0) * 3 + 1]!
        const y10 = pos[pIndex(i1, j0) * 3 + 1]!
        const y01 = pos[pIndex(i0, j1) * 3 + 1]!
        const y11 = pos[pIndex(i1, j1) * 3 + 1]!
        const y = (y00 * (1 - tx) + y10 * tx) * (1 - tz) + (y01 * (1 - tx) + y11 * tx) * tz
        const vy = vel[pIndex(i0, j0) * 3 + 1]!
        heights[k] = THREE.MathUtils.clamp(y - PARTICLE_RADIUS, 0, 0.16)
        velocity[k] = Number.isFinite(vy) ? vy : 0
      }
    }
    write(heights)
  }

  const pinnedBorder: number[] = []
  for (let i = 0; i < PARTICLE_NU; i++) {
    for (let j = 0; j < PARTICLE_NV; j++) {
      if (i === 0 || i === PARTICLE_NU - 1 || j === 0 || j === PARTICLE_NV - 1) {
        pinnedBorder.push(pIndex(i, j))
      }
    }
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
        { friction: 0.85, restitution: 0.02 },
      )
      // Rear window stone wall backstop behind the sill.
      session.addFixedBox(
        { x: 0, y: 0.55, z: -0.70 },
        { x: 3.25, y: 1.3, z: 0.36 },
        { friction: 0.7, restitution: 0.02 },
      )
      rapierBody = session.createCloth({
        origin: { x: -CLOTH_W / 2, y: PARTICLE_RADIUS, z: -CLOTH_D / 2 },
        du: { x: CLOTH_W / (PARTICLE_NU - 1), y: 0, z: 0 },
        dv: { x: 0, y: 0, z: CLOTH_D / (PARTICLE_NV - 1) },
        nu: PARTICLE_NU,
        nv: PARTICLE_NV,
        mass: 0.45,
        particleRadius: PARTICLE_RADIUS,
        linearDamping: 3.2,
        edgeSoftness: { naturalFrequency: 9, dampingRatio: 0.72 },
        bendSoftness: { naturalFrequency: 3.5, dampingRatio: 0.72 },
        pinnedParticles: pinnedBorder,
        friction: 0.85,
        restitution: 0.02,
        canSleep: true,
      })
      rapierReady = true
      if (began) syncParticlesFromHeightField()
    },
  })

  function applyClothForces() {
    if (!rapierBody || !rapierBody.isValid()) return
    rapierBody.resetForces(false)
    const pos = rapierBody.particlePositions()
    const vel = rapierBody.particleVelocities()
    const m = Math.max(rapierBody.mass() / pCount, 1e-4)

    for (let i = 1; i < PARTICLE_NU - 1; i++) {
      const u = i / (PARTICLE_NU - 1)
      const restX = (u - 0.5) * CLOTH_W
      for (let j = 1; j < PARTICLE_NV - 1; j++) {
        const v = j / (PARTICLE_NV - 1)
        const restZ = (v - 0.5) * CLOTH_D
        const k = pIndex(i, j)
        const cov = sampleGrid(coverage, u, v)
        const targetY = particleRest[k]! * (1 - cov) + PARTICLE_RADIUS
        const px = pos[k * 3]!, py = pos[k * 3 + 1]!, pz = pos[k * 3 + 2]!
        const vx = vel[k * 3]!, vy = vel[k * 3 + 1]!, vz = vel[k * 3 + 2]!

        // Hold soft unsmoothed ridges against membrane tension and pull swept areas flat onto the sill.
        const kY = 390 * (1 - cov) + 270 * cov
        const cY = 18 + 10 * cov
        const fy = m * (9.81 + kY * (targetY - py) - cY * vy)
        const fx = m * (55 * (restX - px) - 10 * vx)
        const fz = m * (55 * (restZ - pz) - 10 * vz)
        rapierBody.addParticleForce(k, { x: fx, y: fy, z: fz }, false)
      }
    }
  }

  return {
    /** Lazily warms up the Rapier cloth world when the smoothing stage becomes active. */
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
      heights.set(rest)
      velocity.fill(0)
      coverage.fill(0)
      if (rapierReady) syncParticlesFromHeightField()
      write(heights)
    },
    stroke(from: THREE.Vector2, to: THREE.Vector2) {
      if (
        ![...from, ...to].every(Number.isFinite) ||
        Math.abs(to.x - from.x) < 0.001 ||
        Math.abs(to.x - from.x) < Math.abs(to.y - from.y)
      ) {
        return
      }
      if ([from, to].some((p) => Math.abs(p.x) > 0.825 || Math.abs(p.y) > 0.37)) return
      const dx = to.x - from.x
      const dz = to.y - from.y
      const length2 = dx * dx + dz * dz
      for (let j = 0; j <= nz; j++) {
        for (let i = 0; i <= nx; i++) {
          const x = (i / nx - 0.5) * CLOTH_W
          const z = (j / nz - 0.5) * CLOTH_D
          const t = THREE.MathUtils.clamp(((x - from.x) * dx + (z - from.y) * dz) / length2, 0, 1)
          const distance = Math.hypot(x - from.x - dx * t, z - from.y - dz * t)
          const pressure = 1 - THREE.MathUtils.smoothstep(distance, 0.08, 0.22)
          const k = index(i, j)
          coverage[k] = Math.max(coverage[k]!, pressure)
        }
      }

      if (rapierReady && rapierBody && rapierBody.isValid()) {
        host.wakeUp()
        const dirX = Math.sign(dx)
        const m = Math.max(rapierBody.mass() / pCount, 1e-4)
        for (let i = 1; i < PARTICLE_NU - 1; i++) {
          const x = (i / (PARTICLE_NU - 1) - 0.5) * CLOTH_W
          for (let j = 1; j < PARTICLE_NV - 1; j++) {
            const z = (j / (PARTICLE_NV - 1) - 0.5) * CLOTH_D
            const t = THREE.MathUtils.clamp(((x - from.x) * dx + (z - from.y) * dz) / length2, 0, 1)
            const distance = Math.hypot(x - from.x - dx * t, z - from.y - dz * t)
            const pressure = 1 - THREE.MathUtils.smoothstep(distance, 0.06, 0.24)
            if (pressure > 0.02) {
              rapierBody.applyParticleImpulse(
                pIndex(i, j),
                { x: dirX * m * 0.65 * pressure, y: -m * 1.4 * pressure, z: 0 },
                true,
              )
            }
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
      if (rapierReady) host.wakeUp()
    },
    update(dt: number, reduced: boolean) {
      if (!Number.isFinite(dt) || dt <= 0) return
      if (reduced) {
        for (let j = 0; j <= nz; j++) {
          for (let i = 0; i <= nx; i++) {
            const k = index(i, j)
            heights[k] = rest[k]! * (1 - coverage[k]!)
            velocity[k] = 0
          }
        }
        write(heights)
        return
      }

      if (rapierReady && rapierBody && rapierBody.isValid()) {
        const stepped = host.step(dt, applyClothForces)
        if (stepped) writeFromRapierParticles()
        return
      }

      // Synchronous damped spring fallback while WASM loads lazily.
      const steps = Math.ceil(Math.min(dt, 0.05) / 0.008)
      const h = Math.min(dt, 0.05) / steps
      for (let step = 0; step < steps; step++) {
        for (let j = 0; j <= nz; j++) {
          for (let i = 0; i <= nx; i++) {
            const k = index(i, j)
            const target = rest[k]! * (1 - coverage[k]!)
            if (i === 0 || j === 0 || i === nx || j === nz) {
              heights[k] = target
              velocity[k] = 0
              continue
            }
            const neighbors =
              (heights[k - 1]! + heights[k + 1]! + heights[k - nx - 1]! + heights[k + nx + 1]!) / 4
            velocity[k]! += (180 * (target - heights[k]!) + 35 * (neighbors - heights[k]!) - 22 * velocity[k]!) * h
          }
        }
        for (let k = 0; k < count; k++) {
          heights[k] = THREE.MathUtils.clamp(heights[k]! + velocity[k]! * h, 0, 0.16)
          if (heights[k] === 0) velocity[k] = Math.max(0, velocity[k]!)
        }
      }
      write(heights)
    },
    snapshot(): ClothSmoothingSnapshot {
      const snap: ClothSmoothingSnapshot = {
        heights: heights.slice(),
        velocity: velocity.slice(),
        coverage: coverage.slice(),
      }
      if (rapierReady && rapierBody && rapierBody.isValid()) {
        snap.rapierPositions = rapierBody.particlePositions().slice()
        snap.rapierVelocities = rapierBody.particleVelocities().slice()
      }
      return snap
    },
    restore(saved: ClothSmoothingSnapshot) {
      heights.set(saved.heights)
      velocity.set(saved.velocity)
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
          syncParticlesFromHeightField()
        }
      }
      write(heights)
    },
    dispose() {
      disposed = true
      rapierBody = null
      rapierReady = false
      host.dispose()
    },
  }
}
