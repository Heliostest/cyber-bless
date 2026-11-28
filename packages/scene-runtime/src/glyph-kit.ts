import earcut from "earcut";
import opentype from "opentype.js";
import * as THREE from "three";
import {
  RITUAL_FONT_SUBSETS_B64,
  decodeFontSubsetBuffer,
  type RitualFontId,
} from "./glyph-subsets";

export { RITUAL_FONT_SUBSETS_B64, type RitualFontId };

export type Point2D = [number, number];
export type Ring2D = Point2D[];

export interface PolygonWithHoles {
  /** Counter-clockwise outer boundary ring (signedArea > 0 in Y-up coordinates). */
  outer: Ring2D;
  /** Clockwise hole boundary rings (signedArea < 0 in Y-up coordinates). */
  holes: Ring2D[];
}

export interface Bounds2D {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface GlyphLayoutItem {
  char: string;
  index: number;
  polygons: PolygonWithHoles[];
  rawRings: Ring2D[];
  bounds: Bounds2D;
  advanceX: number;
}

export interface TextLayoutResult {
  fontId: RitualFontId;
  text: string;
  glyphs: GlyphLayoutItem[];
  polygons: PolygonWithHoles[];
  rawRings: Ring2D[];
  bounds: Bounds2D;
  totalAdvance: number;
}

export interface GlyphOutlineOptions {
  /** Base font size in output units (default 1.0). */
  fontSize?: number;
  /** Additional inter-glyph tracking in em units (fraction of fontSize, default 0). */
  letterSpacing?: number;
  /** Bezier curve flattening tolerance as a fraction of fontSize (default 0.002). */
  flatness?: number;
  /** Maximum chord segments per quadratic/cubic Bezier command (default 24). */
  maxCurveSegments?: number;
  /** Center the ink bounding box around (0, 0) (default false). */
  center?: boolean;
  /** Uniformly scale the laid-out ink height to this exact value (preserving aspect ratio). */
  targetHeight?: number;
  /** Uniformly scale so ink fits within [maxWidth, maxHeight] (preserving aspect ratio). */
  fitBox?: readonly [number, number];
  /** Minimum absolute ring area ratio relative to fontSize^2 to keep (default 1e-6). */
  minRingAreaRatio?: number;
}

export interface FlatGeometryOptions extends GlyphOutlineOptions {
  /** Maximum triangle edge length in output units; enables conformal subdivision for curved surfaces. */
  maxEdgeLength?: number;
  /** Target plane: 'xy' faces +Z (x, y, zOffset); 'xz' faces +Y (x, zOffset, -y). Default 'xy'. */
  plane?: "xy" | "xz";
  /** Constant normal offset when no custom deformer is given (default 0). */
  zOffset?: number;
  /** Optional custom vertex mapper from 2D glyph (x, y) to 3D position (overrides plane/zOffset). */
  deformVertex?: (x: number, y: number, out: THREE.Vector3) => void;
  /** Optional UV normalization bounds; defaults to the geometry's own 2D ink bounds. */
  uvBounds?: Bounds2D;
  /** Optional per-vertex color callback `(x, y, outColor)` for powdery/ink shading variation. */
  vertexColor?: (x: number, y: number, out: THREE.Color) => void;
}

export interface FlatGeometryResult {
  geometry: THREE.BufferGeometry;
  /** Flat interleaved [x0, y0, x1, y1, ...] 2D coordinates matching every vertex of `geometry`. */
  coords2D: Float32Array;
  bounds: Bounds2D;
}

export interface ExtrudeGlyphOptions extends GlyphOutlineOptions {
  /** Extrusion depth along +Z (default 0.01). */
  depth?: number;
  /** Enable subtle chamfered bevel (default true). */
  bevelEnabled?: boolean;
  /** Bevel depth thickness along Z (default depth * 0.18). */
  bevelThickness?: number;
  /** Bevel outset in XY (default depth * 0.12). */
  bevelSize?: number;
  /** Bevel radial segments (default 2). */
  bevelSegments?: number;
  /** Curve tessellation passed to ExtrudeGeometry (default 12). */
  curveSegments?: number;
  /** Extrusion steps (default 1). */
  steps?: number;
  /** Align back face to z = 0 so front relief sits on [0, totalDepth] (default true). */
  alignBackToZero?: boolean;
}

export interface RasterizeTextOptions {
  width: number;
  height: number;
  /** Extra tracking in em units (default 0). */
  letterSpacing?: number;
  /** Horizontal alignment per line (default 'center'). */
  align?: "left" | "center" | "right";
  /** Vertical alignment of the text block (default 'middle'). */
  verticalAlign?: "top" | "middle" | "bottom";
  /** Padding in pixels: uniform number or [padX, padY]. Default [width * 0.08, height * 0.12]. */
  padding?: number | readonly [number, number];
  /** Line height multiplier for multi-line text (default 1.24). */
  lineHeight?: number;
  /** Explicit pixel font size; if omitted, auto-fits cleanly inside padded box. */
  fontSize?: number;
  /** Vertical sub-scanline supersampling count (4 or 8; default 8). Horizontal coverage is analytical. */
  supersample?: number;
  /** Invert output rows so y = 0 is bottom instead of top (default false: y = 0 is top). */
  invertY?: boolean;
  /** Optional explicit placement box in pixels `{ x, y, width, height }` (y from top). */
  region?: { x: number; y: number; width: number; height: number };
}

export interface RasterizedMask {
  width: number;
  height: number;
  /** Coverage values in [0, 1], row-major (`y * width + x`). */
  data: Float32Array;
  fontSize: number;
  inkBounds: Bounds2D;
}

export interface FontTextureOptions extends RasterizeTextOptions {
  /** Foreground ink RGB `[r, g, b]` in 0..255 (default `[30, 26, 22]`). */
  inkColor?: readonly [number, number, number];
  /** Background RGB `[r, g, b]` in 0..255, or `'transparent'` for alpha-only ink (default `[255, 255, 255]`). */
  backgroundColor?: readonly [number, number, number] | "transparent";
  /** Background alpha 0..255 when backgroundColor is RGB (default 255). */
  backgroundAlpha?: number;
  /** Foreground ink alpha multiplier 0..1 (default 1). */
  inkAlpha?: number;
  /** Optional pixel post-processor for subtle paper/fabric/woodblock grain `(x, y, coverage, rgba, offset)`. */
  shadePixel?: (
    x: number,
    y: number,
    coverage: number,
    rgba: Uint8Array,
    offset: number,
  ) => void;
  /** Set `texture.flipY` (default true). */
  flipY?: boolean;
  /** Texture minFilter (default LinearMipmapLinearFilter). */
  minFilter?: THREE.MinificationTextureFilter;
  /** Texture magFilter (default LinearFilter). */
  magFilter?: THREE.MagnificationTextureFilter;
  /** Generate mipmaps (default true). */
  generateMipmaps?: boolean;
}

export interface SlicedFlatPiece {
  geometry: THREE.BufferGeometry;
  coords2D: Float32Array;
  bounds: Bounds2D;
  /** Normalized progress start/end in [0, 1]. */
  uStart: number;
  uEnd: number;
}

const fontCache = new Map<RitualFontId, opentype.Font>();
const registeredFontFaces = new Map<string, Promise<boolean>>();
const layoutCache = new Map<string, TextLayoutResult>();
const maskCache = new Map<string, RasterizedMask>();
const MAX_CACHE_ENTRIES = 96;

function setBoundedCache<V>(cache: Map<string, V>, key: string, value: V) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

/** Parses and caches a bundled SIL OFL 1.1 ritual font subset synchronously. */
export function getRitualFont(fontId: RitualFontId): opentype.Font {
  let font = fontCache.get(fontId);
  if (!font) {
    font = opentype.parse(decodeFontSubsetBuffer(fontId));
    fontCache.set(fontId, font);
  }
  return font;
}

/** Returns true when every non-whitespace code point in `text` exists in the font subset. */
export function hasRitualFontGlyphs(fontId: RitualFontId, text: string): boolean {
  const font = getRitualFont(fontId);
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    const idx = font.charToGlyphIndex(ch);
    if (!idx) return false;
  }
  return true;
}

