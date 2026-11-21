import * as THREE from 'three'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'
import { createKoinoboriPrint } from './cloth-print'

type XYZ = [number, number, number]

export interface KoinoboriModelOptions {
  isActive?: () => boolean
  isReducedMotion?: () => boolean
}

const TUBE_AROUND = 12
const TUBE_ALONG = 14
const ROPE_PARTICLES = 18

/** Original single-carp appreciation rig. Cloth tube and halyard rope are driven by lazy Rapier soft bodies when active. */
export function createKoinoboriModel(options: KoinoboriModelOptions = {}) {
  const subject = new THREE.Group(); subject.name = 'koinobori-subject'
  const wood = new THREE.MeshStandardMaterial({ color: 0xc89a63, roughness: .82 })
  const metal = new THREE.MeshStandardMaterial({ color: 0xb1a175, metalness: .25, roughness: .55 })
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x796d50, roughness: .96 })
  applyCraftSurface(wood, { kind: 'wood', strength: .4, axis: 'y' })
  applyCraftSurface(metal, { kind: 'metal', strength: .45 })
  applyCraftSurface(ropeMat, { kind: 'cord', strength: .3 })
  const print = createKoinoboriPrint()
  const cloth = createRitualMaterial({ map: print, roughness: .94, side: THREE.DoubleSide }, { kind: 'cloth', strength: .22, fiber: 'linen' })
  cloth.addEventListener('dispose', () => print.dispose())
  const cream = new THREE.MeshStandardMaterial({ color: 0xf4e1ad, roughness: .92 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x294a50, roughness: .85 })
  const vermilion = new THREE.MeshStandardMaterial({ color: 0xcd6b4d, roughness: .91 })
  const gold = new THREE.MeshStandardMaterial({ color: 0xd6af60, roughness: .92, side: THREE.DoubleSide })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Object3D = subject) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  add('koinobori-foot', new THREE.CylinderGeometry(.28, .36, .12, 32), wood, [-1.05, .02, -.2])
  add('koinobori-pole', new THREE.CylinderGeometry(.048, .068, 3.05, 24), wood, [-1.05, 1.585, -.2])
  add('koinobori-finial', new THREE.SphereGeometry(.08, 20, 12), metal, [-1.05, 3.14, -.2])
  const axle = add('koinobori-pulley-axle', new THREE.CylinderGeometry(.03, .03, .26, 16), metal, [-1.05, 3, -.10]); axle.rotation.x = Math.PI / 2
  const wheel = add('koinobori-pulley', new THREE.CylinderGeometry(.160, .160, .04, 32), wood, [-1.05, 3, 0]); wheel.rotation.x = Math.PI / 2
  for (const z of [-.026, .026]) add('koinobori-pulley-rim-' + z, new THREE.TorusGeometry(.167, .009, 6, 40), metal, [-1.05, 3, z])
  add('koinobori-cleat-support', new THREE.BoxGeometry(.08, .18, .40), wood, [-1.05, .42, -.025])
  add('koinobori-cleat', new THREE.BoxGeometry(.30, .08, .30), wood, [-1.05, .42, .13])
  for (const x of [-.10, .10]) add('koinobori-cleat-prong-' + x, new THREE.CylinderGeometry(.022, .025, .14, 12), wood, [-1.05 + x, .53, .25])
  const toggle = add('koinobori-toggle', new THREE.CylinderGeometry(.065, .075, .20, 24), wood, [-1.30, 1.75, .12])
  const fish = new THREE.Group(); fish.name = 'koinobori-fish'; subject.add(fish)
  const mouth = add('koinobori-mouth', new THREE.TorusGeometry(.32, .024, 8, 48), vermilion, [0, 0, 0], fish); mouth.rotation.y = Math.PI / 2
  add('koinobori-bridle-knot', new THREE.SphereGeometry(.03, 12, 8), ropeMat, [-.38, 0, 0], fish)
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3, end = new THREE.Vector3(0, .32 * Math.cos(a), .32 * Math.sin(a))
    const bridle = add('koinobori-bridle-' + i, new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(-.38, 0, 0), end), 1, .009, 6, false), ropeMat, [0, 0, 0], fish)
    bridle.userData.toonSurface = { outline: false }
  }
  const rows = 48, columns = 48, positions = new Float32Array((rows + 1) * (columns + 1) * 3), uvs = new Float32Array((rows + 1) * (columns + 1) * 2), indices: number[] = []
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= columns; j++) {
    uvs.set([.9 * i / rows, j / columns], (i * (columns + 1) + j) * 2)
    if (i < rows && j < columns) { const a = i * (columns + 1) + j, b = a + columns + 1; indices.push(a, a + 1, b, b, a + 1, b + 1) }
  }
  const bodyGeometry = new THREE.BufferGeometry(); bodyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); bodyGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); bodyGeometry.setIndex(indices)
  add('koinobori-body', bodyGeometry, cloth, [0, 0, 0], fish)
  const tailGeometry = (front: boolean) => {
    const geometry = new THREE.BufferGeometry(), index: number[] = []
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 25 * 3), 3))
    const uv = new Float32Array(9 * 25 * 2)
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 24; j++) uv.set([.9 + .1 * i / 8, front ? j / 48 : 1 - j / 48], (i * 25 + j) * 2)
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    for (let i = 0; i < 8; i++) for (let j = 0; j < 24; j++) { const a = i * 25 + j, b = a + 25; index.push(...(front ? [a, a + 1, b, b, a + 1, b + 1] : [a, b, a + 1, b, b + 1, a + 1])) }
    geometry.setIndex(index); return geometry
  }
  const tail = add('koinobori-tail', tailGeometry(true), cloth, [0, 0, 0], fish)
  const rearTail = add('koinobori-tail-back', tailGeometry(false), cloth, [0, 0, 0], fish)
  const tails = [tail, rearTail]
  const paint: { mesh: THREE.Mesh; source: Float32Array; side: number; offset: number }[] = []
  cream.side = dark.side = vermilion.side = THREE.DoubleSide
  for (const side of [-1, 1]) {
    for (const [kind, geometry, material, offset] of [
      ['eye', new THREE.RingGeometry(0, .12, 48, 4), cream, .004],
      ['eye-rim', new THREE.RingGeometry(.096, .113, 48), vermilion, .005],
      ['iris', new THREE.RingGeometry(0, .087, 48, 3), gold, .005],
      ['pupil', new THREE.RingGeometry(0, .058, 48, 3), dark, .006],
      ['eye-light', new THREE.RingGeometry(0, .016, 24, 2).translate(-.018, .021, 0), cream, .00615],
    ] as const) {
      const mesh = add('koinobori-' + kind + '-' + side, geometry, material, [0, 0, 0], fish)
      mesh.userData.toonSurface = { outline: false }
      paint.push({ mesh, source: (mesh.geometry.getAttribute('position').array as Float32Array).slice(), side, offset })
    }
  }
  const ropeGeometry = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0)), 96, .011, 6, false)
  const rope = add('koinobori-halyard', ropeGeometry, ropeMat, [0, 0, 0]); rope.userData.toonSurface = { outline: false }

  let length = 1.12, sag = .56, spread = .65, wind = .18, secureAmount = 0, simClock = 0
  let tubeBody: ReturnType<RapierSoftBodySession['createClothTube']> | null = null
  let halyardBody: ReturnType<RapierSoftBodySession['createRope']> | null = null
  let rapierReady = false
  let physicsStepped = false
  let disposed = false

  // Per-ring centerline offset & radial billow scratch buffers (no per-frame heap churn).
  const ringCenterY = new Float32Array(TUBE_ALONG)
  const ringCenterZ = new Float32Array(TUBE_ALONG)
  const ringRadialScaleY = new Float32Array(TUBE_ALONG)
  const ringRadialScaleZ = new Float32Array(TUBE_ALONG)
  const ringTailVelY = { value: 0 }
  const ringTailVelZ = { value: 0 }
  const ropePts: THREE.Vector3[] = Array.from({ length: ROPE_PARTICLES }, () => new THREE.Vector3())
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpT = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpBi = new THREE.Vector3(), tmpQ = new THREE.Vector3()
  const axisX = new THREE.Vector3(1, 0, 0), axisY = new THREE.Vector3(0, 1, 0)

  const radius = (u: number) => .32 * (1 - .55 * u) + .05 * Math.sin(u * Math.PI)
  const wave = (u: number, time: number) => {
    const w = wind * Math.max(0, (u - .28) / .72) ** 1.6
    return [w * (.18 * Math.sin(time * 2.5 - u * 7) + .035 * Math.sin(time * 4.3 - u * 11.5)),
      w * (.22 * Math.sin(time * 2.1 - u * 6.5) + .035 * Math.sin(time * 3.6 - u * 11))]
  }

  function halyardEndpoints() {
    const from = new THREE.Vector3(-.88, fish.position.y, 0)
    const top = new THREE.Vector3(-.88, 3, 0)
    const pulleyLeft = new THREE.Vector3(-1.22, 3, 0)
    const end = toggle.position.clone().add(new THREE.Vector3(0, .10, 0))
    return { from, top, pulleyLeft, end }
  }

  function writeHalyardGeometry(useRapier: boolean) {
    const { from, top, pulleyLeft, end } = halyardEndpoints()
    let descendCurve: THREE.Curve<THREE.Vector3>
    if (useRapier && halyardBody && halyardBody.isValid()) {
      const pos = halyardBody.particlePositions()
      ropePts[0]!.copy(pulleyLeft)
      for (let i = 1; i < ROPE_PARTICLES - 1; i++) {
        const px = THREE.MathUtils.clamp(pos[i * 3]!, -1.62, -0.78)
        const py = THREE.MathUtils.clamp(pos[i * 3 + 1]!, 0.25, 3.05)
        const pz = THREE.MathUtils.clamp(pos[i * 3 + 2]!, -0.35, 0.45)
        ropePts[i]!.set(px, py, pz)
      }
      ropePts[ROPE_PARTICLES - 1]!.copy(end)
      descendCurve = new THREE.CatmullRomCurve3(ropePts, false, 'centripetal')
    } else {
      descendCurve = new THREE.CubicBezierCurve3(
        pulleyLeft,
        new THREE.Vector3(-1.22, 2, .05),
        new THREE.Vector3(-1.30, end.y + .24, .12 + .20 * secureAmount),
        end,
      )
    }

    const sample = (t: number, out: THREE.Vector3) => {
      if (t < .35) return out.lerpVectors(from, top, t / .35)
      if (t < .50) {
        const a = (t - .35) / .15 * Math.PI
        return out.set(-1.05 + .17 * Math.cos(a), 3 + .17 * Math.sin(a), 0)
      }
      return descendCurve.getPoint((t - .50) / .50, out)
    }

    const v = ropeGeometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i <= 96; i++) {
      const t = i / 96
      sample(t, tmpQ)
      sample(Math.min(1, t + .0001), tmpB)
      sample(Math.max(0, t - .0001), tmpA)
      tmpT.subVectors(tmpB, tmpA).normalize()
      tmpN.crossVectors(tmpT, Math.abs(tmpT.y) > .9 ? axisX : axisY).normalize()
      tmpBi.crossVectors(tmpT, tmpN)
      for (let j = 0; j <= 6; j++) {
        const a = j * Math.PI / 3
        const ca = Math.cos(a), sa = Math.sin(a)
        v.setXYZ(
          i * 7 + j,
          tmpQ.x + .011 * (tmpN.x * ca + tmpBi.x * sa),
          tmpQ.y + .011 * (tmpN.y * ca + tmpBi.y * sa),
          tmpQ.z + .011 * (tmpN.z * ca + tmpBi.z * sa),
        )
      }
    }
    v.needsUpdate = true
    ropeGeometry.computeVertexNormals()
    ropeGeometry.computeBoundingBox()
    ropeGeometry.computeBoundingSphere()
  }

  function resetTubeToCurrentPose() {
    if (!tubeBody || !tubeBody.isValid()) return
    for (let ri = 0; ri < TUBE_ALONG; ri++) {
      const u = ri / (TUBE_ALONG - 1)
      const r = radius(u)
      const zScale = 1 - (1 - spread) * Math.sin(u * Math.PI / 2)
      const baseY = -sag * u * u
      for (let rj = 0; rj < TUBE_AROUND; rj++) {
        const phi = (rj / TUBE_AROUND) * Math.PI * 2
        const k = ri * TUBE_AROUND + rj
        tubeBody.setParticlePosition(k, {
          x: length * u,
          y: baseY + r * Math.sin(phi),
          z: -r * Math.cos(phi) * zScale,
        })
        tubeBody.setParticleVelocity(k, { x: 0, y: 0, z: 0 })
      }
    }
  }

  function resetHalyardToCurrentPose() {
    if (!halyardBody || !halyardBody.isValid()) return
    const { pulleyLeft, end } = halyardEndpoints()
    const curve = new THREE.CubicBezierCurve3(
      pulleyLeft,
      new THREE.Vector3(-1.22, 2, .05),
      new THREE.Vector3(-1.30, end.y + .24, .12 + .20 * secureAmount),
      end,
    )
    for (let i = 0; i < ROPE_PARTICLES; i++) {
      const p = curve.getPoint(i / (ROPE_PARTICLES - 1))
      halyardBody.setParticlePosition(i, { x: p.x, y: p.y, z: p.z })
      halyardBody.setParticleVelocity(i, { x: 0, y: 0, z: 0 })
    }
  }

  const pinnedHeadRings: number[] = []
  for (let ri = 0; ri < 4; ri++) {
    for (let rj = 0; rj < TUBE_AROUND; rj++) pinnedHeadRings.push(ri * TUBE_AROUND + rj)
  }

  const host = createRapierSoftBodyHost({
    gravity: { x: 0, y: -9.81, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 5,
    internalPgsIterations: 2,
    // Koinobori flies continuously in wind when active; disable auto-sleep while wind is active.
    sleepSpeedThreshold: 0,
    isActive: options.isActive,
    isReducedMotion: options.isReducedMotion,
    onReady(session) {
      if (disposed) return
      // Rigid colliders for the wooden pole, pulley wheel and cleat so the halyard contacts real solids.
      session.addFixedCylinder({ x: -1.05, y: 1.585, z: -0.2 }, 0.068, 3.05, { friction: 0.6 })
      session.addFixedBox({ x: -1.05, y: 0.42, z: 0.13 }, { x: 0.30, y: 0.12, z: 0.30 }, { friction: 0.6 })

      // Carp cloth tube (in fish-local coordinate space; no world collider interference).
      tubeBody = session.createClothTube({
        origin: { x: 0, y: 0, z: 0 },
        axis: { x: 1.9, y: 0, z: 0 },
        radiusStart: 0.32,
        radiusEnd: 0.144,
        numAround: TUBE_AROUND,
        numAlong: TUBE_ALONG,
        mass: 0.36,
        particleRadius: 0.02,
        linearDamping: 2.6,
        gravityScale: 0.42,
        edgeSoftness: { naturalFrequency: 24, dampingRatio: 0.72 },
        bendSoftness: { naturalFrequency: 9, dampingRatio: 0.72 },
        pinnedParticles: pinnedHeadRings,
        noSurfaceCollider: true,
        canSleep: false,
      })

      // Descending hoist / halyard rope from pulley left tangent to wooden toggle.
      const { pulleyLeft, end } = halyardEndpoints()
      halyardBody = session.createRope({
        start: { x: pulleyLeft.x, y: pulleyLeft.y, z: pulleyLeft.z },
        end: { x: end.x, y: end.y, z: end.z },
        numParticles: ROPE_PARTICLES,
        pinnedParticles: [0, ROPE_PARTICLES - 1],
        mass: 0.14,
        particleRadius: 0.012,
        linearDamping: 2.8,
        edgeSoftness: { naturalFrequency: 30, dampingRatio: 0.85 },
        bendSoftness: { naturalFrequency: 6, dampingRatio: 0.8 },
        friction: 0.55,
        canSleep: false,
      })

      rapierReady = true
      resetTubeToCurrentPose()
      resetHalyardToCurrentPose()
      // Warm up briefly so initial wind/gravity shape settles smoothly on first live frame.
      host.settle(12, applyPhysicsForces)
      physicsStepped = true
    },
  })

  function applyPhysicsForces(_session: RapierSoftBodySession, subDt: number) {
    simClock += subDt
    const t = simClock
    if (tubeBody && tubeBody.isValid()) {
      tubeBody.resetForces(false)
      const pos = tubeBody.particlePositions()
      const pMass = Math.max(tubeBody.mass() / (TUBE_ALONG * TUBE_AROUND), 1e-4)

      // Update pinned head rings (u <= 0.23) to stay locked to the current unfurl/sag pose.
      for (let ri = 0; ri < 4; ri++) {
        const u = ri / (TUBE_ALONG - 1)
        const r = radius(u)
        const zScale = 1 - (1 - spread) * Math.sin(u * Math.PI / 2)
        const baseY = -sag * u * u
        for (let rj = 0; rj < TUBE_AROUND; rj++) {
          const phi = (rj / TUBE_AROUND) * Math.PI * 2
          const k = ri * TUBE_AROUND + rj
          tubeBody.setParticleKinematicTarget(k, {
            x: length * u,
            y: baseY + r * Math.sin(phi),
            z: -r * Math.cos(phi) * zScale,
          })
        }
      }

      // Aerodynamic wind, internal inflation pressure, and travelling gusts on free rings.
      for (let ri = 4; ri < TUBE_ALONG; ri++) {
        const u = ri / (TUBE_ALONG - 1)
        const r = radius(u)
        const zScale = 1 - (1 - spread) * Math.sin(u * Math.PI / 2)
        const tailWeight = Math.max(0, (u - 0.25) / 0.75) ** 1.25
        // Compute current ring centroid for outward radial pressure.
        let cx = 0, cy = 0, cz = 0
        for (let rj = 0; rj < TUBE_AROUND; rj++) {
          const k = (ri * TUBE_AROUND + rj) * 3
          cx += pos[k]!; cy += pos[k + 1]!; cz += pos[k + 2]!
        }
        cx /= TUBE_AROUND; cy /= TUBE_AROUND; cz /= TUBE_AROUND

        const targetY = -sag * u * u
        const gustY = wind * tailWeight * (12.8 * Math.sin(t * 2.85 - u * 7.0) + 4.0 * Math.sin(t * 4.7 - u * 11.6))
        const gustZ = wind * tailWeight * (14.2 * Math.sin(t * 2.35 - u * 6.4) + 4.4 * Math.sin(t * 3.9 - u * 10.8))
        const liftAssist = pMass * (4.12 * (0.42 + 0.58 * wind))

        for (let rj = 0; rj < TUBE_AROUND; rj++) {
          const phi = (rj / TUBE_AROUND) * Math.PI * 2
          const k = ri * TUBE_AROUND + rj
          const px = pos[k * 3]!, py = pos[k * 3 + 1]!, pz = pos[k * 3 + 2]!
          const targetX = length * u
          const targetPy = targetY + r * Math.sin(phi)
          const targetPz = -r * Math.cos(phi) * zScale

          // Outward radial windsock pressure (keeps cloth full and readable under cel shading).
          const dy = py - cy, dz = pz - cz
          const dLen = Math.hypot(dy, dz) || 1
          const radialPressure = pMass * (1.5 + 5.2 * wind) * (r / Math.max(dLen, 0.08) - 0.85)

          const fx = pMass * (38 * (targetX - px) + 7.5 * wind)
          const fy = liftAssist + pMass * (6.2 * (targetPy - py) + gustY) + radialPressure * (dy / dLen)
          const fz = pMass * (5.2 * (targetPz - pz) + gustZ) + radialPressure * (dz / dLen)
          tubeBody.addParticleForce(k, { x: fx, y: fy, z: fz }, false)
        }
      }
    }

    if (halyardBody && halyardBody.isValid()) {
      halyardBody.resetForces(false)
      const { pulleyLeft, end } = halyardEndpoints()
      halyardBody.setParticleKinematicTarget(0, { x: pulleyLeft.x, y: pulleyLeft.y, z: pulleyLeft.z })
      halyardBody.setParticleKinematicTarget(ROPE_PARTICLES - 1, { x: end.x, y: end.y, z: end.z })
      const m = Math.max(halyardBody.mass() / ROPE_PARTICLES, 1e-4)
      for (let i = 1; i < ROPE_PARTICLES - 1; i++) {
        const s = i / (ROPE_PARTICLES - 1)
        const bell = Math.sin(Math.PI * s)
        const windX = m * bell * (0.85 + 2.4 * wind * (0.6 + 0.4 * Math.sin(t * 2.1 - s * 3.5)))
        const windZ = m * bell * (0.4 + 1.6 * wind * Math.cos(t * 1.7 - s * 4.0))
        halyardBody.addParticleForce(i, { x: windX, y: 0, z: windZ }, false)
      }
    }
  }

  function extractTubeRingDisplacements() {
    if (!tubeBody || !tubeBody.isValid()) return false
    const pos = tubeBody.particlePositions()
    const vel = tubeBody.particleVelocities()
    for (let ri = 0; ri < TUBE_ALONG; ri++) {
      const u = ri / (TUBE_ALONG - 1)
      const baseY = -sag * u * u
      const r = radius(u)
      const zScale = 1 - (1 - spread) * Math.sin(u * Math.PI / 2)
      let cy = 0, cz = 0, sy = 0, sz = 0
      for (let rj = 0; rj < TUBE_AROUND; rj++) {
        const k = (ri * TUBE_AROUND + rj) * 3
        cy += pos[k + 1]!; cz += pos[k + 2]!
      }
      cy /= TUBE_AROUND; cz /= TUBE_AROUND
      for (let rj = 0; rj < TUBE_AROUND; rj++) {
        const k = (ri * TUBE_AROUND + rj) * 3
        sy += Math.abs(pos[k + 1]! - cy)
        sz += Math.abs(pos[k + 2]! - cz)
      }
      const meanAbsY = sy / TUBE_AROUND
      const meanAbsZ = sz / TUBE_AROUND
      const refAbsY = Math.max(r * (2 / Math.PI), 1e-4)
      const refAbsZ = Math.max(r * zScale * (2 / Math.PI), 1e-4)
      // Bound wave displacement cleanly inside the framing envelope.
      const dy = cy - baseY
      const dz = cz
      ringCenterY[ri] = Math.tanh(dy / 0.27) * 0.27
      ringCenterZ[ri] = Math.tanh(dz / 0.29) * 0.29
      ringRadialScaleY[ri] = THREE.MathUtils.clamp(meanAbsY / refAbsY, 0.84, 1.16)
      ringRadialScaleZ[ri] = THREE.MathUtils.clamp(meanAbsZ / refAbsZ, 0.82, 1.18)
    }
    let vy = 0, vz = 0
    const lastOffset = (TUBE_ALONG - 1) * TUBE_AROUND
    for (let rj = 0; rj < TUBE_AROUND; rj++) {
      const k = (lastOffset + rj) * 3
      vy += vel[k + 1]!; vz += vel[k + 2]!
    }
    ringTailVelY.value = vy / TUBE_AROUND
    ringTailVelZ.value = vz / TUBE_AROUND
    return true
  }

  function writeBodyAndTails(time: number, fromRapier: boolean) {
    const p = bodyGeometry.getAttribute('position') as THREE.BufferAttribute
    const hasRapierData = fromRapier && extractTubeRingDisplacements()

    for (let i = 0; i <= rows; i++) {
      const u = i / rows, r = radius(u)
      let wy = 0, wz = 0, scaleY = 1, scaleZ = 1
      if (hasRapierData) {
        const blend = THREE.MathUtils.smoothstep(u, 0.24, 0.36)
        const fu = u * (TUBE_ALONG - 1)
        const r0 = Math.floor(fu), r1 = Math.min(TUBE_ALONG - 1, r0 + 1), alpha = fu - r0
        wy = (ringCenterY[r0]! * (1 - alpha) + ringCenterY[r1]! * alpha) * blend
        wz = (ringCenterZ[r0]! * (1 - alpha) + ringCenterZ[r1]! * alpha) * blend
        scaleY = THREE.MathUtils.lerp(1, ringRadialScaleY[r0]! * (1 - alpha) + ringRadialScaleY[r1]! * alpha, blend * 0.65)
        scaleZ = THREE.MathUtils.lerp(1, ringRadialScaleZ[r0]! * (1 - alpha) + ringRadialScaleZ[r1]! * alpha, blend * 0.65)
      } else {
        const [py, pz] = wave(u, time)
        wy = py!; wz = pz!
      }
      const zSpread = 1 - (1 - spread) * Math.sin(u * Math.PI / 2)
      for (let j = 0; j <= columns; j++) {
        const theta = j / columns * Math.PI * 2
        p.setXYZ(
          i * (columns + 1) + j,
          length * u,
          -sag * u * u + r * scaleY * Math.cos(theta) + wy,
          r * scaleZ * Math.sin(theta) * zSpread + wz,
        )
      }
    }
    p.needsUpdate = true; bodyGeometry.computeVertexNormals(); bodyGeometry.computeBoundingBox(); bodyGeometry.computeBoundingSphere()

    // Stitch both tail roots seamlessly onto bodyGeometry's exact rear rim (i = rows).
    const rimOffset = rows * (columns + 1)
    const endWy = hasRapierData ? ringCenterY[TUBE_ALONG - 1]! : wave(1, time)[0]!
    const endWz = hasRapierData ? ringCenterZ[TUBE_ALONG - 1]! : wave(1, time)[1]!
    const velLagY = hasRapierData ? THREE.MathUtils.clamp(-ringTailVelY.value * 0.045, -0.07, 0.07) : 0
    const velLagZ = hasRapierData ? THREE.MathUtils.clamp(-ringTailVelZ.value * 0.06, -0.09, 0.09) : 0

    tails.forEach((t, index) => {
      const v = t.geometry.getAttribute('position') as THREE.BufferAttribute
      const baseX = t.position.x, baseY = t.position.y
      for (let j = 0; j <= 24; j++) {
        const bodyIdx = rimOffset + (index === 0 ? j : columns - j)
        const rx = p.getX(bodyIdx) - baseX
        const ry = p.getY(bodyIdx) - baseY
        const rz = p.getZ(bodyIdx)
        v.setXYZ(j, rx, ry, rz)
        const theta = j * Math.PI / 24, h = Math.cos(theta)
        for (let i = 1; i <= 8; i++) {
          const u = i / 8
          const flap = wind * u * u * h * (.085 * Math.sin(time * 4.1 - u * 2.2) + .038 * Math.sin(time * 2.6 + theta * 2))
          const tipY = THREE.MathUtils.lerp(ry, .30 * h + endWy + velLagY, u) + flap * .45
          const minSep = (index === 0 ? 1 : -1) * Math.max(0.012, radius(1) * spread * Math.sin(theta) * (1 - .78 * u))
          const tipZ = THREE.MathUtils.lerp(rz, minSep + endWz + velLagZ, u) + flap
          v.setXYZ(i * 25 + j, rx + (.20 + .16 * Math.abs(h)) * u, tipY, tipZ)
        }
      }
      v.needsUpdate = true; t.geometry.computeVertexNormals(); t.geometry.computeBoundingBox(); t.geometry.computeBoundingSphere()
    })
  }

  function flutter(time: number) {
    writeBodyAndTails(time, false)
  }

  function stepPhysics(dt: number, time: number) {
    if (disposed || options.isReducedMotion?.()) {
      flutter(0)
      writeHalyardGeometry(false)
      return false
    }
    if (rapierReady && tubeBody && halyardBody) {
      const stepped = host.step(dt, applyPhysicsForces)
      if (stepped || physicsStepped) {
        physicsStepped = true
        writeBodyAndTails(time, true)
        writeHalyardGeometry(true)
        return stepped
      }
    }
    flutter(time)
    writeHalyardGeometry(false)
    return false
  }

  function pose(step: number, amount: number, time = 0) {
    const p = THREE.MathUtils.clamp(step + (step === 3 ? 0 : amount), 0, 3), unfurl = Math.min(1, p), lift = THREE.MathUtils.clamp(p - 1, 0, 1), secure = Math.max(0, p - 2)
    length = 1.12 + .78 * unfurl; sag = .56 * (1 - .65 * lift); spread = .65 + .35 * lift; secureAmount = secure
    wind = (.18 + .82 * lift * lift * (3 - 2 * lift)) * (.45 + .55 * unfurl)
    fish.position.set(-.50, 1.05 + 1.15 * lift, 0)
    const seating = THREE.MathUtils.smoothstep(secure, .22, .74)
    toggle.position.set(-1.30 + .25 * seating, 1.75 - 1.15 * lift - .04 * seating + .20 * Math.sin(Math.PI * secure), .12 + .13 * seating)
    for (const t of tails) t.position.set(length, -sag, 0)
    paint.forEach(({ mesh, source, side, offset }) => {
      mesh.position.set(length * .15, -sag * .15 ** 2, 0)
      const v = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < v.count; i++) {
        const x = source[i * 3]!, y = source[i * 3 + 1]!, u = (mesh.position.x + x) / length, r = radius(u), h = (mesh.position.y + y + sag * u * u) / r
        const z = r * Math.sqrt(Math.max(0, 1 - h * h)) * (1 - (1 - spread) * Math.sin(u * Math.PI / 2))
        v.setXYZ(i, x, y, side * (z + offset))
      }
      v.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere()
    })
    const useRapier = rapierReady && physicsStepped && !options.isReducedMotion?.() && time > 0
    writeBodyAndTails(time, useRapier)
    writeHalyardGeometry(useRapier)
  }

  pose(0, 0)
  return {
    subject,
    pose,
    flutter,
    stepPhysics,
    startPhysics() {
      if (disposed || options.isReducedMotion?.()) return Promise.resolve(null)
      return host.start()
    },
    get rapierReady() { return rapierReady },
    dispose() {
      disposed = true
      tubeBody = null
      halyardBody = null
      rapierReady = false
      host.dispose()
    },
    targets: [tail, toggle, toggle],
    anchors: [[.26, .18, .02], [0, 0, .065], [0, 0, .065]] as XYZ[],
  }
}
