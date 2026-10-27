import { describe, expect, it } from 'vitest'
import { wrapCanvasText } from './canvas-text'

describe('measured canvas copy', () => {
  it('wraps words by measured width without losing the second half of long input', () => {
    const text = 'May every friend find a peaceful place to rest.'
    const measure = (value: string) => value.length * 10
    const lines = wrapCanvasText(text, 150, measure, 'en')
    expect(lines.join('')).toBe(text)
    expect(lines.length).toBeGreaterThan(2)
    expect(lines.every(line => measure(line) <= 150)).toBe(true)
  })
  it('does not split emoji or combining marks when a word needs wrapping', () => {
    const text = '👨‍👩‍👧‍👦e\u0301👩🏽‍💻平安'
    const segment = new Intl.Segmenter('ja', { granularity: 'grapheme' })
    const measure = (value: string) => [...segment.segment(value)].length * 20
    const lines = wrapCanvasText(text, 20, measure, 'ja')
    expect(lines).toEqual(['👨‍👩‍👧‍👦', 'e\u0301', '👩🏽‍💻', '平', '安'])
  })
  it('keeps common grapheme clusters together when Segmenter is unavailable', () => {
    const original = Intl.Segmenter
    Object.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true, writable: true })
    try {
      expect(wrapCanvasText('👨‍👩‍👧‍👦e\u0301👩🏽‍💻', 10, () => 20, 'en')).toEqual(['👨‍👩‍👧‍👦', 'e\u0301', '👩🏽‍💻'])
      expect(wrapCanvasText('\u0301A\u1100\u1161', 10, () => 20, 'ko')).toEqual(['\u0301', 'A', '\u1100\u1161'])
    } finally { Object.defineProperty(Intl, 'Segmenter', { value: original, configurable: true, writable: true }) }
  })
})