/**
 * Registers a bundled subset via the browser CSS Font Loading API (`FontFace`) so Canvas2D
 * or DOM text can render with it. Safely resolves `false` in Node/jsdom without throwing.
 */
export function ensureRitualFontFace(
  fontId: RitualFontId,
  familyName: string,
): Promise<boolean> {
  const key = `${fontId}:${familyName}`;
  const existing = registeredFontFaces.get(key);
  if (existing) return existing;

  const task = (async () => {
    if (
      typeof FontFace === "undefined" ||
      typeof document === "undefined" ||
      !document.fonts
    ) {
      return false;
    }
    try {
      const buffer = decodeFontSubsetBuffer(fontId);
      const face = new FontFace(familyName, buffer);
      const loaded = await face.load();
      (document.fonts as FontFaceSet & { add?: (f: FontFace) => unknown }).add?.(
        loaded,
      );
      return true;
    } catch {
      return false;
    }
  })();

  registeredFontFaces.set(key, task);
  return task;
}

/** Signed 2D polygon area (`> 0` for counter-clockwise, `< 0` for clockwise). */
export function signedArea2D(ring: readonly Point2D[]): number {
  let sum = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum * 0.5;
}

/** Ray-casting point-in-polygon test in 2D. */
export function pointInRing2D(
  px: number,
  py: number,
  ring: readonly Point2D[],
): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i]![0];
    const yi = ring[i]![1];
    const xj = ring[j]![0];
    const yj = ring[j]![1];
    if (yi > py !== yj > py) {
      const xIntersect = ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (px < xIntersect) inside = !inside;
    }
  }
  return inside;
}

/** Computes a non-zero winding number of `(px, py)` against a collection of rings. */
export function windingNumber2D(
  px: number,
  py: number,
  rings: readonly (readonly Point2D[])[],
): number {
  let wn = 0;
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r]!;
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % n]!;
      if (a[1] <= py) {
        if (
          b[1] > py &&
          (b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1]) > 0
        ) {
          wn++;
        }
      } else {
        if (
          b[1] <= py &&
          (b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1]) < 0
        ) {
          wn--;
        }
      }
    }
  }
  return wn;
}

function emptyBounds(): Bounds2D {
  return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
}

function computeRingsBounds(rings: readonly Ring2D[]): Bounds2D {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r]!;
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = ring[i]!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return emptyBounds();
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function cleanRing(raw: Ring2D, eps: number, minArea: number): Ring2D | null {
  if (raw.length < 3) return null;
  const dedup: Ring2D = [];
  const epsSq = eps * eps;
  for (let i = 0; i < raw.length; i++) {
    const pt = raw[i]!;
    const prev = dedup[dedup.length - 1];
    if (prev) {
      const dx = pt[0] - prev[0];
      const dy = pt[1] - prev[1];
      if (dx * dx + dy * dy <= epsSq) continue;
    }
    dedup.push([pt[0], pt[1]]);
  }
  while (dedup.length >= 2) {
    const first = dedup[0]!;
    const last = dedup[dedup.length - 1]!;
    const dx = first[0] - last[0];
    const dy = first[1] - last[1];
    if (dx * dx + dy * dy <= epsSq) dedup.pop();
    else break;
  }
  if (dedup.length < 3) return null;
  if (Math.abs(signedArea2D(dedup)) <= minArea) return null;
  return dedup;
}

/**
 * Converts an `opentype.Path` (Y-down canvas convention) into cleaned Y-up 2D rings.
 * Handles implicit contour closure for TrueType fonts (where `Z` commands may be omitted).
 */
function flattenOpenTypePath(
  path: opentype.Path,
  flatness: number,
  maxCurveSegments: number,
  minArea: number,
): Ring2D[] {
  const rings: Ring2D[] = [];
  const dedupEps = Math.max(1e-7, flatness * 0.05);
  let current: Ring2D | null = null;
  let cx = 0;
  let cy = 0;

  const flush = () => {
    if (!current) return;
    const cleaned = cleanRing(current, dedupEps, minArea);
    if (cleaned) rings.push(cleaned);
    current = null;
  };

  for (let i = 0; i < path.commands.length; i++) {
    const cmd = path.commands[i]!;
    if (cmd.type === "M") {
      flush();
      cx = cmd.x;
      cy = -cmd.y;
      current = [[cx, cy]];
    } else if (cmd.type === "L") {
      if (!current) {
        cx = cmd.x;
        cy = -cmd.y;
        current = [[cx, cy]];
      } else {
        cx = cmd.x;
        cy = -cmd.y;
        current.push([cx, cy]);
      }
    } else if (cmd.type === "Q") {
      if (!current) current = [[cx, cy]];
      const x0 = cx;
      const y0 = cy;
      const x1 = cmd.x1;
      const y1 = -cmd.y1;
      const x2 = cmd.x;
      const y2 = -cmd.y;
      // Analytic quadratic flatness error bound: max deviation <= |p0 - 2p1 + p2| / (8 * n^2).
      const d = Math.hypot(x0 - 2 * x1 + x2, y0 - 2 * y1 + y2);
      const segs = Math.max(
        1,
        Math.min(maxCurveSegments, Math.ceil(Math.sqrt(d / (8 * flatness)))),
      );
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const mt = 1 - t;
        current.push([
          mt * mt * x0 + 2 * mt * t * x1 + t * t * x2,
          mt * mt * y0 + 2 * mt * t * y1 + t * t * y2,
        ]);
      }
      cx = x2;
      cy = y2;
    } else if (cmd.type === "C") {
      if (!current) current = [[cx, cy]];
      const x0 = cx;
      const y0 = cy;
      const x1 = cmd.x1;
      const y1 = -cmd.y1;
      const x2 = cmd.x2;
      const y2 = -cmd.y2;
      const x3 = cmd.x;
      const y3 = -cmd.y;
      const d1 = Math.hypot(x0 - 2 * x1 + x2, y0 - 2 * y1 + y2);
      const d2 = Math.hypot(x1 - 2 * x2 + x3, y1 - 2 * y2 + y3);
      const d = Math.max(d1, d2);
      const segs = Math.max(
        1,
        Math.min(maxCurveSegments, Math.ceil(Math.sqrt((3 * d) / (4 * flatness)))),
      );
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;
        current.push([
          mt2 * mt * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t2 * t * x3,
          mt2 * mt * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t2 * t * y3,
        ]);
      }
      cx = x3;
      cy = y3;
    } else if (cmd.type === "Z") {
      flush();
    }
  }
  flush();
  return rings;
}

