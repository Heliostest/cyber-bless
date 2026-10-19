import * as THREE from 'three'

/** Small-angle damped balance about the fixed beak; angles are radians. */
export function createBalanceMotion() {
  const angle = new THREE.Vector3(), velocity = new THREE.Vector3()
  // Keep the restoring forces; quarter damping extends visible free sway >3x.
  const limit = [.24, .34, .24], stiffness = [18, 7, 23], damping = [.625, .8, .675]
  const clamp = () => {
    for (let i = 0; i < 3; i++) {
      const a = angle.getComponent(i), bounded = THREE.MathUtils.clamp(a, -limit[i]!, limit[i]!)
      if (a !== bounded) { angle.setComponent(i, bounded); velocity.setComponent(i, velocity.getComponent(i) * -.12) }
      velocity.setComponent(i, THREE.MathUtils.clamp(velocity.getComponent(i), -1.3, 1.3))
    }
  }
  return {
    angle, velocity,
    reset() { angle.set(0, 0, 0); velocity.set(0, 0, 0) },
    impulse(point: THREE.Vector3, force: THREE.Vector3) {
      const torque = point.clone().cross(force)
      if (torque.length() < .06) torque.x += .08
      velocity.add(torque); clamp()
    },
    drag(origin: THREE.Vector3, point: THREE.Vector3, displacement: THREE.Vector3, dt: number) {
      const next = origin.clone().add(point.clone().cross(displacement).multiplyScalar(.65))
      velocity.copy(next).sub(angle).divideScalar(Math.max(1 / 120, dt)); angle.copy(next); clamp()
    },
    step(dt: number) {
      if (!Number.isFinite(dt) || dt <= 0) return
      const steps = Math.ceil(Math.min(dt, .05) * 120), h = Math.min(dt, .05) / steps
      for (let n = 0; n < steps; n++) for (let i = 0; i < 3; i++) {
        const v = velocity.getComponent(i) + (-stiffness[i]! * angle.getComponent(i) - damping[i]! * velocity.getComponent(i)) * h
        velocity.setComponent(i, v); angle.setComponent(i, angle.getComponent(i) + v * h)
      }
      clamp()
      if (angle.lengthSq() + velocity.lengthSq() < 1e-9) { angle.set(0, 0, 0); velocity.set(0, 0, 0) }
    },
  }
}
