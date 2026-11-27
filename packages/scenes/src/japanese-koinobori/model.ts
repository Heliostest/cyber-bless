import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
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
const PINNED_HEAD_RINGS = 3
const TUBE_REST_LENGTH = 1.9
const ROPE_PARTICLES = 18

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  )
}

function sampleRingSpline(values: Float32Array, u: number): number {
  const last = values.length - 1
  const fu = THREE.MathUtils.clamp(u, 0, 1) * last
  const i1 = Math.min(last - 1, Math.floor(fu))
  const t = fu - i1
  const i0 = Math.max(0, i1 - 1)
  const i2 = Math.min(last, i1 + 1)
  const i3 = Math.min(last, i1 + 2)
  return catmullRom(values[i0]!, values[i1]!, values[i2]!, values[i3]!, t)
}

/** Original single-carp appreciation rig. Cloth tube and halyard rope are driven by lazy Rapier soft bodies when active. */
export function createKoinoboriModel(options: KoinoboriModelOptions = {}) {
  const subject = new THREE.Group(); subject.name = 'koinobori-subject'
  const wood = new THREE.MeshStandardMaterial({ color: 0xc89a63, roughness: .82 })
  const cleatWoodX = new THREE.MeshStandardMaterial({ color: 0xc89a63, roughness: .82 })
  const cleatWoodZ = new THREE.MeshStandardMaterial({ color: 0xbf915c, roughness: .84 })
  const metal = new THREE.MeshStandardMaterial({ color: 0xb1a175, metalness: .25, roughness: .55 })
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x796d50, roughness: .96 })
  applyCraftSurface(wood, { kind: 'wood', strength: .4, axis: 'y' })
  applyCraftSurface(cleatWoodX, { kind: 'wood', strength: .4, axis: 'x' })
  applyCraftSurface(cleatWoodZ, { kind: 'wood', strength: .4, axis: 'z' })
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
  const footProfile = [
    new THREE.Vector2(0, -.06),
    new THREE.Vector2(.348, -.06),
    new THREE.Vector2(.360, -.046),
    new THREE.Vector2(.356, -.018),
    new THREE.Vector2(.314, .034),
    new THREE.Vector2(.288, .054),
    new THREE.Vector2(.266, .06),
    new THREE.Vector2(0, .06),
  ]
  add('koinobori-foot', new THREE.LatheGeometry(footProfile, 36), wood, [-1.05, .02, -.2])
  add('koinobori-pole', new THREE.CylinderGeometry(.048, .068, 3.05, 24), wood, [-1.05, 1.585, -.2])
  add('koinobori-finial', new THREE.SphereGeometry(.08, 20, 12), metal, [-1.05, 3.14, -.2])
  const axle = add('koinobori-pulley-axle', new THREE.CylinderGeometry(.03, .03, .26, 16), metal, [-1.05, 3, -.10]); axle.rotation.x = Math.PI / 2
  const wheel = add('koinobori-pulley', new THREE.CylinderGeometry(.160, .160, .04, 32), wood, [-1.05, 3, 0]); wheel.rotation.x = Math.PI / 2
  for (const z of [-.026, .026]) add('koinobori-pulley-rim-' + z, new THREE.TorusGeometry(.167, .009, 6, 40), metal, [-1.05, 3, z])
  add('koinobori-cleat-support', new RoundedBoxGeometry(.08, .18, .40, 2, .016), cleatWoodZ, [-1.05, .42, -.025])
  add('koinobori-cleat', new RoundedBoxGeometry(.30, .08, .30, 2, .016), cleatWoodX, [-1.05, .42, .13])
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

  let length = 1.12, sag = .56, spread = .65, wind = .18, unfurlAmount = 0, liftAmount = 0, secureAmount = 0, simClock = 0
  let tubeBody: ReturnType<RapierSoftBodySession['createClothTube']> | null = null
  let halyardBody: ReturnType<RapierSoftBodySession['createRope']> | null = null
  let rapierReady = false
  let physicsStepped = false
  let disposed = false

  // Per-ring centerline, velocity & cross-section scratch buffers (no per-frame heap churn).
  const ringCenterX = new Float32Array(TUBE_ALONG)
  const ringCenterY = new Float32Array(TUBE_ALONG)
  const ringCenterZ = new Float32Array(TUBE_ALONG)
  const ringRadialScaleY = new Float32Array(TUBE_ALONG)
  const ringRadialScaleZ = new Float32Array(TUBE_ALONG)
  const simCx = new Float32Array(TUBE_ALONG)
  const simCy = new Float32Array(TUBE_ALONG)
  const simCz = new Float32Array(TUBE_ALONG)
  const simVy = new Float32Array(TUBE_ALONG)
  const simVz = new Float32Array(TUBE_ALONG)
  const meshCx = new Float32Array(rows + 1)
  const meshCy = new Float32Array(rows + 1)
  const meshCz = new Float32Array(rows + 1)
  const meshScaleY = new Float32Array(rows + 1)
  const meshScaleZ = new Float32Array(rows + 1)
  const ringTailVelY = { value: 0 }
  const ringTailVelZ = { value: 0 }
  const ropePts: THREE.Vector3[] = Array.from({ length: ROPE_PARTICLES }, () => new THREE.Vector3())
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpT = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpBi = new THREE.Vector3(), tmpQ = new THREE.Vector3()
  const axisX = new THREE.Vector3(1, 0, 0), axisY = new THREE.Vector3(0, 1, 0)

  const radius = (u: number) => .32 * (1 - .55 * u) + .05 * Math.sin(u * Math.PI)
  const softBound = (v: number, lo: number, hi: number, knee = 0.14) =>
    v < lo ? lo - knee * Math.tanh((lo - v) / knee) : v > hi ? hi + knee * Math.tanh((v - hi) / knee) : v
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
    // Initialize on an arc-length-preserving droop curve in canonical TUBE_REST_LENGTH space
    // so tension-only edges start relaxed without axial compression buckling or recoil snap.
    const ds = TUBE_REST_LENGTH / (TUBE_ALONG - 1)
    const headSag = sag * (TUBE_REST_LENGTH / Math.max(length, 0.5))
    let curX = 0, curY = 0
    for (let ri = 0; ri < TUBE_ALONG; ri++) {
      const u = ri / (TUBE_ALONG - 1)
      const r = radius(u)
      const zScale = 1 - (1 - spread) * Math.sin(u * Math.PI / 2)
      let cx: number, cy: number
      if (ri < PINNED_HEAD_RINGS) {
        cx = TUBE_REST_LENGTH * u
        cy = -headSag * u * u
        curX = cx; curY = cy
      } else {
        const slope = THREE.MathUtils.clamp((-2 * headSag * u) / TUBE_REST_LENGTH, -0.78, 0)
        const inv = 1 / Math.hypot(1, slope)
        curX += ds * inv
        curY += ds * slope * inv
        cx = curX; cy = curY
      }
      for (let rj = 0; rj < TUBE_AROUND; rj++) {
        const phi = (rj / TUBE_AROUND) * Math.PI * 2
        const k = ri * TUBE_AROUND + rj
        tubeBody.setParticlePosition(k, {
          x: cx,
          y: cy + r * Math.sin(phi),
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
  for (let ri = 0; ri < PINNED_HEAD_RINGS; ri++) {
    for (let rj = 0; rj < TUBE_AROUND; rj++) pinnedHeadRings.push(ri * TUBE_AROUND + rj)
  }

  const host = createRapierSoftBodyHost({
    gravity: { x: 0, y: -9.81, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 6,
    internalPgsIterations: 3,
    // Koinobori flies continuously in wind when active; disable auto-sleep while wind is active.
    sleepSpeedThreshold: 0,
    isActive: options.isActive,
    isReducedMotion: options.isReducedMotion,
    onReady(session) {
      if (disposed) return
      // Rigid colliders for the wooden pole, pulley wheel and cleat so the halyard contacts real solids.
      session.addFixedCylinder({ x: -1.05, y: 1.585, z: -0.2 }, 0.068, 3.05, { friction: 0.6 })
      session.addFixedBox({ x: -1.05, y: 0.42, z: 0.13 }, { x: 0.30, y: 0.12, z: 0.30 }, { friction: 0.6 })

      // Carp cloth tube in canonical fish-local coordinate space.
      // tensionOnly lets fabric fold/curve freely in compression like real linen instead of acting like a rigid pipe.
      tubeBody = session.createClothTube({
        origin: { x: 0, y: 0, z: 0 },
        axis: { x: TUBE_REST_LENGTH, y: 0, z: 0 },
        radiusStart: 0.32,
        radiusEnd: 0.144,
        numAround: TUBE_AROUND,
        numAlong: TUBE_ALONG,
        mass: 0.36,
        particleRadius: 0.02,
        linearDamping: 2.3,
        gravityScale: 0.50,
        edgeSoftness: { naturalFrequency: 24, dampingRatio: 0.78 },
        bendSoftness: { naturalFrequency: 3.4, dampingRatio: 0.76 },
        tensionOnly: true,
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
      // Warm up into a fully developed gravity drape & traveling wind S-wave on the first live frame.
      host.settle(54, applyPhysicsForces)
      physicsStepped = true
    },
  })

  function applyPhysicsForces(_session: RapierSoftBodySession, subDt: number) {
    simClock += subDt
    const t = simClock
    if (tubeBody && tubeBody.isValid()) {
      tubeBody.resetForces(false)
      const pos = tubeBody.particlePositions()
      const vel = tubeBody.particleVelocities()
      const pMass = Math.max(tubeBody.mass() / (TUBE_ALONG * TUBE_AROUND), 1e-4)

      // Update pinned head rings (mouth hoop & eye anchor) in canonical rest-length space.
      const headSag = sag * (TUBE_REST_LENGTH / Math.max(length, 0.5))
      for (let ri = 0; ri < PINNED_HEAD_RINGS; ri++) {
        const u = ri / (TUBE_ALONG - 1)
        const r = radius(u)
        const zScale = 1 - (1 - spread) * Math.sin(u * Math.PI / 2)
        const baseY = -headSag * u * u
        for (let rj = 0; rj < TUBE_AROUND; rj++) {
          const phi = (rj / TUBE_AROUND) * Math.PI * 2
          const k = ri * TUBE_AROUND + rj
          tubeBody.setParticleKinematicTarget(k, {
            x: TUBE_REST_LENGTH * u,
            y: baseY + r * Math.sin(phi),
            z: -r * Math.cos(phi) * zScale,
          })
        }
      }

      // Compute ring centroids and transverse velocities for local cross-section inflation & air damping.
      for (let ri = 0; ri < TUBE_ALONG; ri++) {
        let cx = 0, cy = 0, cz = 0, vy = 0, vz = 0
        for (let rj = 0; rj < TUBE_AROUND; rj++) {
          const k = (ri * TUBE_AROUND + rj) * 3
          cx += pos[k]!; cy += pos[k + 1]!; cz += pos[k + 2]!
          vy += vel[k + 1]!; vz += vel[k + 2]!
        }
        simCx[ri] = cx / TUBE_AROUND
        simCy[ri] = cy / TUBE_AROUND
        simCz[ri] = cz / TUBE_AROUND
        simVy[ri] = vy / TUBE_AROUND
        simVz[ri] = vz / TUBE_AROUND
      }

      // Horizontal wind drag scales with unfurled sail area and hoisting height so real gravity
      // naturally produces a deep entry drape and a buoyant high-altitude droop without cancelling weight.
      const windDragX = 5.1 + 6.9 * unfurlAmount + 6.4 * liftAmount * liftAmount

      for (let ri = PINNED_HEAD_RINGS; ri < TUBE_ALONG; ri++) {
        const u = ri / (TUBE_ALONG - 1)
        const r = radius(u)
        const zScale = 1 - (1 - spread) * Math.sin(u * Math.PI / 2)
        // Area-weighted aerodynamic excitation: ramps smoothly behind the gill collar so the
        // dorsal outline never pinches, drives a clean ~1-wavelength S-curve across the body,
        // and tapers softly at the narrow open tail to avoid chaotic whip.
        const headRamp = THREE.MathUtils.smoothstep(u, 0.20, 0.42)
        const tipTaper = 1 - 0.36 * THREE.MathUtils.clamp((u - 0.72) / 0.28, 0, 1)
        const areaWeight = headRamp * (r / 0.24) * tipTaper

        const rPrev = Math.max(0, ri - 1)
        const rNext = Math.min(TUBE_ALONG - 1, ri + 1)
        let tx = simCx[rNext]! - simCx[rPrev]!
        let ty = simCy[rNext]! - simCy[rPrev]!
        let tz = simCz[rNext]! - simCz[rPrev]!
        const tLen = Math.hypot(tx, ty, tz) || 1
        tx = Math.max(tx / tLen, 0.25); ty /= tLen; tz /= tLen
        const tRenorm = Math.hypot(tx, ty, tz) || 1
        tx /= tRenorm; ty /= tRenorm; tz /= tRenorm

        // Local cross-section basis (U, S) perpendicular to centerline tangent T.
        let sx = -tz, sz = tx
        const sLen = Math.hypot(sx, sz) || 1
        sx /= sLen; sz /= sLen
        const ux = -sz * ty
        const uy = sz * tx - sx * tz
        const uz = sx * ty

        const waveY = wind * areaWeight * (
          31 * Math.sin(t * 2.75 - u * 8.0) +
          7.5 * Math.sin(t * 4.35 - u * 12.2)
        )
        const waveZ = wind * areaWeight * (
          15 * Math.sin(t * 2.15 - u * 7.0) +
          4.2 * Math.sin(t * 3.35 - u * 10.6)
        )

        const aeroDragX = windDragX * (0.55 + 0.75 * (r / 0.26))
        const airDampY = -3.6 * simVy[ri]!
        const airDampZ = -3.6 * simVz[ri]! - 5.2 * simCz[ri]!
        const inflateK = 95 + 120 * wind

        for (let rj = 0; rj < TUBE_AROUND; rj++) {
          const phi = (rj / TUBE_AROUND) * Math.PI * 2
          const k = ri * TUBE_AROUND + rj
          const px = pos[k * 3]!, py = pos[k * 3 + 1]!, pz = pos[k * 3 + 2]!

          // Internal windsock inflation around this ring's own centroid (zero net force on centerline).
          const sinP = Math.sin(phi)
          const negCosP = -Math.cos(phi)
          const idealDx = r * sinP * ux + r * zScale * negCosP * sx
          const idealDy = r * sinP * uy
          const idealDz = r * sinP * uz + r * zScale * negCosP * sz

          const infX = inflateK * (idealDx - (px - simCx[ri]!))
          const infY = inflateK * (idealDy - (py - simCy[ri]!))
          const infZ = inflateK * (idealDz - (pz - simCz[ri]!))

          const fx = pMass * (aeroDragX + infX)
          const fy = pMass * (waveY + airDampY + infY)
          const fz = pMass * (waveZ + airDampZ + infZ)
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
    const scale = length / TUBE_REST_LENGTH
    for (let ri = 0; ri < TUBE_ALONG; ri++) {
      const u = ri / (TUBE_ALONG - 1)
      const r = radius(u)
      const zScale = 1 - (1 - spread) * Math.sin(u * Math.PI / 2)
      let cx = 0, cy = 0, cz = 0, sy = 0, sz = 0
      for (let rj = 0; rj < TUBE_AROUND; rj++) {
        const k = (ri * TUBE_AROUND + rj) * 3
        cx += pos[k]!; cy += pos[k + 1]!; cz += pos[k + 2]!
      }
      cx /= TUBE_AROUND; cy /= TUBE_AROUND; cz /= TUBE_AROUND
      for (let rj = 0; rj < TUBE_AROUND; rj++) {
        const k = (ri * TUBE_AROUND + rj) * 3
        sy += Math.abs(pos[k + 1]! - cy)
        sz += Math.abs(pos[k + 2]! - cz)
      }
      const meanAbsY = sy / TUBE_AROUND
      const meanAbsZ = sz / TUBE_AROUND
      const refAbsY = Math.max(r * (2 / Math.PI), 1e-4)
      const refAbsZ = Math.max(r * zScale * (2 / Math.PI), 1e-4)

      const rawX = cx * scale
      const minX = ri === 0 ? 0 : ringCenterX[ri - 1]! + 0.018 * scale
      ringCenterX[ri] = THREE.MathUtils.clamp(rawX, minX, length * 1.03)
      // Preserve true Rapier gravity droop & S-wave 1:1 within the framing envelope; only soft-knee outside.
      ringCenterY[ri] = softBound(cy * scale, -0.66, 0.34, 0.14)
      ringCenterZ[ri] = softBound(cz * scale, -0.34, 0.34, 0.12)

      // Preserve plump anime windsock fullness while conveying subtle cross-section ovalization/breathing.
      const ratioY = meanAbsY / refAbsY
      const ratioZ = meanAbsZ / refAbsZ
      const meanRatio = Math.max((ratioY + ratioZ) * 0.5, 0.2)
      const ovalY = ratioY / meanRatio
      const ovalZ = ratioZ / meanRatio
      const breath = 1 + (meanRatio - 0.78) * 0.20
      ringRadialScaleY[ri] = THREE.MathUtils.clamp(breath * THREE.MathUtils.lerp(1, ovalY, 0.45), 0.93, 1.09)
      ringRadialScaleZ[ri] = THREE.MathUtils.clamp(breath * THREE.MathUtils.lerp(1, ovalZ, 0.45), 0.93, 1.09)
    }
    // Two lightweight binomial smoothing passes over free rings remove local ring-to-ring curvature
    // kinks so scales stay evenly spaced on inner bends while preserving full Rapier droop & S-waves.
    for (let pass = 0; pass < 2; pass++) {
      simCx.set(ringCenterX); simCy.set(ringCenterY); simCz.set(ringCenterZ)
      for (let ri = PINNED_HEAD_RINGS; ri < TUBE_ALONG - 1; ri++) {
        ringCenterX[ri] = 0.20 * simCx[ri - 1]! + 0.60 * simCx[ri]! + 0.20 * simCx[ri + 1]!
        ringCenterY[ri] = 0.20 * simCy[ri - 1]! + 0.60 * simCy[ri]! + 0.20 * simCy[ri + 1]!
        ringCenterZ[ri] = 0.20 * simCz[ri - 1]! + 0.60 * simCz[ri]! + 0.20 * simCz[ri + 1]!
      }
    }
    let vy = 0, vz = 0
    const lastOffset = (TUBE_ALONG - 1) * TUBE_AROUND
    for (let rj = 0; rj < TUBE_AROUND; rj++) {
      const k = (lastOffset + rj) * 3
      vy += vel[k + 1]!; vz += vel[k + 2]!
    }
    ringTailVelY.value = (vy / TUBE_AROUND) * scale
    ringTailVelZ.value = (vz / TUBE_AROUND) * scale
    return true
  }

  function writeBodyAndTails(time: number, fromRapier: boolean) {
    const p = bodyGeometry.getAttribute('position') as THREE.BufferAttribute
    const hasRapierData = fromRapier && extractTubeRingDisplacements()

    if (hasRapierData) {
      // Exact back edge of the painted eye rings so mouth & eyes stay completely flush and undistorted.
      const headRigidEnd = 0.15 + 0.125 / Math.max(length, 0.5)
      for (let i = 0; i <= rows; i++) {
        const u = i / rows
        const blend = THREE.MathUtils.smoothstep(u, headRigidEnd, headRigidEnd + 0.18)
        const hx = length * u
        const hy = -sag * u * u
        meshCx[i] = THREE.MathUtils.lerp(hx, sampleRingSpline(ringCenterX, u), blend)
        meshCy[i] = THREE.MathUtils.lerp(hy, sampleRingSpline(ringCenterY, u), blend)
        meshCz[i] = sampleRingSpline(ringCenterZ, u) * blend
        meshScaleY[i] = THREE.MathUtils.lerp(1, sampleRingSpline(ringRadialScaleY, u), blend)
        meshScaleZ[i] = THREE.MathUtils.lerp(1, sampleRingSpline(ringRadialScaleZ, u), blend)
      }

      let endTx = 1, endTy = 0, endTz = 0
      let endRy = radius(1), endRz = radius(1) * spread
      for (let i = 0; i <= rows; i++) {
        const u = i / rows, r = radius(u)
        const zSpread = 1 - (1 - spread) * Math.sin(u * Math.PI / 2)
        const frameBlend = THREE.MathUtils.smoothstep(u, headRigidEnd, headRigidEnd + 0.20) * 0.54
        const iPrev = Math.max(0, i - 1), iNext = Math.min(rows, i + 1)
        let tx = meshCx[iNext]! - meshCx[iPrev]!
        let ty = meshCy[iNext]! - meshCy[iPrev]!
        let tz = meshCz[iNext]! - meshCz[iPrev]!
        const tLen = Math.hypot(tx, ty, tz) || 1
        tx = THREE.MathUtils.lerp(1, tx / tLen, frameBlend)
        ty = THREE.MathUtils.lerp(0, ty / tLen, frameBlend)
        tz = THREE.MathUtils.lerp(0, tz / tLen, frameBlend)
        const nLen = Math.hypot(tx, ty, tz) || 1
        tx /= nLen; ty /= nLen; tz /= nLen

        // Twist-free orthonormal cross-section frame: S = normalize(T x Y), U = S x T.
        let sx = -tz, sz = tx
        const sLen = Math.hypot(sx, sz) || 1
        sx /= sLen; sz /= sLen
        const ux = -sz * ty
        const uy = sz * tx - sx * tz
        const uz = sx * ty

        const cx = meshCx[i]!, cy = meshCy[i]!, cz = meshCz[i]!
        const rY = r * meshScaleY[i]!, rZ = r * meshScaleZ[i]! * zSpread
        if (i === rows) {
          endTx = tx; endTy = ty; endTz = tz
          endRy = rY; endRz = rZ
        }
        for (let j = 0; j <= columns; j++) {
          const theta = j / columns * Math.PI * 2
          const ct = Math.cos(theta), st = Math.sin(theta)
          p.setXYZ(
            i * (columns + 1) + j,
            cx + rY * ct * ux + rZ * st * sx,
            cy + rY * ct * uy,
            cz + rY * ct * uz + rZ * st * sz,
          )
        }
      }
      p.needsUpdate = true; bodyGeometry.computeVertexNormals(); bodyGeometry.computeBoundingBox(); bodyGeometry.computeBoundingSphere()

      // Stitch both tail roots seamlessly onto bodyGeometry's exact rear rim (i = rows) and
      // sweep the forked fins organically along the rear body tangent with soft inertial trail lag.
      const rimOffset = rows * (columns + 1)
      const lagY = THREE.MathUtils.clamp(-ringTailVelY.value * 0.11, -0.22, 0.22)
      const lagZ = THREE.MathUtils.clamp(-ringTailVelZ.value * 0.13, -0.24, 0.24)
      let tipTx = Math.max(endTx, 0.65)
      let tipTy = THREE.MathUtils.clamp(endTy + lagY, -0.52, 0.44)
      let tipTz = THREE.MathUtils.clamp(endTz + lagZ, -0.45, 0.45)
      const tipLen = Math.hypot(tipTx, tipTy, tipTz) || 1
      tipTx /= tipLen; tipTy /= tipLen; tipTz /= tipLen

      const endCx = meshCx[rows]!, endCy = meshCy[rows]!, endCz = meshCz[rows]!
      tails.forEach((t, index) => {
        const v = t.geometry.getAttribute('position') as THREE.BufferAttribute
        const baseX = t.position.x, baseY = t.position.y
        const rimLocalX = endCx - baseX, rimLocalY = endCy - baseY, rimLocalZ = endCz
        const sign = index === 0 ? 1 : -1
        for (let j = 0; j <= 24; j++) {
          const bodyIdx = rimOffset + (index === 0 ? j : columns - j)
          const rx = p.getX(bodyIdx) - baseX
          const ry = p.getY(bodyIdx) - baseY
          const rz = p.getZ(bodyIdx)
          v.setXYZ(j, rx, ry, rz)
          const theta = j * Math.PI / 24, h = Math.cos(theta), s = Math.sin(theta)
          const tipHalfSep = Math.max(0.012, radius(1) * spread * s * 0.22)
          for (let i = 1; i <= 8; i++) {
            const u = i / 8
            const ext = (.21 + .16 * Math.abs(h)) * u
            let dx = THREE.MathUtils.lerp(endTx, tipTx, 0.55 * u)
            let dy = THREE.MathUtils.lerp(endTy, tipTy, 0.55 * u)
            let dz = THREE.MathUtils.lerp(endTz, tipTz, 0.55 * u)
            const dLen = Math.hypot(dx, dy, dz) || 1
            dx /= dLen; dy /= dLen; dz /= dLen
            let sx = -dz, sz = dx
            const sLen = Math.hypot(sx, sz) || 1
            sx /= sLen; sz /= sLen
            const ux = -sz * dy
            const uy = sz * dx - sx * dz
            const uz = sx * dy

            const fanH = THREE.MathUtils.lerp(endRy * h, .31 * h, u)
            const sep = sign * THREE.MathUtils.lerp(endRz * s, tipHalfSep, u)
            const flap = wind * u * u * h * (.075 * Math.sin(time * 4.1 - u * 2.2) + .034 * Math.sin(time * 2.6 + theta * 2))
            const hTotal = fanH + flap * .38
            const sTotal = sep + flap
            v.setXYZ(
              i * 25 + j,
              rimLocalX + dx * ext + hTotal * ux + sTotal * sx,
              rimLocalY + dy * ext + hTotal * uy,
              rimLocalZ + dz * ext + hTotal * uz + sTotal * sz,
            )
          }
        }
        v.needsUpdate = true; t.geometry.computeVertexNormals(); t.geometry.computeBoundingBox(); t.geometry.computeBoundingSphere()
      })
      return
    }

    for (let i = 0; i <= rows; i++) {
      const u = i / rows, r = radius(u)
      const [py, pz] = wave(u, time)
      const wy = py!, wz = pz!
      const zSpread = 1 - (1 - spread) * Math.sin(u * Math.PI / 2)
      for (let j = 0; j <= columns; j++) {
        const theta = j / columns * Math.PI * 2
        p.setXYZ(
          i * (columns + 1) + j,
          length * u,
          -sag * u * u + r * Math.cos(theta) + wy,
          r * Math.sin(theta) * zSpread + wz,
        )
      }
    }
    p.needsUpdate = true; bodyGeometry.computeVertexNormals(); bodyGeometry.computeBoundingBox(); bodyGeometry.computeBoundingSphere()

    const rimOffset = rows * (columns + 1)
    const [endWy, endWz] = wave(1, time)
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
          const tipY = THREE.MathUtils.lerp(ry, .30 * h + endWy!, u) + flap * .45
          const minSep = (index === 0 ? 1 : -1) * Math.max(0.012, radius(1) * spread * Math.sin(theta) * (1 - .78 * u))
          const tipZ = THREE.MathUtils.lerp(rz, minSep + endWz!, u) + flap
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
    length = 1.12 + .78 * unfurl; sag = .56 * (1 - .65 * lift); spread = .65 + .35 * lift; unfurlAmount = unfurl; liftAmount = lift; secureAmount = secure
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