/**
 * Classifies raw Y-up contour rings from one glyph into `PolygonWithHoles[]`,
 * guaranteeing CCW outer rings and CW hole rings regardless of TrueType vs CFF winding.
 */
function classifyGlyphRings(rings: readonly Ring2D[]): PolygonWithHoles[] {
  if (rings.length === 0) return [];
  const entries = rings.map((ring) => {
    const area = signedArea2D(ring);
    const bounds = computeRingsBounds([ring]);
    return { ring, area, absArea: Math.abs(area), bounds };
  });

  // The ring with largest enclosed area is always an outer contour of the glyph.
  let maxAbs = -1;
  let outerSign = -1;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i]!.absArea > maxAbs) {
      maxAbs = entries[i]!.absArea;
      outerSign = entries[i]!.area >= 0 ? 1 : -1;
    }
  }

  const outers: {
    poly: PolygonWithHoles;
    absArea: number;
    bounds: Bounds2D;
  }[] = [];
  const holes: { ring: Ring2D; bounds: Bounds2D }[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const sign = entry.area >= 0 ? 1 : -1;
    if (sign === outerSign) {
      const ccw: Ring2D =
        entry.area > 0
          ? entry.ring.map((p) => [p[0], p[1]])
          : entry.ring.slice().reverse().map((p) => [p[0], p[1]]);
      outers.push({
        poly: { outer: ccw, holes: [] },
        absArea: entry.absArea,
        bounds: entry.bounds,
      });
    } else {
      const cw: Ring2D =
        entry.area < 0
          ? entry.ring.map((p) => [p[0], p[1]])
          : entry.ring.slice().reverse().map((p) => [p[0], p[1]]);
      holes.push({ ring: cw, bounds: entry.bounds });
    }
  }

  // Assign each hole to the smallest-area outer contour containing it.
  for (let h = 0; h < holes.length; h++) {
    const hole = holes[h]!;
    const samplePts: Point2D[] = [
      hole.ring[0]!,
      [
        (hole.ring[0]![0] + hole.ring[1]![0]) * 0.5,
        (hole.ring[0]![1] + hole.ring[1]![1]) * 0.5,
      ],
      [
        (hole.bounds.minX + hole.bounds.maxX) * 0.5,
        (hole.bounds.minY + hole.bounds.maxY) * 0.5,
      ],
    ];

    let bestOuter: (typeof outers)[number] | null = null;
    for (let o = 0; o < outers.length; o++) {
      const cand = outers[o]!;
      const b = cand.bounds;
      if (
        hole.bounds.maxX < b.minX ||
        hole.bounds.minX > b.maxX ||
        hole.bounds.maxY < b.minY ||
        hole.bounds.minY > b.maxY
      ) {
        continue;
      }
      let inside = false;
      for (let s = 0; s < samplePts.length; s++) {
        if (pointInRing2D(samplePts[s]![0], samplePts[s]![1], cand.poly.outer)) {
          inside = true;
          break;
        }
      }
      if (inside && (!bestOuter || cand.absArea < bestOuter.absArea)) {
        bestOuter = cand;
      }
    }
    if (bestOuter) {
      bestOuter.poly.holes.push(hole.ring);
    }
  }

  return outers.map((o) => o.poly);
}

function transformRing(
  ring: Ring2D,
  scale: number,
  offsetX: number,
  offsetY: number,
): Ring2D {
  return ring.map(([x, y]) => [x * scale + offsetX, y * scale + offsetY]);
}

function transformPolygon(
  poly: PolygonWithHoles,
  scale: number,
  offsetX: number,
  offsetY: number,
): PolygonWithHoles {
  return {
    outer: transformRing(poly.outer, scale, offsetX, offsetY),
    holes: poly.holes.map((h) => transformRing(h, scale, offsetX, offsetY)),
  };
}

/**
 * Extracts exact closed 2D polygons (with outer/hole hierarchy) for a string rendered
 * in one of the bundled SIL OFL 1.1 ritual fonts.
 */
