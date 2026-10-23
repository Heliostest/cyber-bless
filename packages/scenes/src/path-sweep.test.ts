import { describe, expect, it } from 'vitest'
import { createPathSweep } from './path-sweep'

describe('ordered continuous path coverage', () => {
  it('discards covered gates after a non-finite sample rather than completing from stale coverage', () => {
    const path = createPathSweep([[0, 0], [1, 0], [1, 1]], .1)
    path.sample([1, 0]); path.sample([1, 1]); expect(path.complete()).toBe(true)
    path.sample([NaN, 1]); path.sample([1, 1])
    expect(path.next).toBe(1)
    expect(path.complete()).toBe(false)
  })
  it('counts gates crossed between events, including several gates in one straight stroke', () => {
    const path = createPathSweep([[0, 0], [1, 0], [2, 0], [3, 0]], .1)
    path.sample([3, 0])
    expect(path.next).toBe(4)
    expect(path.complete()).toBe(true)
  })
  it('retains ordered coverage through a correction without counting reverse scribbles', () => {
    const path = createPathSweep([[0, 0], [1, 0], [1, 1], [0, 1]], .1)
    path.sample([.8, 0]); path.sample([1.2, 0]); path.sample([.8, .2]); path.sample([1, 1]); path.sample([0, 1])
    expect(path.complete()).toBe(true)
    path.reset()
    for (let i = 0; i < 10; i++) { path.sample([1, 0]); path.sample([0, 0]) }
    expect(path.complete()).toBe(false)
  })
  it('requires route order, end proximity and a fresh sweep after cancellation', () => {
    const path = createPathSweep([[0, 0], [1, 0], [1, 1], [0, 1]], .1)
    path.sample([0, 1]); expect(path.complete()).toBe(false)
    path.reset(); path.sample([1, 0]); path.sample([1, 1]); path.sample([0, 1])
    path.sample([-1, 1]); expect(path.complete()).toBe(false)
    path.sample([0, 1]); expect(path.complete()).toBe(true)
    path.reset(); expect(path.next).toBe(1); expect(path.progress).toBe(0)
    path.sample([NaN, 0]); expect(path.complete()).toBe(false)
  })
})
