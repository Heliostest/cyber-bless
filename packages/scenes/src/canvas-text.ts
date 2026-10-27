import { graphemes } from '@wbr/i18n/text'

/** Word-aware measured wrapping. An oversized word falls back to whole graphemes, never code units. */
export function wrapCanvasText(text: string, maxWidth: number, measure: (value: string) => number, locale: string): string[] {
  const words = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)].map(part => part.segment)
    : graphemes(text)
  const lines: string[] = []; let line = ''
  for (const word of words) {
    const pieces = measure(word) > maxWidth ? graphemes(word) : [word]
    for (const piece of pieces) {
      if (line && measure(line + piece) > maxWidth) { lines.push(line); line = '' }
      line += piece
    }
  }
  if (line || !lines.length) lines.push(line)
  return lines
}