export function layoutTextPolygons(
  fontId: RitualFontId,
  text: string,
  options: GlyphOutlineOptions = {},
): TextLayoutResult {
  const cacheKey = `${fontId}\0${text}\0${options.fontSize ?? ""}\0${options.letterSpacing ?? ""}\0${options.flatness ?? ""}\0${options.maxCurveSegments ?? ""}\0${options.center ? 1 : 0}\0${options.targetHeight ?? ""}\0${options.fitBox ? `${options.fitBox[0]},${options.fitBox[1]}` : ""}\0${options.minRingAreaRatio ?? ""}`;
  const cached = layoutCache.get(cacheKey);
  if (cached) return cached;

  const font = getRitualFont(fontId);
  const baseFontSize = options.fontSize ?? 1.0;
  const letterSpacing = options.letterSpacing ?? 0;
  const flatness = Math.max(1e-5, (options.flatness ?? 0.002) * baseFontSize);
  const maxCurveSegments = options.maxCurveSegments ?? 24;
  const minArea =
    (options.minRingAreaRatio ?? 1e-6) * baseFontSize * baseFontSize;

  const fontScale = baseFontSize / font.unitsPerEm;
  const glyphsList = font.stringToGlyphs(text);
  const chars = Array.from(text);

  const items: GlyphLayoutItem[] = [];
  const allRawRings: Ring2D[] = [];
  let cursorX = 0;

  for (let i = 0; i < glyphsList.length; i++) {
    const glyph = glyphsList[i]!;
    if (i > 0) {
      const kern = font.getKerningValue(glyphsList[i - 1]!, glyph);
      cursorX += kern * fontScale;
    }
    const path = glyph.getPath(cursorX, 0, baseFontSize);
    const rawRings = flattenOpenTypePath(
      path,
      flatness,
      maxCurveSegments,
      minArea,
    );
    const polygons = classifyGlyphRings(rawRings);
    const bounds = computeRingsBounds(rawRings);
    const advanceX =
      (glyph.advanceWidth ?? font.unitsPerEm) * fontScale +
      (i < glyphsList.length - 1 ? letterSpacing * baseFontSize : 0);

    items.push({
      char: chars[i] ?? "",
      index: i,
      polygons,
      rawRings,
      bounds,
      advanceX,
    });
    for (let r = 0; r < rawRings.length; r++) allRawRings.push(rawRings[r]!);
    cursorX += advanceX;
  }

  let bounds = computeRingsBounds(allRawRings);
  let postScale = 1;
  if (options.targetHeight && bounds.height > 1e-8) {
    postScale = options.targetHeight / bounds.height;
  } else if (options.fitBox && bounds.width > 1e-8 && bounds.height > 1e-8) {
    const [maxW, maxH] = options.fitBox;
    postScale = Math.min(maxW / bounds.width, maxH / bounds.height);
  }

  let offsetX = 0;
  let offsetY = 0;
  if (options.center && bounds.width > 0 && bounds.height > 0) {
    offsetX = -((bounds.minX + bounds.maxX) * 0.5) * postScale;
    offsetY = -((bounds.minY + bounds.maxY) * 0.5) * postScale;
  }

  const needsTransform =
    postScale !== 1 || offsetX !== 0 || offsetY !== 0;

  const finalItems: GlyphLayoutItem[] = needsTransform
    ? items.map((item) => {
        const rawRings = item.rawRings.map((r) =>
          transformRing(r, postScale, offsetX, offsetY),
        );
        const polygons = item.polygons.map((p) =>
          transformPolygon(p, postScale, offsetX, offsetY),
        );
        return {
          ...item,
          rawRings,
          polygons,
          bounds: computeRingsBounds(rawRings),
          advanceX: item.advanceX * postScale,
        };
      })
    : items;

  const finalPolygons: PolygonWithHoles[] = [];
  const finalRawRings: Ring2D[] = [];
  for (let i = 0; i < finalItems.length; i++) {
    const item = finalItems[i]!;
    for (let p = 0; p < item.polygons.length; p++) {
      finalPolygons.push(item.polygons[p]!);
    }
    for (let r = 0; r < item.rawRings.length; r++) {
      finalRawRings.push(item.rawRings[r]!);
    }
  }
  bounds = computeRingsBounds(finalRawRings);

  const result: TextLayoutResult = {
    fontId,
    text,
    glyphs: finalItems,
    polygons: finalPolygons,
    rawRings: finalRawRings,
    bounds,
    totalAdvance: cursorX * postScale,
  };
  setBoundedCache(layoutCache, cacheKey, result);
  return result;
}

/**
 * Convenience helper returning centered, unit-height (`height = 1.0`) closed 2D contours
 * for a single character — directly compatible with custom manifold relief extruders
 * such as `chinese-longevity-lock`'s `domeReliefSolid()`.
 */
export function getGlyphNormalizedContours(
  fontId: RitualFontId,
  char: string,
  options: Omit<GlyphOutlineOptions, "center" | "targetHeight"> = {},
): PolygonWithHoles[] {
  return layoutTextPolygons(fontId, char, {
    ...options,
    fontSize: 1.0,
    center: true,
    targetHeight: 1.0,
  }).polygons;
}

/** Converts `PolygonWithHoles[]` into `THREE.Shape[]` with properly oriented holes. */
export function polygonsToThreeShapes(
  polygons: readonly PolygonWithHoles[],
): THREE.Shape[] {
  return polygons.map((poly) => {
    const shape = new THREE.Shape(
      poly.outer.map(([x, y]) => new THREE.Vector2(x, y)),
    );
    shape.closePath();
    for (let h = 0; h < poly.holes.length; h++) {
      const hole = new THREE.Path(
        poly.holes[h]!.map(([x, y]) => new THREE.Vector2(x, y)),
      );
      hole.closePath();
      shape.holes.push(hole);
    }
    return shape;
  });
}

/** Extracts `THREE.Shape[]` directly for a text string in the given ritual font. */
export function getTextShapes(
  fontId: RitualFontId,
  text: string,
  options: GlyphOutlineOptions = {},
): THREE.Shape[] {
  return polygonsToThreeShapes(layoutTextPolygons(fontId, text, options).polygons);
}

function subdivideRingByLength(ring: readonly Point2D[], maxEdge: number): Ring2D {
  const out: Ring2D = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    out.push([a[0], a[1]]);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d > maxEdge) {
      const steps = Math.ceil(d / maxEdge);
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
  }
  return out;
}

/**
 * Conformal midpoint refinement of a 2D triangle mesh so no triangle edge exceeds
 * `maxEdgeLength`, preventing chord clipping on curved surfaces while introducing
 * zero T-junctions.
 */
