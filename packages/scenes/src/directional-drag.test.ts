import { expect, it } from 'vitest'
import { completesDirectionalDrag } from './directional-drag'

it('accepts the full visual endpoint despite subpixel subtraction error and earlier finger wobble', () => {
  expect(completesDirectionalDrag({ along: 60 - 1e-12, end: 60 - 1e-12,
    maxAlong: 60, minAlong: 0, backtrack: 0, maxCross: 16, cross: 0, travel: 143 })).toBe(true)
})
it('keeps a fully extended release valid after overtravel and correction', () => {
  expect(completesDirectionalDrag({ along: 90, end: 90,
    maxAlong: 120, minAlong: 0, backtrack: 30, maxCross: 60, cross: 0, travel: 200 })).toBe(true)
})
it('still rejects a returned unfinished pose, a wrong direction and invalid input', () => {
  const drag = { along: 42, end: 42, maxAlong: 75, minAlong: 0, backtrack: 33, maxCross: 0, cross: 0, travel: 108 }
  expect(completesDirectionalDrag(drag)).toBe(false)
  expect(completesDirectionalDrag({ ...drag, along: -60, end: -60 })).toBe(false)
  expect(completesDirectionalDrag({ ...drag, along: 90, end: 90, cross: NaN })).toBe(false)
})
