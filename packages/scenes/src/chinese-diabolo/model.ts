import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'
import * as THREE from 'three'

export interface DiaboloModelOptions {
  isActive?: () => boolean
  isReducedMotion?: () => boolean
}

const CORD_SEGMENTS = 32
const CORD_POINTS = CORD_SEGMENTS + 1 // 33 stations & Rapier particles (0=left tip, 32=right tip)
const AXLE_WRAP_RADIUS = 0.091 // axle radius 0.075 + cord radius 0.012 + 0.004 clearance
const CORD_Z = -0.5

/** Original bamboo/wood double-wheel toy; handsticks and rotor use assisted paths while cord uses hybrid Rapier/analytical dynamics. */
export function createDiaboloModel(options: DiaboloModelOptions = {}) {
  const subject = new THREE.Group(); subject.name = 'diabolo-subject'
  const material = (color: number, roughness = .72) => new THREE.MeshStandardMaterial({ color, roughness })
  const bamboo = material(0xd9ad67), cap = material(0xf1d49d), teal = material(0x3c928a), inner = material(0x775235), coral = material(0xcb7454), cordMat = material(0xecd394, .92)
  applyCraftSurface(cordMat, { kind: 'cord', strength: .25 })
  const add = (parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const cylinderZ = (parent: THREE.Object3D, name: string, radius: number, depth: number, mat: THREE.Material, z = 0) => {
    const mesh = add(parent, name, new THREE.CylinderGeometry(radius, radius, depth, 40), mat); mesh.rotation.x = Math.PI / 2; mesh.position.z = z; return mesh
  }
  const rotor = new THREE.Group(); rotor.name = 'diabolo-rotor'; subject.add(rotor)
  cylinderZ(rotor, 'diabolo-axle', .075, 1.12, inner)
  for (const [i, z] of [-.48, .48].entries()) {
    const wheel = new THREE.Group(); wheel.name = `diabolo-wheel-${i}`; wheel.position.z = z; rotor.add(wheel)
    for (const sign of [-1, 1]) {
      cylinderZ(wheel, `diabolo-cap-${i}-${sign}`, .52, .025, cap, sign * .1125)
      const rim = add(wheel, `diabolo-rim-${i}-${sign}`, new THREE.TorusGeometry(.505, .013, 6, 48), teal); rim.position.z = sign * .126
      cylinderZ(wheel, `diabolo-hub-${i}-${sign}`, .135, .015, bamboo, sign * .133)
      for (let n = 0; n < 3; n++) {
        const marker = cylinderZ(wheel, `diabolo-mark-${i}-${sign}-${n}`, .044, .004, n === 0 ? coral : teal, sign * .127)
        marker.position.x = Math.cos(n * Math.PI * 2 / 3) * .34; marker.position.y = Math.sin(n * Math.PI * 2 / 3) * .34
      }
    }
    // Closed annular wall sectors leave actual apertures into the hollow drum.
    const slots = [[0, .15], [Math.PI / 2, .065], [Math.PI + .25, .065], [Math.PI * 1.5, .065]]
    for (let n = 0; n < slots.length; n++) {
      const start = slots[n]![0]! + slots[n]![1]!, next = slots[(n + 1) % slots.length]!, end = next[0]! - next[1]! + (n === slots.length - 1 ? Math.PI * 2 : 0)
      const shape = new THREE.Shape(); shape.moveTo(.52 * Math.cos(start), .52 * Math.sin(start)); shape.absarc(0, 0, .52, start, end, false)
      shape.lineTo(.468 * Math.cos(end), .468 * Math.sin(end)); shape.absarc(0, 0, .468, end, start, true); shape.closePath()
      const wall = new THREE.ExtrudeGeometry(shape, { depth: .20, bevelEnabled: false, curveSegments: 12 }); wall.translate(0, 0, -.10)
      add(wheel, `diabolo-wall-${i}-${n}`, wall, bamboo)
    }
  }
  const sticks = ['left', 'right'].map(side => {
    const stick = new THREE.Group(); stick.name = `diabolo-${side}-stick`; subject.add(stick)
    cylinderZ(stick, `diabolo-${side}-shaft`, .046, 1.04, bamboo)
    const grip = cylinderZ(stick, `diabolo-${side}-grip`, .10, .32, teal, .30)
    for (const z of [.17, .24, .31, .38, .45]) cylinderZ(stick, `diabolo-${side}-binding-${z}`, .102, .009, coral, z)
    cylinderZ(stick, `diabolo-${side}-tip`, .058, .04, inner, -.50)
    return { stick, grip }
  })

  // Keep exact 0.012 cord radius and 32 named segments so stick-tip contact, axle wrap, and geometry identity stay exact.
  const cordGeometry = new THREE.CylinderGeometry(.012, .012, 1, 8)
  const segments = Array.from({ length: CORD_SEGMENTS }, (_, i) => add(subject, `diabolo-cord-${i}`, cordGeometry, cordMat))
  const analyticalPoints = Array.from({ length: CORD_POINTS }, () => new THREE.Vector3())
  const simRefPoints = Array.from({ length: CORD_POINTS }, () => new THREE.Vector3())
  const simRawPoints = Array.from({ length: CORD_POINTS }, () => new THREE.Vector3())
  const activePoints = Array.from({ length: CORD_POINTS }, () => new THREE.Vector3())
  const axis = new THREE.Vector3(0, 1, 0)
  const difference = new THREE.Vector3()
  const tmpLoaded = new THREE.Vector3()
  const tmpAirborne = new THREE.Vector3()

  // Current kinematic state shared between pose() and optional Rapier simulation.
  let curStep = 0
  let curN = 0
  let curSpan = 1.25
  let curLeftY = 1.55
  let curRightY = 1.55
  let curBaseline = 0.8
  let curFlight = 0
  let curRotorY = 0.8
  let prevLeftY = 1.55
  let prevRightY = 1.55
  let prevSpan = 1.25
  let isGestureActive = false
  let simClock = 0
  let catchBounceTimer = 0
  let catchBounceAmp = 0
  let pullWhipTimer = 0
  let wasAirborne = false
  let wasReduced = false
  let disposed = false
  let rapierReady = false
  let ropeBody: ReturnType<RapierSoftBodySession['createCustomRope']> | null = null

  function writeCordSegments(pts: readonly THREE.Vector3[]) {
    for (let i = 0; i < CORD_SEGMENTS; i++) {
      const a = pts[i]!
      const b = pts[i + 1]!
      const segment = segments[i]!
      segment.position.copy(a).add(b).multiplyScalar(.5)
      difference.subVectors(b, a)
      const len = difference.length()
      segment.scale.set(1, Math.max(len, 1e-6), 1)
      if (len > 1e-6) {
        segment.quaternion.setFromUnitVectors(axis, difference.divideScalar(len))
      }
    }
    subject.updateMatrixWorld(true)
  }

  /** Evaluates a point along the loaded axle-contact polyline at normalized arc-length fraction s in [0,1]. */
  function evalLoadedArcPoint(
    s: number,
    span: number,
    leftY: number,
    rightY: number,
    baseline: number,
    out: THREE.Vector3,
  ): THREE.Vector3 {
    const leftTipX = -span
    const rightTipX = span
    const ropeY = baseline
    const distL = Math.hypot(span, leftY - ropeY)
    const distR = Math.hypot(span, rightY - ropeY)
    const leftAngle = Math.atan2(leftY - ropeY, -span) + Math.acos(THREE.MathUtils.clamp(AXLE_WRAP_RADIUS / Math.max(distL, AXLE_WRAP_RADIUS + 1e-4), -1, 1))
    const rightAngle = Math.atan2(rightY - ropeY, span) - Math.acos(THREE.MathUtils.clamp(AXLE_WRAP_RADIUS / Math.max(distR, AXLE_WRAP_RADIUS + 1e-4), -1, 1)) + Math.PI * 2
    const lcX = AXLE_WRAP_RADIUS * Math.cos(leftAngle), lcY = ropeY + AXLE_WRAP_RADIUS * Math.sin(leftAngle)
    const rcX = AXLE_WRAP_RADIUS * Math.cos(rightAngle), rcY = ropeY + AXLE_WRAP_RADIUS * Math.sin(rightAngle)

    const asym = THREE.MathUtils.clamp(rightY - leftY, -0.4, 0.4)
    const sagL = THREE.MathUtils.clamp(0.044 + asym * 0.055, 0.025, 0.072)
    const sagR = THREE.MathUtils.clamp(0.044 - asym * 0.045, 0.024, 0.068)

    const lenL = Math.hypot(lcX - leftTipX, lcY - leftY)
    const lenArc = Math.max(1e-4, AXLE_WRAP_RADIUS * Math.max(0.05, rightAngle - leftAngle))
    const lenR = Math.hypot(rightTipX - rcX, rightY - rcY)
    const lenTot = lenL + lenArc + lenR
    const dist = THREE.MathUtils.clamp(s, 0, 1) * lenTot

    if (dist <= lenL) {
      const u = dist / Math.max(lenL, 1e-5)
      return out.set(
        THREE.MathUtils.lerp(leftTipX, lcX, u),
        THREE.MathUtils.lerp(leftY, lcY, u) - sagL * 4 * u * (1 - u),
        CORD_Z,
      )
    }
    if (dist <= lenL + lenArc) {
      const u = (dist - lenL) / lenArc
      const a = THREE.MathUtils.lerp(leftAngle, rightAngle, u)
      return out.set(
        AXLE_WRAP_RADIUS * Math.cos(a),
        ropeY + AXLE_WRAP_RADIUS * Math.sin(a),
        CORD_Z,
      )
    }
    const u = (dist - lenL - lenArc) / Math.max(lenR, 1e-5)
    return out.set(
      THREE.MathUtils.lerp(rcX, rightTipX, u),
      THREE.MathUtils.lerp(rcY, rightY, u) - sagR * 4 * u * (1 - u),
      CORD_Z,
    )
  }

  /**
   * Smoothly graded arc-length fraction for display segments when riding the axle:
   * slightly finer spacing right at the axle bottom so segment 16 seats cleanly under the axle,
   * while remaining C-infinity smooth (zero sudden length cliff!).
   */
  function displayArcParam(i: number, onAxle: number): number {
    const u = i / CORD_SEGMENTS
    // Gentle smooth grading: d(graded)/du = 1 + 0.68 * cos(2*pi*u) = 0.32 at u=0.5 (ds~0.032 right under axle)
    // and smoothly 1.68 near stick tips, smoothly reverting to exact uniform u when airborne (onAxle -> 0).
    const graded = u + (0.68 / (Math.PI * 2)) * Math.sin(u * Math.PI * 2)
    return THREE.MathUtils.lerp(u, graded, onAxle)
  }

  /** Evaluates both the uniform-arc-length simulation reference (`simRef`) and smooth display stations (`displayOut`). */
  function computeAnalyticalCord(
    span: number,
    leftY: number,
    rightY: number,
    baseline: number,
    flight: number,
    step: number,
    n: number,
    displayOut: THREE.Vector3[],
    simRefOut: THREE.Vector3[],
  ) {
    const leftTipX = -span
    const rightTipX = span
    const onAxle = step === 1 ? 1 - THREE.MathUtils.smoothstep(flight, 0.06, 0.24) : 1
    // During airborne flight (step === 1): snap taut briefly at launch, then hang in a smooth free catching catenary.
    const launchSnap = step === 1 ? Math.sin(Math.PI * THREE.MathUtils.clamp((n - 0.02) / 0.20, 0, 1)) * (n < 0.24 ? 1 : 0) : 0
    const airSag = 0.54 - 0.26 * launchSnap

    for (let i = 0; i < CORD_POINTS; i++) {
      const uUnif = i / CORD_SEGMENTS
      // 1. Strictly uniform arc-length reference for the 33-particle Rapier rope (zero edge-length discontinuities!).
      evalLoadedArcPoint(uUnif, span, leftY, rightY, baseline, tmpLoaded)
      if (onAxle >= 0.999) {
        simRefOut[i]!.copy(tmpLoaded)
      } else {
        tmpAirborne.set(
          THREE.MathUtils.lerp(leftTipX, rightTipX, uUnif),
          THREE.MathUtils.lerp(leftY, rightY, uUnif) - airSag * 4 * uUnif * (1 - uUnif),
          CORD_Z,
        )
        simRefOut[i]!.copy(tmpAirborne).lerp(tmpLoaded, onAxle)
      }

      // 2. Smoothly graded analytical display curve (identical to uniform in mid-flight, tight axle wrap on contact).
      const uDisp = displayArcParam(i, onAxle)
      evalLoadedArcPoint(uDisp, span, leftY, rightY, baseline, tmpLoaded)
      if (onAxle >= 0.999) {
        displayOut[i]!.copy(tmpLoaded)
      } else {
        tmpAirborne.set(
          THREE.MathUtils.lerp(leftTipX, rightTipX, uDisp),
          THREE.MathUtils.lerp(leftY, rightY, uDisp) - airSag * 4 * uDisp * (1 - uDisp),
          CORD_Z,
        )
        displayOut[i]!.copy(tmpAirborne).lerp(tmpLoaded, onAxle)
      }
    }
    simRefOut[0]!.set(leftTipX, leftY, CORD_Z)
    simRefOut[CORD_SEGMENTS]!.set(rightTipX, rightY, CORD_Z)
    displayOut[0]!.set(leftTipX, leftY, CORD_Z)
    displayOut[CORD_SEGMENTS]!.set(rightTipX, rightY, CORD_Z)
  }

  function resetRopeToSimRef() {
    if (!ropeBody || !ropeBody.isValid()) return
    for (let i = 0; i < CORD_POINTS; i++) {
      const p = simRefPoints[i]!
      ropeBody.setParticlePosition(i, { x: p.x, y: p.y, z: p.z })
      ropeBody.setParticleVelocity(i, { x: 0, y: 0, z: 0 })
    }
  }

  function applyRopeForces(_session: RapierSoftBodySession, subDt: number) {
    if (!ropeBody || !ropeBody.isValid()) return
    simClock += subDt
    if (catchBounceTimer > 0) catchBounceTimer = Math.max(0, catchBounceTimer - subDt)
    if (pullWhipTimer > 0) pullWhipTimer = Math.max(0, pullWhipTimer - subDt)

    ropeBody.resetForces(false)
    ropeBody.setParticleKinematicTarget(0, { x: -curSpan, y: curLeftY, z: CORD_Z })
    ropeBody.setParticleKinematicTarget(CORD_SEGMENTS, { x: curSpan, y: curRightY, z: CORD_Z })

    const pos = ropeBody.particlePositions()
    const vel = ropeBody.particleVelocities()
    const pMass = Math.max(ropeBody.mass() / CORD_POINTS, 1e-4)

    const airborne = curStep === 1 && curFlight > 0.14
    const onAxle = curStep === 1 ? 1 - THREE.MathUtils.smoothstep(curFlight, 0.08, 0.24) : 1
    const stickVelL = (curLeftY - prevLeftY) / Math.max(subDt, 1 / 120)
    const stickVelR = (curRightY - prevRightY) / Math.max(subDt, 1 / 120)
    const spreadVel = (curSpan - prevSpan) / Math.max(subDt, 1 / 120)

    const catchPhase = 0.55 - catchBounceTimer
    const catchDip = catchBounceTimer > 0
      ? -catchBounceAmp * Math.exp(-catchPhase * 5.0) * Math.cos(catchPhase * 21)
      : 0

    // Upward trampoline snap during initial toss launch as sticks spread outward.
    const launchImpulse = curStep === 1 && curN > 0.02 && curN < 0.20
      ? Math.sin(Math.PI * (curN - 0.02) / 0.18) * (14 + Math.max(0, spreadVel) * 2.0)
      : 0

    const spinningLive = (curStep === 1 || curStep === 2) && !isGestureActive && !options.isReducedMotion?.()

    for (let i = 1; i < CORD_SEGMENTS; i++) {
      const px = pos[i * 3]!, py = pos[i * 3 + 1]!, pz = pos[i * 3 + 2]!
      const vx = vel[i * 3]!, vy = vel[i * 3 + 1]!, vz = vel[i * 3 + 2]!
      const ref = simRefPoints[i]!
      const u = i / CORD_SEGMENTS

      let fx = 0, fy = 0, fz = 0
      fz += 95 * (CORD_Z - pz) - 11 * vz

      if (airborne) {
        // Pure uniform-length Rapier rope swinging freely beneath the airborne diabolo!
        const midWeight = Math.sin(u * Math.PI)
        fx += 16 * (ref.x - px) - 2.8 * vx
        fy += launchImpulse * midWeight + 18 * (ref.y - py) - 2.8 * vy
        fz += Math.sin(simClock * 15 + u * 5.8) * 0.35 * midWeight
      } else {
        // Smooth Gaussian seat weight around the center axle contact (particles 14..18 under uniform spacing).
        const seatDist = Math.abs(i - 16) / 3.2
        const seatBell = Math.exp(-seatDist * seatDist) * onAxle
        const freeWeight = 1 - seatBell

        // Axle saddle holds the center cleanly under the rotor with elastic catch compliance.
        const targetY = ref.y + catchDip * Math.exp(-Math.pow((i - 16) / 5.5, 2))
        fx += (180 * seatBell + 36 * freeWeight) * (ref.x - px) - (13 * seatBell + 5.2 * freeWeight) * vx

        // Free left (1..13) and right (19..31) spans respond with smooth whip, stick lag, catch rebound, and spin hum.
        const sideU = i <= 16 ? i / 15 : (32 - i) / 15
        const spanArch = Math.sin(THREE.MathUtils.clamp(sideU, 0, 1) * Math.PI)
        const isRight = i > 16
        const whipBoost = pullWhipTimer > 0
          ? Math.sin(simClock * 22 - u * 8.5) * (pullWhipTimer / 0.40) * (isRight ? 6.0 : 4.2) * spanArch
          : 0
        const stickLagY = -(isRight ? stickVelR : stickVelL) * 0.48 * spanArch
        const catchWave = catchBounceTimer > 0
          ? Math.sin(catchPhase * 21 - (1 - sideU) * 2.8) * catchBounceAmp * 85 * Math.exp(-catchPhase * 4.6) * spanArch
          : 0
        const spinHum = spinningLive
          ? Math.sin(simClock * 26 + i * 0.72) * 0.65 * spanArch
          : 0

        const isCalm = !isGestureActive && catchBounceTimer <= 0 && pullWhipTimer <= 0 && (curStep === 0 || curStep === 3)
        const kSpanY = isCalm ? 70 : 30
        const cSpanY = isCalm ? 11.5 : 4.6
        fy += (220 * seatBell + kSpanY * freeWeight) * (targetY - py)
          - (14 * seatBell + cSpanY * freeWeight) * vy
          + freeWeight * (whipBoost + stickLagY + catchWave + spinHum)
      }

      ropeBody.addParticleForce(i, { x: pMass * fx, y: pMass * fy, z: pMass * fz }, false)
    }

    prevLeftY = curLeftY
    prevRightY = curRightY
    prevSpan = curSpan
  }

  /** Evaluates a uniform cubic Catmull-Rom point along simRawPoints at u in [0,1]. */
  function sampleSpline(pts: readonly THREE.Vector3[], u: number, out: THREE.Vector3): THREE.Vector3 {
    const f = THREE.MathUtils.clamp(u, 0, 1) * (pts.length - 1)
    const i1 = Math.min(pts.length - 2, Math.floor(f))
    const t = f - i1
    const i0 = Math.max(0, i1 - 1), i2 = i1 + 1, i3 = Math.min(pts.length - 1, i1 + 2)
    const p0 = pts[i0]!, p1 = pts[i1]!, p2 = pts[i2]!, p3 = pts[i3]!
    const t2 = t * t, t3 = t2 * t
    const w0 = 0.5 * (-t + 2 * t2 - t3)
    const w1 = 0.5 * (2 - 5 * t2 + 3 * t3)
    const w2 = 0.5 * (t + 4 * t2 - 3 * t3)
    const w3 = 0.5 * (-t2 + t3)
    return out.set(
      p0.x * w0 + p1.x * w1 + p2.x * w2 + p3.x * w3,
      p0.y * w0 + p1.y * w1 + p2.y * w2 + p3.y * w3,
      p0.z * w0 + p1.z * w1 + p2.z * w2 + p3.z * w3,
    )
  }

  function syncCordFromRapier() {
    if (!ropeBody || !ropeBody.isValid()) return
    const pos = ropeBody.particlePositions()
    const airborne = curStep === 1 && curFlight > 0.14
    const onAxle = curStep === 1 ? 1 - THREE.MathUtils.smoothstep(curFlight, 0.08, 0.24) : 1

    simRawPoints[0]!.set(-curSpan, curLeftY, CORD_Z)
    simRawPoints[CORD_SEGMENTS]!.set(curSpan, curRightY, CORD_Z)

    for (let i = 1; i < CORD_SEGMENTS; i++) {
      let x = pos[i * 3]!
      let y = pos[i * 3 + 1]!
      let z = pos[i * 3 + 2]!
      const ref = simRefPoints[i]!

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        simRawPoints[i]!.copy(ref)
        continue
      }
      x = THREE.MathUtils.clamp(x, -curSpan - 0.03, curSpan + 0.03)
      y = Math.max(0.32, y)
      z = THREE.MathUtils.clamp(z, CORD_Z - 0.04, CORD_Z + 0.04)

      // Smooth physical axle collision guard around the real rotor axle (never a flat box clamp!).
      const axleCenterY = airborne ? curRotorY : curBaseline
      const dx = x
      const dy = y - axleCenterY
      const r = Math.hypot(dx, dy)
      const minR = AXLE_WRAP_RADIUS - 0.004
      if (r < minR && r > 1e-5 && dy < 0.04) {
        x = (dx / r) * minR
        y = axleCenterY + (dy / r) * minR
      } else if (airborne && Math.abs(x) < 0.56 && y > curRotorY - 0.12) {
        // Never allow the free cord to pass above the airborne diabolo's axle during rapid launch.
        y = curRotorY - 0.12
      }
      if (!airborne && onAxle > 0.5 && Math.abs(i - 16) <= 3 && catchBounceTimer <= 0 && !isGestureActive) {
        x = THREE.MathUtils.lerp(x, ref.x, 0.7)
        y = THREE.MathUtils.lerp(y, ref.y, 0.7)
        z = CORD_Z
      }
      simRawPoints[i]!.set(x, y, z)
    }

    // Two gentle Laplacian passes over the uniform Rapier rope produce a silk-smooth curve with zero angular kinks.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < CORD_SEGMENTS; i++) {
        const prev = simRawPoints[i - 1]!
        const curr = simRawPoints[i]!
        const next = simRawPoints[i + 1]!
        curr.x = curr.x * 0.70 + (prev.x + next.x) * 0.15
        curr.y = curr.y * 0.70 + (prev.y + next.y) * 0.15
        curr.z = curr.z * 0.70 + (prev.z + next.z) * 0.15
      }
    }

    // Resample smoothly along the uniform Rapier spline at display stations (exact uniform in flight, smooth axle seating on contact).
    activePoints[0]!.set(-curSpan, curLeftY, CORD_Z)
    activePoints[CORD_SEGMENTS]!.set(curSpan, curRightY, CORD_Z)
    for (let i = 1; i < CORD_SEGMENTS; i++) {
      const uSample = displayArcParam(i, onAxle)
      sampleSpline(simRawPoints, uSample, activePoints[i]!)
      if (!airborne && onAxle > 0.5 && Math.abs(i - 16) <= 3) {
        const p = activePoints[i]!
        const dx = p.x, dy = p.y - curBaseline, r = Math.hypot(dx, dy)
        const minR = AXLE_WRAP_RADIUS - 0.004
        if (r < minR && r > 1e-5 && dy < 0.04) {
          p.x = (dx / r) * minR
          p.y = curBaseline + (dy / r) * minR
        }
      }
    }
    writeCordSegments(activePoints)
  }

  const host = createRapierSoftBodyHost({
    gravity: { x: 0, y: -9.81, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 6,
    internalPgsIterations: 3,
    sleepSpeedThreshold: 0,
    isActive: () => !disposed && (options.isActive?.() ?? true),
    isReducedMotion: () => options.isReducedMotion?.() ?? false,
    onReady(session) {
      if (disposed) return
      // Initialize with STRICTLY UNIFORM edge lengths across all 32 segments (~0.100 units each) so no center bunching or trapezoid kinks occur!
      const uniformInit: { x: number; y: number; z: number }[] = []
      const initHalfSpan = 1.60
      for (let i = 0; i < CORD_POINTS; i++) {
        const u = i / CORD_SEGMENTS
        uniformInit.push({
          x: THREE.MathUtils.lerp(-initHalfSpan, initHalfSpan, u),
          y: 1.55,
          z: CORD_Z,
        })
      }
      ropeBody = session.createCustomRope({
        points: uniformInit,
        closed: false,
        bending: true,
        wireCollision: false,
        pinnedParticles: [0, CORD_SEGMENTS],
        mass: 0.085,
        particleRadius: 0.012,
        linearDamping: 2.0,
        gravityScale: 1.0,
        edgeSoftness: { naturalFrequency: 34, dampingRatio: 0.48 },
        bendSoftness: { naturalFrequency: 11, dampingRatio: 0.55 },
        noSurfaceCollider: true,
        canSleep: false,
      })
      rapierReady = true
      resetRopeToSimRef()
      host.settle(16, applyRopeForces)
      if (!options.isReducedMotion?.()) {
        syncCordFromRapier()
      }
    },
  })

  const pose = (at: number, n: number, repeat = false) => {
    n = THREE.MathUtils.clamp(n, 0, 1)
    const pull = at === 0 ? n : 1, toss = repeat ? 1 : at === 1 ? n : at > 1 ? 1 : 0, lower = at === 2 ? n : at > 2 ? 1 : 0
    const flight = at === 1 ? Math.sin(Math.PI * n) : 0
    const span = 1.25 + .35 * flight
    const leftY = THREE.MathUtils.lerp(THREE.MathUtils.lerp(1.55, 1.68, toss), 1.30, lower)
    const rightY = THREE.MathUtils.lerp(THREE.MathUtils.lerp(1.55 + .35 * pull, 1.68, toss), 1.30, lower)
    sticks[0]!.stick.position.set(-span, leftY, 0); sticks[1]!.stick.position.set(span, rightY, 0)
    const baseline = THREE.MathUtils.lerp(THREE.MathUtils.lerp(.8 + .16 * pull, .85, toss), .65, lower)
    const rotorY = baseline + 1.25 * flight
    rotor.position.set(0, rotorY, CORD_Z); rotor.rotation.z = Math.PI * (2.6 * pull + 4 * toss + (repeat ? 4 * n : 0) + 1.1 * lower)

    if (wasAirborne && (at !== 1 || flight < 0.08)) {
      wasAirborne = false
      if (!options.isReducedMotion?.() && rapierReady) {
        catchBounceTimer = 0.55
        catchBounceAmp = 0.070
        host.wakeUp()
      }
    }
    if (at === 1 && flight > 0.25) wasAirborne = true
    if (at === 0 && n > 0.05 && n < 0.95 && !options.isReducedMotion?.() && rapierReady) {
      pullWhipTimer = Math.max(pullWhipTimer, 0.35)
    }

    curStep = at
    curN = n
    curSpan = span
    curLeftY = leftY
    curRightY = rightY
    curBaseline = baseline
    curFlight = flight
    curRotorY = rotorY
    isGestureActive = n > 0.001 && n < 0.999

    computeAnalyticalCord(span, leftY, rightY, baseline, flight, at, n, analyticalPoints, simRefPoints)
    writeCordSegments(analyticalPoints)
  }

  function startPhysics(): Promise<RapierSoftBodySession | null> {
    if (disposed || options.isReducedMotion?.()) return Promise.resolve(null)
    return host.start()
  }

  function stepPhysics(dt: number): boolean {
    if (disposed) return false
    const reduced = options.isReducedMotion?.() ?? false
    if (reduced) {
      if (!wasReduced) {
        wasReduced = true
        catchBounceTimer = 0
        pullWhipTimer = 0
        wasAirborne = false
        writeCordSegments(analyticalPoints)
      }
      return false
    }
    if (wasReduced) {
      wasReduced = false
      resetRopeToSimRef()
      host.wakeUp()
    }
    if (!rapierReady) {
      if (options.isActive?.() ?? true) void startPhysics()
      return false
    }
    const stepped = host.step(dt, applyRopeForces, () => {
      syncCordFromRapier()
    })
    return stepped
  }

  function triggerCatchImpulse() {
    if (disposed || options.isReducedMotion?.()) return
    catchBounceTimer = 0.55
    catchBounceAmp = 0.074
    if (ropeBody && ropeBody.isValid()) {
      for (let i = 11; i <= 21; i++) {
        const weight = 1 - Math.abs(i - 16) / 6
        ropeBody.setParticleVelocity(i, { x: 0, y: -1.45 * weight, z: 0 })
      }
    }
    host.wakeUp()
  }

  function snapToCalmPose() {
    catchBounceTimer = 0
    pullWhipTimer = 0
    wasAirborne = false
    resetRopeToSimRef()
    writeCordSegments(analyticalPoints)
  }

  function dispose() {
    if (disposed) return
    disposed = true
    rapierReady = false
    ropeBody = null
    host.dispose()
  }

  pose(0, 0)
  return {
    subject,
    pose,
    startPhysics,
    stepPhysics,
    triggerCatchImpulse,
    snapToCalmPose,
    dispose,
    get rapierReady() { return rapierReady },
    targets: [sticks[1]!.grip, sticks[0]!.grip, sticks[1]!.grip],
    roots: [sticks[1]!.stick, sticks[0]!.stick, sticks[1]!.stick],
    anchors: [[0, .09, 0], [0, .09, 0], [0, .09, 0]] as [number, number, number][],
  }
}