function refineTriangulation2D(
  verts: Point2D[],
  indices: number[],
  maxEdgeLength: number,
  maxPasses = 5,
): { verts: Point2D[]; indices: number[] } {
  const maxLenSq = maxEdgeLength * maxEdgeLength;
  let currentIndices = indices;

  for (let pass = 0; pass < maxPasses; pass++) {
    const edgeMid = new Map<string, number>();
    let splitAny = false;

    const checkEdge = (a: number, b: number): number => {
      const lo = a < b ? a : b;
      const hi = a < b ? b : a;
      const key = `${lo}_${hi}`;
      const existing = edgeMid.get(key);
      if (existing !== undefined) return existing;
      const pa = verts[lo]!;
      const pb = verts[hi]!;
      const dx = pb[0] - pa[0];
      const dy = pb[1] - pa[1];
      if (dx * dx + dy * dy <= maxLenSq) return -1;
      const midIdx = verts.length;
      verts.push([(pa[0] + pb[0]) * 0.5, (pa[1] + pb[1]) * 0.5]);
      edgeMid.set(key, midIdx);
      splitAny = true;
      return midIdx;
    };

    const nextIndices: number[] = [];
    for (let i = 0; i < currentIndices.length; i += 3) {
      const i0 = currentIndices[i]!;
      const i1 = currentIndices[i + 1]!;
      const i2 = currentIndices[i + 2]!;
      const m01 = checkEdge(i0, i1);
      const m12 = checkEdge(i1, i2);
      const m20 = checkEdge(i2, i0);

      const splits =
        (m01 >= 0 ? 1 : 0) + (m12 >= 0 ? 2 : 0) + (m20 >= 0 ? 4 : 0);

      if (splits === 0) {
        nextIndices.push(i0, i1, i2);
      } else if (splits === 7) {
        nextIndices.push(
          i0, m01, m20,
          m01, i1, m12,
          m20, m12, i2,
          m01, m12, m20,
        );
      } else if (splits === 1) {
        nextIndices.push(i0, m01, i2, m01, i1, i2);
      } else if (splits === 2) {
        nextIndices.push(i0, i1, m12, i0, m12, i2);
      } else if (splits === 4) {
        nextIndices.push(i0, i1, m20, m20, i1, i2);
      } else if (splits === 3) {
        // m01 and m12 split
        nextIndices.push(m01, i1, m12, i0, m01, m12, i0, m12, i2);
      } else if (splits === 5) {
        // m01 and m20 split
        nextIndices.push(i0, m01, m20, m01, i1, m20, m20, i1, i2);
      } else {
        // splits === 6: m12 and m20 split
        nextIndices.push(m20, m12, i2, i0, i1, m12, i0, m12, m20);
      }
    }

    currentIndices = nextIndices;
    if (!splitAny) break;
  }

  return { verts, indices: currentIndices };
}

/**
 * Triangulates `PolygonWithHoles[]` with `earcut`, optionally applying conformal
 * subdivision for curved-surface wrapping and removing degenerate zero-area triangles.
 */
export function triangulatePolygons2D(
  polygons: readonly PolygonWithHoles[],
  maxEdgeLength?: number,
): { verts: Point2D[]; indices: number[] } {
  const allVerts: Point2D[] = [];
  const allIndices: number[] = [];

  for (let p = 0; p < polygons.length; p++) {
    const poly = polygons[p]!;
    const outer =
      maxEdgeLength && maxEdgeLength > 0
        ? subdivideRingByLength(poly.outer, maxEdgeLength)
        : poly.outer;
    const holes =
      maxEdgeLength && maxEdgeLength > 0
        ? poly.holes.map((h) => subdivideRingByLength(h, maxEdgeLength))
        : poly.holes;

    const flat: number[] = [];
    const holeIndices: number[] = [];
    const localVerts: Point2D[] = [];

    for (let i = 0; i < outer.length; i++) {
      const pt = outer[i]!;
      flat.push(pt[0], pt[1]);
      localVerts.push([pt[0], pt[1]]);
    }
    for (let h = 0; h < holes.length; h++) {
      const hole = holes[h]!;
      holeIndices.push(localVerts.length);
      for (let i = 0; i < hole.length; i++) {
        const pt = hole[i]!;
        flat.push(pt[0], pt[1]);
        localVerts.push([pt[0], pt[1]]);
      }
    }

    const tri = earcut(flat, holeIndices.length > 0 ? holeIndices : undefined, 2);
    // Filter degenerate triangles before optional refinement.
    const cleanTri: number[] = [];
    for (let i = 0; i < tri.length; i += 3) {
      const a = localVerts[tri[i]!]!;
      const b = localVerts[tri[i + 1]!]!;
      const c = localVerts[tri[i + 2]!]!;
      const cross =
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(cross) <= 1e-12) continue;
      if (cross > 0) cleanTri.push(tri[i]!, tri[i + 1]!, tri[i + 2]!);
      else cleanTri.push(tri[i]!, tri[i + 2]!, tri[i + 1]!);
    }

    const refined =
      maxEdgeLength && maxEdgeLength > 0
        ? refineTriangulation2D(localVerts, cleanTri, maxEdgeLength)
        : { verts: localVerts, indices: cleanTri };

    const base = allVerts.length;
    for (let i = 0; i < refined.verts.length; i++) {
      allVerts.push(refined.verts[i]!);
    }
    for (let i = 0; i < refined.indices.length; i++) {
      allIndices.push(base + refined.indices[i]!);
    }
  }

  return { verts: allVerts, indices: allIndices };
}

