import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  RITUAL_FONT_SUBSETS_B64,
  createFontDataTexture,
  createGlyphExtrudeGeometry,
  createGlyphFlatGeometry,
  createProgressivePolygonsSlices,
  createTextFlatGeometry,
  getGlyphNormalizedContours,
  getRitualFont,
  getTextShapes,
  hasRitualFontGlyphs,
  layoutTextPolygons,
  rasterizeFontTextMask,
  signedArea2D,
  type RitualFontId,
} from "./glyph-kit";

describe("glyph-kit open-source ritual font engine", () => {
  it("parses and caches all 7 SIL OFL 1.1 font subsets synchronously", () => {
    const ids = Object.keys(RITUAL_FONT_SUBSETS_B64) as RitualFontId[];
    expect(ids).toHaveLength(7);
    for (const id of ids) {
      const a = getRitualFont(id);
      const b = getRitualFont(id);
      expect(a).toBe(b);
      expect(a.unitsPerEm).toBeGreaterThan(0);
    }
    expect(hasRitualFontGlyphs("mashanZheng", "福")).toBe(true);
    expect(hasRitualFontGlyphs("lxgwZhenKai", "平安長长命")).toBe(true);
    expect(hasRitualFontGlyphs("yujiSyuku", "五大力運")).toBe(true);
    expect(hasRitualFontGlyphs("cinzelBold", "20*C+M+B+26 BONFIM OM MA NI PAD ME HUM")).toBe(true);
    expect(hasRitualFontGlyphs("frankRuhlBold", "ש")).toBe(true);
    expect(hasRitualFontGlyphs("kleeOneSemiBold", "平安祝福")).toBe(true);
    expect(hasRitualFontGlyphs("mashanZheng", "龍")).toBe(false);
  });

  it("extracts oriented outer contours (CCW) and inner holes (CW) for complex glyphs including 福 and 運", () => {
    const fu = layoutTextPolygons("mashanZheng", "福", { center: true, targetHeight: 1 });
    expect(fu.polygons.length).toBeGreaterThanOrEqual(3);
    const fuHoles = fu.polygons.reduce((n, p) => n + p.holes.length, 0);
    expect(fuHoles).toBeGreaterThanOrEqual(2);
    for (const poly of fu.polygons) {
      expect(signedArea2D(poly.outer)).toBeGreaterThan(0);
      for (const hole of poly.holes) {
        expect(signedArea2D(hole)).toBeLessThan(0);
      }
    }
    expect(fu.bounds.height).toBeCloseTo(1, 3);
    expect(Math.abs((fu.bounds.minX + fu.bounds.maxX) / 2)).toBeLessThan(1e-4);

    // Explicitly verify Wave 2 readiness for udo-undama ('運' in Yuji Syuku).
    const un = layoutTextPolygons("yujiSyuku", "運", { center: true, targetHeight: 1 });
    expect(un.polygons.length).toBeGreaterThanOrEqual(2);
    const unHoles = un.polygons.reduce((n, p) => n + p.holes.length, 0);
    expect(unHoles).toBeGreaterThanOrEqual(3);
    for (const poly of un.polygons) {
      expect(signedArea2D(poly.outer)).toBeGreaterThan(0);
      for (const hole of poly.holes) expect(signedArea2D(hole)).toBeLessThan(0);
    }

    const shapes = getTextShapes("yujiSyuku", "運", { center: true, targetHeight: 1 });
    expect(shapes.length).toBe(un.polygons.length);
  });

  it("provides normalized unit-height contours for manifold 3D relief extrusion", () => {
    for (const ch of ["長", "长", "命"] as const) {
      const contours = getGlyphNormalizedContours("lxgwZhenKai", ch);
      expect(contours.length).toBeGreaterThan(0);
      let minY = Infinity;
      let maxY = -Infinity;
      for (const c of contours) {
        expect(signedArea2D(c.outer)).toBeGreaterThan(0);
        for (const [, y] of c.outer) {
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        for (const h of c.holes) expect(signedArea2D(h)).toBeLessThan(0);
      }
      expect(maxY - minY).toBeCloseTo(1.0, 4);
      expect((minY + maxY) * 0.5).toBeCloseTo(0, 4);
    }
  });

  it("triangulates flat and conformally subdivided meshes with consistent upward/forward winding", () => {
    // XY plane (+Z normal) with conformal edge refinement
    const flat = createGlyphFlatGeometry("mashanZheng", "福", {
      center: true,
      targetHeight: 0.5,
      maxEdgeLength: 0.04,
      plane: "xy",
      zOffset: 0.01,
    });
    const pos = flat.geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = flat.geometry.getIndex()!;
    expect(idx.count).toBeGreaterThan(300);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(pos, idx.getX(i));
      b.fromBufferAttribute(pos, idx.getX(i + 1));
      c.fromBufferAttribute(pos, idx.getX(i + 2));
      expect(b.clone().sub(a).cross(c.clone().sub(a)).z).toBeGreaterThan(1e-12);
      expect(a.distanceTo(b)).toBeLessThanOrEqual(0.045);
      expect(b.distanceTo(c)).toBeLessThanOrEqual(0.045);
      expect(c.distanceTo(a)).toBeLessThanOrEqual(0.045);
    }
    flat.geometry.dispose();

    // XZ plane (+Y normal) for curved pebble projection
    const pebbleGlyph = createGlyphFlatGeometry("yujiSyuku", "五", {
      center: true,
      fitBox: [0.18, 0.16],
      maxEdgeLength: 0.02,
      plane: "xz",
      deformVertex(x, y, out) {
        const z = -y;
        const h = 0.12 * Math.sqrt(Math.max(0.01, 1 - (x / 0.24) ** 2 - (z / 0.2) ** 2)) + 0.0025;
        out.set(x, h, z);
      },
    });
    const p2 = pebbleGlyph.geometry.getAttribute("position") as THREE.BufferAttribute;
    const ix2 = pebbleGlyph.geometry.getIndex()!;
    expect(ix2.count).toBeGreaterThan(100);
    for (let i = 0; i < ix2.count; i += 3) {
      a.fromBufferAttribute(p2, ix2.getX(i));
      b.fromBufferAttribute(p2, ix2.getX(i + 1));
      c.fromBufferAttribute(p2, ix2.getX(i + 2));
      expect(b.clone().sub(a).cross(c.clone().sub(a)).y).toBeGreaterThan(1e-10);
    }
    pebbleGlyph.geometry.dispose();
  });

  it("slices polygons seamlessly into progressive reveal segments", () => {
    const layout = layoutTextPolygons("lxgwZhenKai", "平", {
      center: true,
      targetHeight: 0.3,
    });
    const pieces = createProgressivePolygonsSlices(layout.polygons, 7, {
      direction: "y-desc",
      maxEdgeLength: 0.03,
    });
    expect(pieces).toHaveLength(7);
    for (let i = 1; i < pieces.length; i++) {
      expect(pieces[i]!.bounds.maxY).toBeLessThanOrEqual(pieces[i - 1]!.bounds.maxY + 1e-6);
    }
    for (const piece of pieces) piece.geometry.dispose();
  });

  it("extrudes beveled 3D Hebrew Shin (ש) cleanly aligned to z = 0", () => {
    const geo = createGlyphExtrudeGeometry("frankRuhlBold", "ש", {
      center: true,
      targetHeight: 0.12,
      depth: 0.008,
      bevelEnabled: true,
    });
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    expect(pos.count).toBeGreaterThan(200);
    geo.computeBoundingBox();
    expect(geo.boundingBox!.min.z).toBeCloseTo(0, 5);
    expect(geo.boundingBox!.max.z).toBeGreaterThan(0.008);
    expect(geo.boundingBox!.max.y - geo.boundingBox!.min.y).toBeGreaterThan(0.11);
    geo.dispose();
  });

  it("rasterizes smooth anti-aliased masks and DataTextures without Canvas2D, including overlapping Cinzel strokes and Yuji Syuku 運", () => {
    // Cinzel Bold BONFIM has overlapping same-sign contours (B stem + bowls); nonzero winding must keep solid strokes + hollow O counter.
    const bonfim = rasterizeFontTextMask("cinzelBold", "BONFIM", {
      width: 256,
      height: 64,
      padding: [8, 10],
      supersample: 8,
    });
    let solid = 0;
    let partial = 0;
    for (let i = 0; i < bonfim.data.length; i++) {
      const v = bonfim.data[i]!;
      if (v > 0.9) solid++;
      else if (v > 0.05 && v < 0.9) partial++;
    }
    expect(solid).toBeGreaterThan(1500);
    // Anti-aliased edge pixels must exist between 0 and 1.
    expect(partial).toBeGreaterThan(400);

    // Yuji Syuku '運' high-res DataTexture for Wave 2 udo-undama readiness.
    const unTex = createFontDataTexture("yujiSyuku", "運", {
      width: 128,
      height: 128,
      inkColor: [24, 22, 20],
      backgroundColor: "transparent",
      supersample: 8,
    });
    expect(unTex).toBeInstanceOf(THREE.DataTexture);
    const img = unTex.image as { data: Uint8Array; width: number; height: number };
    expect(img.width).toBe(128);
    expect(img.height).toBe(128);
    let opaqueInk = 0;
    let aaEdges = 0;
    for (let i = 3; i < img.data.length; i += 4) {
      const a = img.data[i]!;
      if (a >= 230) opaqueInk++;
      else if (a >= 20 && a < 230) aaEdges++;
    }
    expect(opaqueInk).toBeGreaterThan(2000);
    expect(aaEdges).toBeGreaterThan(400);
    unTex.dispose();

    // Multi-line text layout (e.g. Tibetan flag 'PAD\nME') renders both upper and lower lines cleanly.
    const padMe = rasterizeFontTextMask("cinzelBold", "PAD\nME", {
      width: 128,
      height: 128,
      supersample: 4,
    });
    let topHalfInk = 0;
    let botHalfInk = 0;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x++) topHalfInk += padMe.data[y * 128 + x]!;
    }
    for (let y = 64; y < 128; y++) {
      for (let x = 0; x < 128; x++) botHalfInk += padMe.data[y * 128 + x]!;
    }
    expect(topHalfInk).toBeGreaterThan(300);
    expect(botHalfInk).toBeGreaterThan(200);
  });

  it("handles Cinzel inscription 20*C+M+B+26 flat text layout with non-empty glyphs", () => {
    const flat = createTextFlatGeometry("cinzelBold", "20*C+M+B+26", {
      center: true,
      fitBox: [2.2, 0.24],
      maxEdgeLength: 0.02,
    });
    expect(flat.bounds.width).toBeGreaterThan(1.5);
    expect(flat.bounds.width).toBeLessThanOrEqual(2.201);
    expect(flat.bounds.height).toBeLessThanOrEqual(0.241);
    expect(flat.geometry.getIndex()!.count).toBeGreaterThan(600);
    flat.geometry.dispose();
  });
});
