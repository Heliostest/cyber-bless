import { graphemeSegments } from 'unicode-segmenter/grapheme';
/** Unicode input helpers have no catalog/formatter dependency; safe in native/core. */
export function graphemes(value: string): string[] {
  if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].map(part => part.segment);
  return Array.from(graphemeSegments(value), part => part.segment);
}
export const graphemeLength = (value: string) => graphemes(value).length;
export const sliceGraphemes = (value: string, start: number, end?: number) => graphemes(value).slice(start, end).join('');
