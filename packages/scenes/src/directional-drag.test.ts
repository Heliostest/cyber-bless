import { expect, it } from 'vitest'
import { completesDirectionalDrag, directionalAxes } from './directional-drag'

it('uses CSS pixel distances for diagonal arrows as well as cardinal arrows', () => {
  const [along, cross] = directionalAxes([-1, -1], -30, -30)
  expect(along).toBeCloseTo(42.426406871, 8)
  expect(cross).toBe(0)
  expect(directionalAxes([0, -1], 12, -60)).toEqual([60, 12])
})

it('accepts the full visual endpoint despite subpixel subtraction error and earlier finger wobble', () => {
  expect(completesDirectionalDrag({ along: 60 - 1e-12, end: 60 - 1e-12,
    maxAlong: 60, minAlong: 0, backtrack: 0, maxCross: 16, cross: 0, travel: 143 })).toBe(true)
})
it('keeps a fully extended release valid after overtravel and correction', () => {
  expect(completesDirectionalDrag({ along: 90, end: 90,
    maxAlong: 120, minAlong: 0, backtrack: 30, maxCross: 60, cross: 0, travel: 200 })).toBe(true)
})
it('accepts a twenty pixel correction and a gentle diagonal without requiring a perfect path', () => {
  expect(completesDirectionalDrag({ along: 40, end: 40, maxAlong: 60, minAlong: 0,
    backtrack: 20, maxCross: 0, cross: 0, travel: 80 })).toBe(true)
  expect(completesDirectionalDrag({ along: 40 - 1e-12, end: 40 - 1e-12, maxAlong: 60, minAlong: 0,
    backtrack: 20 + 1e-12, maxCross: 0, cross: 0, travel: 80 })).toBe(true)
  expect(completesDirectionalDrag({ along: 60, end: 60, maxAlong: 60, minAlong: 0,
    backtrack: 0, maxCross: 30, cross: 30, travel: 68 })).toBe(true)
})
it('accepts a small reverse adjustment at pickup followed by a deliberate forward finish', () => {
  for (const end of [40, 60, 120]) {
    expect(completesDirectionalDrag({ along: end, end, maxAlong: end, minAlong: -20,
      backtrack: 20, maxCross: 0, cross: 0, travel: end + 40 })).toBe(true)
  }
  expect(completesDirectionalDrag({ along: 120, end: 120, maxAlong: 120, minAlong: -60,
    backtrack: 60, maxCross: 0, cross: 0, travel: 240 })).toBe(false)
})
it('still rejects a returned unfinished pose, a wrong direction and invalid input', () => {
  const drag = { along: 42, end: 42, maxAlong: 75, minAlong: 0, backtrack: 33, maxCross: 0, cross: 0, travel: 108 }
  expect(completesDirectionalDrag(drag)).toBe(false)
  expect(completesDirectionalDrag({ ...drag, along: -60, end: -60 })).toBe(false)
  expect(completesDirectionalDrag({ ...drag, along: 90, end: 90, cross: NaN })).toBe(false)
})
