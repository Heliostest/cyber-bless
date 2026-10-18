import { describe, expect, it } from 'vitest'
import { encodeYutPlay, moveYut, restoreYutPlay, throwYut, yutSteps, type YutPlay } from './play'

const fresh = (): YutPlay => ({ position: 0, mask: 5, turns: 0, phase: 'throw' })

describe('yut throw results', () => {
  it('maps every flat-face mask to the traditional one-through-five count', () => {
    expect(Array.from({ length: 16 }, (_, mask) => yutSteps(mask))).toEqual([5, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4])
  })

  it('samples each of the sixteen equally sized random intervals once per accepted throw', () => {
    const counts = [0, 0, 0, 0, 0, 0]
    for (let mask = 0; mask < 16; mask++) {
      let calls = 0
      const result = throwYut(fresh(), () => { calls++; return (mask + .5) / 16 })
      expect(result).toEqual({ position: 0, mask, turns: 1, phase: 'move' })
      expect(calls).toBe(1)
      counts[yutSteps(result.mask)]!++
    }
    expect(counts.slice(1)).toEqual([4, 6, 4, 1, 1])
  })

  it('allows consecutive identical outcomes without resampling', () => {
    const first = throwYut(fresh(), () => 0)
    const second = throwYut(moveYut(first), () => 0)
    expect(second).toEqual({ position: 5, mask: 0, turns: 2, phase: 'move' })
  })

  it.each([NaN, Infinity, -Infinity, -1, 1, 2])('normalizes an invalid random sample %s to a legal result', sample => {
    const result = throwYut(fresh(), () => sample)
    expect(Number.isInteger(result.mask)).toBe(true)
    expect(result.mask).toBeGreaterThanOrEqual(0)
    expect(result.mask).toBeLessThanOrEqual(15)
  })
})

describe('saved yut play', () => {
  it('round trips every phase and boundary values through a canonical variant', () => {
    for (const phase of ['throw', 'move', 'again'] as const) for (const position of [0, 19]) for (const mask of [0, 15]) for (const turns of [0, 999999]) {
      const play = { position, mask, turns, phase }
      const variant = encodeYutPlay(play)
      expect(variant).toMatch(/^[a-z0-9-]{1,32}$/)
      expect(restoreYutPlay(variant, 0)).toEqual(play)
    }
  })

  it('restores the fixed two-space legacy checkpoints', () => {
    expect(restoreYutPlay(undefined, 0)).toEqual(fresh())
    expect(restoreYutPlay(undefined, 1)).toEqual(fresh())
    expect(restoreYutPlay(undefined, 2)).toEqual({ position: 0, mask: 5, turns: 1, phase: 'move' })
    expect(restoreYutPlay(undefined, 3)).toEqual({ position: 2, mask: 5, turns: 1, phase: 'again' })
    expect(restoreYutPlay(undefined, 100)).toEqual({ position: 2, mask: 5, turns: 1, phase: 'again' })
  })

  it.each(['', 'yut1', 'yut2-0-5-0-throw', 'yut1-20-5-1-move', 'yut1-0-16-1-move', 'yut1-0-5-1000000-move', 'yut1--1-5-1-move', 'yut1-0-5-1-finish', 'yut1-00-5-1-move', 'yut1-0-5-01-move', 'yut1-0-5-1-move-extra', 'yut1-0-5-1-move\n'])('rejects malformed or noncanonical variant %j', raw => {
    expect(restoreYutPlay(raw, 2)).toEqual({ position: 0, mask: 5, turns: 1, phase: 'move' })
  })

  it('caps the persisted throw counter while continuing play', () => {
    const result = throwYut({ position: 19, mask: 5, turns: 999999, phase: 'again' }, () => .999)
    expect(result.turns).toBe(999999)
    expect(restoreYutPlay(encodeYutPlay(result), 3)).toEqual(result)
  })
})

describe('repeated single-piece outer-route play', () => {
  it('consumes a pending result once and prevents another throw from discarding it', () => {
    const pending = throwYut(fresh(), () => .99)
    let calls = 0
    expect(throwYut(pending, () => { calls++; return 0 })).toBe(pending)
    expect(calls).toBe(0)
    const moved = moveYut(pending)
    expect(moved).toEqual({ position: 4, mask: 15, turns: 1, phase: 'again' })
    expect(moveYut(moved)).toBe(moved)
    expect(moveYut(fresh())).toEqual(fresh())
  })

  it('keeps the piece on the twenty-station outer loop over multiple laps', () => {
    let play = fresh()
    for (let round = 1; round <= 17; round++) {
      const before = play
      play = throwYut(play, () => 0)
      expect(before.position).toBe(((round - 1) * 5) % 20)
      expect(play.position).toBe(before.position)
      play = moveYut(play)
      expect(play).toEqual({ position: (round * 5) % 20, mask: 0, turns: round, phase: 'again' })
    }
  })
})
