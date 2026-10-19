import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { createBalanceMotion } from './balance-motion'

// Recorded before the damping change, with the same .4 rad/s impulse at 120 Hz.
// Duration ends at the last sample above .005 radians, so a zero crossing cannot
// be mistaken for the end of an oscillation. Keep these baselines fixed.
const axes = [
  { name: 'pitch', axis: 0, point: [0, 0, .5], force: [0, -.8, 0], baseline: 2.1083333333333334 },
  { name: 'twist', axis: 1, point: [0, 0, .5], force: [.8, 0, 0], baseline: 2.225 },
  { name: 'roll', axis: 2, point: [.5, 0, 0], force: [0, -.8, 0], baseline: 1.85 },
] as const

describe('released dragonfly oscillation duration', () => {
  for (const fps of [30, 60, 120]) {
    it.each(axes)(`keeps $name visible for at least three times the old duration at ${fps} fps, then settles`, ({ axis, point, force, baseline }) => {
      const motion = createBalanceMotion()
      motion.impulse(new Vector3(...point), new Vector3(...force))
      let lastVisible = 0
      for (let frame = 1; frame <= fps * 60; frame++) {
        motion.step(1 / fps)
        if (Math.abs(motion.angle.getComponent(axis)) >= .005) lastVisible = frame / fps
      }
      expect(lastVisible).toBeGreaterThanOrEqual(baseline * 3)
      expect(motion.angle.toArray()).toEqual([0, 0, 0])
      expect(motion.velocity.toArray()).toEqual([0, 0, 0])
    })
  }
})
