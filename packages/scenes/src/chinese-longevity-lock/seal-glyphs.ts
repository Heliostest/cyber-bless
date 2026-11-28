/*!
 * @license
 * Normalized 2D closed glyph contours for Kai calligraphy "长命" extracted at runtime
 * from the bundled LXGW ZhenKai GB (霞鹜臻楷 GB) subset via `@wbr/scene-runtime/glyph-kit`.
 *
 * Licensed under the SIL Open Font License, Version 1.1 (https://scripts.sil.org/OFL).
 * Full unmodified license text: `packages/scene-runtime/licenses/fonts/LXGWZhenKaiGB-OFL.txt`.
 * Product art choice only (not a museum inscription replica).
 */
import { getGlyphNormalizedContours } from '@wbr/scene-runtime/glyph-kit'
import type { GlyphContour } from './geometry'

/** Normalized (+y up, height = 1.0, centred) 2D closed contours for LXGW ZhenKai "长命". */
export const SEAL_GLYPHS: Readonly<Record<'long' | 'ming', readonly GlyphContour[]>> = {
  long: getGlyphNormalizedContours('lxgwZhenKai', '长', { flatness: 0.006 }),
  ming: getGlyphNormalizedContours('lxgwZhenKai', '命', { flatness: 0.006 }),
}