function buildFlatBufferGeometry(
  verts: readonly Point2D[],
  indices: readonly number[],
  options: Pick<
    FlatGeometryOptions,
    "plane" | "zOffset" | "deformVertex" | "uvBounds" | "vertexColor"
  >,
): FlatGeometryResult {
  const n = verts.length;
  const positions = new Float32Array(n * 3);
  const coords2D = new Float32Array(n * 2);
  const uvs = new Float32Array(n * 2);
  const hasColor = typeof options.vertexColor === "function";
  const colors = hasColor ? new Float32Array(n * 3) : null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const [x, y] = verts[i]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const ownBounds: Bounds2D = Number.isFinite(minX)
    ? { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
    : emptyBounds();
  const uvB = options.uvBounds ?? ownBounds;
  const spanX = Math.max(1e-6, uvB.width);
  const spanY = Math.max(1e-6, uvB.height);

  const plane = options.plane ?? "xy";
  const zOffset = options.zOffset ?? 0;
  const tmpPos = new THREE.Vector3();
  const tmpColor = new THREE.Color();

  for (let i = 0; i < n; i++) {
    const [x, y] = verts[i]!;
    coords2D[i * 2] = x;
    coords2D[i * 2 + 1] = y;
    uvs[i * 2] = (x - uvB.minX) / spanX;
    uvs[i * 2 + 1] = (y - uvB.minY) / spanY;

    if (options.deformVertex) {
      options.deformVertex(x, y, tmpPos);
      positions[i * 3] = tmpPos.x;
      positions[i * 3 + 1] = tmpPos.y;
      positions[i * 3 + 2] = tmpPos.z;
    } else if (plane === "xz") {
      // +y in 2D maps to -z in 3D so CCW 2D triangles face +Y upward.
      positions[i * 3] = x;
      positions[i * 3 + 1] = zOffset;
      positions[i * 3 + 2] = -y;
    } else {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = zOffset;
    }

    if (colors && options.vertexColor) {
      options.vertexColor(x, y, tmpColor);
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  if (colors) {
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  geometry.setIndex(Array.from(indices));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, coords2D, bounds: ownBounds };
}

/**
 * Builds a flat (or surface-conformed) triangulated BufferGeometry from pre-extracted polygons.
 */
export function createPolygonsFlatGeometry(
  polygons: readonly PolygonWithHoles[],
  options: FlatGeometryOptions = {},
): FlatGeometryResult {
  const { verts, indices } = triangulatePolygons2D(
    polygons,
    options.maxEdgeLength,
  );
  return buildFlatBufferGeometry(verts, indices, options);
}

/** Builds a flat or surface-conformed triangulated mesh for a text string. */
export function createTextFlatGeometry(
  fontId: RitualFontId,
  text: string,
  options: FlatGeometryOptions = {},
): FlatGeometryResult {
  const layout = layoutTextPolygons(fontId, text, options);
  return createPolygonsFlatGeometry(layout.polygons, {
    ...options,
    uvBounds: options.uvBounds ?? layout.bounds,
  });
}

/** Builds a flat or surface-conformed triangulated mesh for a single character. */
export function createGlyphFlatGeometry(
  fontId: RitualFontId,
  char: string,
  options: FlatGeometryOptions = {},
): FlatGeometryResult {
  return createTextFlatGeometry(fontId, char, options);
}

/**
 * Clips a 2D triangle against a half-plane `axisVal >= min` or `axisVal <= max`
 * (Sutherland-Hodgman polygon clip for a 3-vertex triangle), returning 0..2 triangles.
 */
function clipPolygonHalfPlane(
  poly: Point2D[],
  axis: 0 | 1,
  limit: number,
  keepGreater: boolean,
): Point2D[] {
  if (poly.length === 0) return [];
  const out: Point2D[] = [];
  const inside = (p: Point2D) =>
    keepGreater ? p[axis] >= limit - 1e-10 : p[axis] <= limit + 1e-10;

  let prev = poly[poly.length - 1]!;
  let prevIn = inside(prev);
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i]!;
    const currIn = inside(curr);
    if (currIn !== prevIn) {
      const denom = curr[axis] - prev[axis];
      const t = Math.abs(denom) > 1e-12 ? (limit - prev[axis]) / denom : 0;
      const clampedT = Math.max(0, Math.min(1, t));
      out.push([
        prev[0] + (curr[0] - prev[0]) * clampedT,
        prev[1] + (curr[1] - prev[1]) * clampedT,
      ]);
    }
    if (currIn) out.push(curr);
    prev = curr;
    prevIn = currIn;
  }
  return out;
}

/**
 * Slices `PolygonWithHoles[]` into `sliceCount` exact seam-free progressive pieces
 * along `'x'` (left -> right), `'y-desc'` (top -> bottom), or `'y-asc'` (bottom -> top).
 * Uses exact triangle clipping along band cut lines so adjacent pieces share crisp,
 * gapless boundaries when revealed progressively (e.g. chalk writing or calligraphy writing).
 */
export function createProgressivePolygonsSlices(
  polygons: readonly PolygonWithHoles[],
  sliceCount: number,
  options: FlatGeometryOptions & {
    direction?: "x" | "y-desc" | "y-asc";
  } = {},
): SlicedFlatPiece[] {
  const count = Math.max(1, Math.floor(sliceCount));
  const direction = options.direction ?? "x";
  const { verts, indices } = triangulatePolygons2D(
    polygons,
    options.maxEdgeLength,
  );
  if (verts.length === 0 || indices.length === 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < verts.length; i++) {
    const [x, y] = verts[i]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const fullBounds: Bounds2D = {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
  const axis: 0 | 1 = direction === "x" ? 0 : 1;
  const lo = axis === 0 ? minX : minY;
  const hi = axis === 0 ? maxX : maxY;
  const span = Math.max(1e-6, hi - lo);

  const pieces: SlicedFlatPiece[] = [];
  for (let s = 0; s < count; s++) {
    const u0 = s / count;
    const u1 = (s + 1) / count;
    const bandMin =
      direction === "y-desc" ? hi - u1 * span : lo + u0 * span;
    const bandMax =
      direction === "y-desc" ? hi - u0 * span : lo + u1 * span;

    const sliceVerts: Point2D[] = [];
    const sliceIndices: number[] = [];

    for (let i = 0; i < indices.length; i += 3) {
      const a = verts[indices[i]!]!;
      const b = verts[indices[i + 1]!]!;
      const c = verts[indices[i + 2]!]!;
      const tMin = Math.min(a[axis], b[axis], c[axis]);
      const tMax = Math.max(a[axis], b[axis], c[axis]);
      if (tMax <= bandMin + 1e-10 || tMin >= bandMax - 1e-10) continue;

      let poly: Point2D[] = [a, b, c];
      if (tMin < bandMin) {
        poly = clipPolygonHalfPlane(poly, axis, bandMin, true);
      }
      if (poly.length >= 3 && tMax > bandMax) {
        poly = clipPolygonHalfPlane(poly, axis, bandMax, false);
      }
      if (poly.length < 3) continue;

      const base = sliceVerts.length;
      for (let k = 0; k < poly.length; k++) {
        sliceVerts.push([poly[k]![0], poly[k]![1]]);
      }
      for (let k = 1; k < poly.length - 1; k++) {
        const p0 = poly[0]!;
        const p1 = poly[k]!;
        const p2 = poly[k + 1]!;
        const cross =
          (p1[0] - p0[0]) * (p2[1] - p0[1]) -
          (p1[1] - p0[1]) * (p2[0] - p0[0]);
        if (Math.abs(cross) <= 1e-12) continue;
        if (cross > 0) sliceIndices.push(base, base + k, base + k + 1);
        else sliceIndices.push(base, base + k + 1, base + k);
      }
    }

    if (sliceIndices.length === 0) continue;
    const built = buildFlatBufferGeometry(sliceVerts, sliceIndices, {
      ...options,
      uvBounds: options.uvBounds ?? fullBounds,
    });
    pieces.push({
      ...built,
      uStart: u0,
      uEnd: u1,
    });
  }

  return pieces;
}

/**
 * Builds a 3D beveled relief BufferGeometry for a character or short text string.
 * Overlapping multi-contour glyphs (such as serifed Hebrew/Latin fonts) receive an
 * imperceptible per-contour depth micro-offset so front faces never Z-fight in WebGL.
 */
export function createTextExtrudeGeometry(
  fontId: RitualFontId,
  text: string,
  options: ExtrudeGlyphOptions = {},
): THREE.BufferGeometry {
  const layout = layoutTextPolygons(fontId, text, options);
  const shapes = polygonsToThreeShapes(layout.polygons);
  const depth = options.depth ?? 0.01;
  const bevelEnabled = options.bevelEnabled ?? true;
  const bevelThickness = bevelEnabled ? (options.bevelThickness ?? depth * 0.18) : 0;
  const bevelSize = bevelEnabled ? (options.bevelSize ?? depth * 0.12) : 0;
  const bevelSegments = bevelEnabled ? (options.bevelSegments ?? 2) : 0;
  const curveSegments = options.curveSegments ?? 12;
  const steps = options.steps ?? 1;

  if (shapes.length === 0) {
    return new THREE.BufferGeometry();
  }

  // Extrude each shape cleanly, giving tiny deterministic micro-step to prevent coplanar Z-fighting
  // on overlapping font strokes (e.g. Frank Ruhl Libre Shin stems meeting the baseline bar).
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const stepZ = Math.min(depth * 0.004, 0.00004);

  for (let s = 0; s < shapes.length; s++) {
    const part = new THREE.ExtrudeGeometry(shapes[s]!, {
      depth: depth + s * stepZ,
      bevelEnabled,
      bevelThickness,
      bevelSize,
      bevelSegments,
      curveSegments,
      steps,
    });
    const nonIndexed = part.index ? part.toNonIndexed() : part;
    if (!nonIndexed.getAttribute("normal")) nonIndexed.computeVertexNormals();
    const pAttr = nonIndexed.getAttribute("position");
    const nAttr = nonIndexed.getAttribute("normal");
    const uAttr = nonIndexed.getAttribute("uv");

    for (let i = 0; i < pAttr.count; i++) {
      positions.push(pAttr.getX(i), pAttr.getY(i), pAttr.getZ(i));
      normals.push(nAttr.getX(i), nAttr.getY(i), nAttr.getZ(i));
      if (uAttr) uvs.push(uAttr.getX(i), uAttr.getY(i));
      else uvs.push(0, 0);
    }

    if (nonIndexed !== part) nonIndexed.dispose();
    part.dispose();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(normals, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingBox();

  if (options.alignBackToZero ?? true) {
    const minZ = geometry.boundingBox?.min.z ?? 0;
    if (Math.abs(minZ) > 1e-9) {
      geometry.translate(0, 0, -minZ);
    }
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Convenience wrapper for extruding a single glyph in 3D with beveled edges. */
export function createGlyphExtrudeGeometry(
  fontId: RitualFontId,
  char: string,
  options: ExtrudeGlyphOptions = {},
): THREE.BufferGeometry {
  return createTextExtrudeGeometry(fontId, char, options);
}

interface ScanEdge {
  yMin: number;
  yMax: number;
  xAtYMin: number;
  dxPerY: number;
  dir: 1 | -1;
}

/**
 * Pure CPU supersampled non-zero winding scanline rasterizer (zero Canvas2D dependency).
 * Uses analytical horizontal span coverage across `supersample` vertical sub-scanlines
 * for crisp, deterministic anti-aliasing in both WebGL and Node/Vitest environments.
 */
export function rasterizeFontTextMask(
  fontId: RitualFontId,
  text: string,
  options: RasterizeTextOptions,
): RasterizedMask {
  const padKey =
    typeof options.padding === "number"
      ? String(options.padding)
      : options.padding
        ? `${options.padding[0]},${options.padding[1]}`
        : "";
  const regKey = options.region
    ? `${options.region.x},${options.region.y},${options.region.width},${options.region.height}`
    : "";
  const cacheKey = `${fontId}\0${text}\0${options.width}x${options.height}\0${options.letterSpacing ?? ""}\0${options.align ?? ""}\0${options.verticalAlign ?? ""}\0${padKey}\0${options.lineHeight ?? ""}\0${options.fontSize ?? ""}\0${options.supersample ?? ""}\0${options.invertY ? 1 : 0}\0${regKey}`;
  const cached = maskCache.get(cacheKey);
  if (cached) return cached;

  const width = Math.max(1, Math.floor(options.width));
  const height = Math.max(1, Math.floor(options.height));
  const data = new Float32Array(width * height);
  const lines = text.split("\n");
  const nonEmpty = lines.some((l) => l.trim().length > 0);
  if (!nonEmpty) {
    return {
      width,
      height,
      data,
      fontSize: options.fontSize ?? 0,
      inkBounds: emptyBounds(),
    };
  }

  const region = options.region ?? { x: 0, y: 0, width, height };
  const padX =
    typeof options.padding === "number"
      ? options.padding
      : (options.padding?.[0] ?? region.width * 0.08);
  const padY =
    typeof options.padding === "number"
      ? options.padding
      : (options.padding?.[1] ?? region.height * 0.12);
  const availW = Math.max(1, region.width - padX * 2);
  const availH = Math.max(1, region.height - padY * 2);
  const lineHeightMul = options.lineHeight ?? 1.24;
  const letterSpacing = options.letterSpacing ?? 0;

  // Layout each line at unit fontSize = 1.0 first so we can auto-fit exact ink dimensions.
  const unitLayouts = lines.map((line) =>
    layoutTextPolygons(fontId, line, {
      fontSize: 1.0,
      letterSpacing,
      flatness: 0.0018,
    }),
  );

  let maxLineW = 0;
  let refLineH = 0;
  for (let i = 0; i < unitLayouts.length; i++) {
    const b = unitLayouts[i]!.bounds;
    if (b.width > maxLineW) maxLineW = b.width;
    if (b.height > refLineH) refLineH = b.height;
  }
  if (maxLineW <= 1e-6 || refLineH <= 1e-6) {
    return {
      width,
      height,
      data,
      fontSize: options.fontSize ?? 0,
      inkBounds: emptyBounds(),
    };
  }

  const totalUnitH =
    unitLayouts.length === 1
      ? refLineH
      : refLineH + (unitLayouts.length - 1) * refLineH * lineHeightMul;

  const fontSize =
    options.fontSize ??
    Math.min(availW / maxLineW, availH / totalUnitH);

  const blockH = totalUnitH * fontSize;
  const verticalAlign = options.verticalAlign ?? "middle";
  const align = options.align ?? "center";

  const blockTopY =
    verticalAlign === "top"
      ? region.y + padY
      : verticalAlign === "bottom"
        ? region.y + region.height - padY - blockH
        : region.y + padY + (availH - blockH) * 0.5;

  // Build pixel-space scan edges (Y-down image space, y = 0 at top).
  const edges: ScanEdge[] = [];
  let inkMinX = Infinity;
  let inkMaxX = -Infinity;
  let inkMinY = Infinity;
  let inkMaxY = -Infinity;

  for (let li = 0; li < unitLayouts.length; li++) {
    const layout = unitLayouts[li]!;
    if (layout.rawRings.length === 0) continue;
    const b = layout.bounds;
    const lineW = b.width * fontSize;
    const lineH = b.height * fontSize;

    const lineLeftX =
      align === "left"
        ? region.x + padX
        : align === "right"
          ? region.x + region.width - padX - lineW
          : region.x + padX + (availW - lineW) * 0.5;

    const slotTopY =
      blockTopY + li * refLineH * lineHeightMul * fontSize;
    const lineTopY = slotTopY + (refLineH * fontSize - lineH) * 0.5;

    const originX = lineLeftX - b.minX * fontSize;
    const originY = lineTopY + b.maxY * fontSize;

    for (let r = 0; r < layout.rawRings.length; r++) {
      const ring = layout.rawRings[r]!;
      const m = ring.length;
      for (let i = 0; i < m; i++) {
        const a = ring[i]!;
        const next = ring[(i + 1) % m]!;
        const x0 = originX + a[0] * fontSize;
        const y0 = originY - a[1] * fontSize;
        const x1 = originX + next[0] * fontSize;
        const y1 = originY - next[1] * fontSize;

        if (x0 < inkMinX) inkMinX = x0;
        if (x0 > inkMaxX) inkMaxX = x0;
        if (y0 < inkMinY) inkMinY = y0;
        if (y0 > inkMaxY) inkMaxY = y0;

        if (Math.abs(y1 - y0) <= 1e-9) continue;
        if (y1 > y0) {
          edges.push({
            yMin: y0,
            yMax: y1,
            xAtYMin: x0,
            dxPerY: (x1 - x0) / (y1 - y0),
            dir: 1,
          });
        } else {
          edges.push({
            yMin: y1,
            yMax: y0,
            xAtYMin: x1,
            dxPerY: (x0 - x1) / (y0 - y1),
            dir: -1,
          });
        }
      }
    }
  }

  if (edges.length === 0) {
    return { width, height, data, fontSize, inkBounds: emptyBounds() };
  }

  const samples = Math.max(1, Math.min(16, Math.round(options.supersample ?? 8)));
  const invSamples = 1 / samples;
  const rowStart = Math.max(0, Math.floor(inkMinY));
  const rowEnd = Math.min(height - 1, Math.ceil(inkMaxY));

  const crossX: number[] = [];
  const crossDir: number[] = [];

  for (let py = rowStart; py <= rowEnd; py++) {
    const outRow = options.invertY ? height - 1 - py : py;
    const rowOffset = outRow * width;

    for (let s = 0; s < samples; s++) {
      const sy = py + (s + 0.5) * invSamples;
      crossX.length = 0;
      crossDir.length = 0;

      for (let e = 0; e < edges.length; e++) {
        const edge = edges[e]!;
        if (sy >= edge.yMin && sy < edge.yMax) {
          crossX.push(edge.xAtYMin + (sy - edge.yMin) * edge.dxPerY);
          crossDir.push(edge.dir);
        }
      }

      const k = crossX.length;
      if (k < 2) continue;

      // Insertion sort crossings by x (tiny arrays, zero allocation).
      for (let i = 1; i < k; i++) {
        const xVal = crossX[i]!;
        const dVal = crossDir[i]!;
        let j = i - 1;
        while (j >= 0 && crossX[j]! > xVal) {
          crossX[j + 1] = crossX[j]!;
          crossDir[j + 1] = crossDir[j]!;
          j--;
        }
        crossX[j + 1] = xVal;
        crossDir[j + 1] = dVal;
      }

      // Sweep spans under non-zero winding rule with exact analytical horizontal coverage.
      let winding = 0;
      for (let i = 0; i < k - 1; i++) {
        winding += crossDir[i]!;
        if (winding === 0) continue;
        const x0 = Math.max(0, crossX[i]!);
        const x1 = Math.min(width, crossX[i + 1]!);
        if (x1 <= x0) continue;

        const pxStart = Math.floor(x0);
        const pxEnd = Math.min(width - 1, Math.floor(x1));
        for (let px = pxStart; px <= pxEnd; px++) {
          const cov = Math.min(px + 1, x1) - Math.max(px, x0);
          if (cov > 0) {
            data[rowOffset + px] = Math.min(
              1,
              data[rowOffset + px]! + cov * invSamples,
            );
          }
        }
      }
    }
  }

  const result: RasterizedMask = {
    width,
    height,
    data,
    fontSize,
    inkBounds: {
      minX: inkMinX,
      maxX: inkMaxX,
      minY: inkMinY,
      maxY: inkMaxY,
      width: Math.max(0, inkMaxX - inkMinX),
      height: Math.max(0, inkMaxY - inkMinY),
    },
  };
  setBoundedCache(maskCache, cacheKey, result);
  return result;
}

/**
 * Renders anti-aliased text directly into a deterministic `THREE.DataTexture`
 * using the pure-CPU supersampled rasterizer (works identically in WebGL and Vitest).
 */
export function createFontDataTexture(
  fontId: RitualFontId,
  text: string,
  options: FontTextureOptions,
): THREE.DataTexture {
  const mask = rasterizeFontTextMask(fontId, text, options);
  const { width, height, data } = mask;
  const rgba = new Uint8Array(width * height * 4);
  const ink = options.inkColor ?? [30, 26, 22];
  const inkAlpha = options.inkAlpha ?? 1;
  const transparentBg = options.backgroundColor === "transparent";
  const bg: readonly [number, number, number] =
    options.backgroundColor === "transparent"
      ? [0, 0, 0]
      : (options.backgroundColor ?? [255, 255, 255]);
  const bgAlpha = transparentBg ? 0 : (options.backgroundAlpha ?? 255);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const offset = idx * 4;
      const cov = data[idx]!;
      const a = cov * inkAlpha;

      if (transparentBg) {
        rgba[offset] = ink[0];
        rgba[offset + 1] = ink[1];
        rgba[offset + 2] = ink[2];
        rgba[offset + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
      } else {
        rgba[offset] = Math.round(bg[0] + (ink[0] - bg[0]) * a);
        rgba[offset + 1] = Math.round(bg[1] + (ink[1] - bg[1]) * a);
        rgba[offset + 2] = Math.round(bg[2] + (ink[2] - bg[2]) * a);
        rgba[offset + 3] = bgAlpha;
      }

      if (options.shadePixel) {
        options.shadePixel(x, y, cov, rgba, offset);
      }
    }
  }

  const texture = new THREE.DataTexture(rgba, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = options.flipY ?? true;
  texture.magFilter = options.magFilter ?? THREE.LinearFilter;
  texture.minFilter = options.minFilter ?? THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = options.generateMipmaps ?? true;
  texture.needsUpdate = true;
  return texture;
}
