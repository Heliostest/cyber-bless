import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlendFunction, BloomEffect, EffectPass, OutlineEffect } from "postprocessing";
import curves from "./komorebi/color-curves.json";
import {
  createKomorebiGrade,
  evaluateKomorebiDaylight,
  evaluateKomorebiNight,
  KOMOREBI_DAYLIGHT_SHOULDER,
  KOMOREBI_NIGHT_AGX,
} from "./komorebi-grade";
import { createRenderStyle } from "./render-style";

const hooks = vi.hoisted(() => ({
  passes: [] as any[],
  render: vi.fn(),
  dispose: vi.fn(),
  size: vi.fn(),
  composersCreated: 0,
  realEffectPass: undefined as typeof EffectPass | undefined,
}));

vi.mock("postprocessing", async importOriginal => {
  const original = await importOriginal<typeof import("postprocessing")>();
  hooks.realEffectPass = original.EffectPass;
  return {
    ...original,
    EffectComposer: class {
      constructor() {
        hooks.composersCreated++;
        hooks.passes = [];
      }
      addPass(pass: unknown) {
        hooks.passes.push(pass);
      }
      setSize = hooks.size;
      render = hooks.render;
      dispose() {
        hooks.dispose();
        for (const pass of hooks.passes) pass.dispose?.();
      }
    },
    EffectPass: class {
      effects: any[];
      constructor(_camera: unknown, ...effects: unknown[]) {
        this.effects = effects;
      }
      dispose() {
        this.effects.forEach(e => e.dispose());
      }
    },
  };
});

function setup() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const material = new THREE.MeshStandardMaterial({ color: "#b46137" });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  scene.add(mesh);
  const target = new THREE.WebGLRenderTarget(64, 64);
  const renderer = {
    getSize: (value: THREE.Vector2) => value.set(346, 332),
    getPixelRatio: () => 2,
    getRenderTarget: () => target,
    setRenderTarget: vi.fn(),
    getClearColor: (value: THREE.Color) => value.set("#182433"),
    getClearAlpha: () => 1,
    setClearColor: vi.fn(),
    autoClear: true,
    toneMapping: THREE.ACESFilmicToneMapping,
    debug: { onShaderError: undefined },
    shadowMap: { enabled: true, autoUpdate: true, type: THREE.PCFShadowMap },
    render: vi.fn(),
  } as unknown as THREE.WebGLRenderer;
  return { style: createRenderStyle(renderer, scene, camera), renderer, material, mesh, scene, camera, target };
}

function legacyKomorebiDaylight(rgb: readonly [number, number, number]): [number, number, number] {
  const pos = curves.vCameraColorCurvePositive;
  const neu = curves.vCameraColorCurveNeutral;
  const neg = curves.vCameraColorCurveNegative;
  const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const exposed = rgb.map(v => clamp(Math.pow(Math.max(v * 0.97, 0), 1 / 2.2), 0, 1));
  const s = exposed.map(e => mix(e, e * e * (3 - 2 * e), 0.17));
  const luma = s[0] * 0.2126 + s[1] * 0.7152 + s[2] * 0.0722;
  const wx = clamp(luma * 3 - 1.5, 0, 1);
  const wy = clamp(1.5 - luma * 3, 0, 1);
  const curve = [0, 1, 2, 3].map(i => neu[i] + wx * pos[i] - wy * neg[i]);
  const graded = s.map((ch, i) => Math.max(mix(luma, ch * curve[i], curve[3]), 0));
  return graded.map(v =>
    v <= 0.04045 ? v * 0.0773993808 : Math.pow(v * 0.9478672986 + 0.0521327014, 2.4),
  ) as [number, number, number];
}

function acesFilmic(rgb: readonly [number, number, number]): [number, number, number] {
  const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
  const mul = (m: readonly number[], v: readonly number[]) => [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ];
  const inputMat = [0.59719, 0.076, 0.0284, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777];
  const outputMat = [1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602];
  const scaled = rgb.map(v => v / 0.6);
  const a = mul(inputMat, scaled).map(
    x => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.432951) + 0.238081),
  );
  return mul(outputMat, a).map(v => clamp(v, 0, 1)) as [number, number, number];
}

function linearToSRGB(c: readonly [number, number, number]): [number, number, number] {
  return c.map(v => {
    const x = Math.min(1, Math.max(0, v));
    return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  }) as [number, number, number];
}

function hasInvalidPreprocessorLine(glsl: string) {
  return glsl
    .split("\n")
    .some(line => !/^\s*\/\//.test(line) && /\S.*#/.test(line));
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.passes = [];
  hooks.composersCreated = 0;
  hooks.render.mockReset();
});

describe("KomorebiGrade GLSL & EffectPass compilation", () => {
  it("compiles daylight KomorebiGrade cleanly with C1 highlight shoulder at 0.90 and zero invalid preprocessor lines", () => {
    const grade = createKomorebiGrade(false);
    const shader = grade.getFragmentShader();
    expect(grade.name).toBe("KomorebiGrade");
    expect(hasInvalidPreprocessorLine(shader)).toBe(false);
    expect(shader).not.toContain("undefined");
    expect(shader).not.toContain("NaN");
    expect(shader).toContain("kmDaylightShoulder");
    expect(shader).toContain("0.90");
    expect(shader).toContain("0.13");
    expect(shader).toContain("smoothstep(1.15, 2.40, peak)");
    expect(grade.uniforms.get("kmStrength")?.value).toBe(1);

    // Also verify real postprocessing EffectPass merging with BloomEffect + OutlineEffect compiles cleanly.
    const RealEffectPass = hooks.realEffectPass!;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const bloom = new BloomEffect({ blendFunction: BlendFunction.ADD, mipmapBlur: true, luminanceThreshold: 1.01, luminanceSmoothing: 0.2, intensity: 0.16, levels: 4, radius: 0.62 });
    const outline = new OutlineEffect(scene, camera, { blendFunction: BlendFunction.ALPHA });
    const pass = new RealEffectPass(camera, bloom, grade, outline);
    pass.recompile();
    const compiled = pass.fullscreenMaterial.fragmentShader;
    expect(hasInvalidPreprocessorLine(compiled)).toBe(false);
    expect(compiled).not.toContain("undefined");
    expect(compiled).not.toContain("NaN");
    expect(compiled).toContain("e0MainImage");
    expect(compiled).toContain("e1MainImage");
    expect(compiled).toContain("e2MainImage");
    pass.dispose();
  });

  it("compiles night KomorebiGrade cleanly with Troy Sobotka AgX matrices, 6th-order polynomial, FP16-safe log floor, and subtle corner vignette", () => {
    const grade = createKomorebiGrade(true);
    const shader = grade.getFragmentShader();
    expect(grade.name).toBe("KomorebiGrade");
    expect(hasInvalidPreprocessorLine(shader)).toBe(false);
    expect(shader).not.toContain("undefined");
    expect(shader).not.toContain("NaN");
    expect(shader).toContain("kmAgx");
    expect(shader).toContain("0.842479062253094");
    expect(shader).toContain("1.19687900512017");
    expect(shader).toContain("15.5 * x4 * x2 - 40.14 * x4 * v + 31.96 * x4");
    expect(shader).toContain("0.00012");
    expect(shader).toContain("0.04 * smoothstep(0.18, 0.50");
    expect(grade.uniforms.get("kmStrength")?.value).toBeCloseTo(KOMOREBI_NIGHT_AGX.kmStrength, 6);

    const RealEffectPass = hooks.realEffectPass!;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const bloom = new BloomEffect({ blendFunction: BlendFunction.ADD, mipmapBlur: true, luminanceThreshold: 0.78, luminanceSmoothing: 0.26, intensity: 0.44, levels: 4, radius: 0.68 });
    const outline = new OutlineEffect(scene, camera, { blendFunction: BlendFunction.ALPHA });
    const pass = new RealEffectPass(camera, bloom, grade, outline);
    pass.recompile();
    const compiled = pass.fullscreenMaterial.fragmentShader;
    expect(hasInvalidPreprocessorLine(compiled)).toBe(false);
    expect(compiled).not.toContain("undefined");
    expect(compiled).not.toContain("NaN");
    pass.dispose();
  });
});

describe("Komorebi daylight C1 highlight shoulder & night AgX color math", () => {
  it("preserves calibrated daylight values in [0, 0.90] identically within 1e-6", () => {
    const samples: [number, number, number][] = [
      [0, 0, 0],
      [0.12, 0.44, 0.16], // Komorebi meadow grass
      [0.48, 0.45, 0.41], // Komorebi stone path
      [0.35, 0.56, 0.82], // Komorebi daylight sky
      [0.82, 0.79, 0.73], // Sunlit ritual-optics sheet paper midtone
      [0.9, 0.87, 0.82],  // Exact knee boundary
    ];
    for (const sample of samples) {
      const expected = legacyKomorebiDaylight(sample);
      const actual = evaluateKomorebiDaylight(sample);
      for (let ch = 0; ch < 3; ch++) {
        expect(Math.abs(actual[ch] - expected[ch])).toBeLessThan(1e-6);
      }
    }
  });

  it("rolls off daylight HDR highlights (1.5, 2.5, 4.0) smoothly below 1.0 with C1 continuity instead of flat-clipping", () => {
    // Verify C1 continuity of the shoulder itself at knee = 0.90
    const { knee, headroom } = KOMOREBI_DAYLIGHT_SHOULDER;
    const eps = 1e-5;
    const shoulder = (p: number) => (p <= knee ? p : knee + (headroom * (p - knee)) / (p - knee + headroom));
    const slopeBelow = (shoulder(knee) - shoulder(knee - eps)) / eps;
    const slopeAbove = (shoulder(knee + eps) - shoulder(knee)) / eps;
    expect(slopeBelow).toBeCloseTo(1, 4);
    expect(slopeAbove).toBeCloseTo(1, 3);
    expect((knee + headroom) * 0.97).toBeLessThan(1);

    const ceramic = evaluateKomorebiDaylight([1.5, 1.45, 1.35]);
    const brass = evaluateKomorebiDaylight([2.5, 1.9, 0.7]);
    const glint = evaluateKomorebiDaylight([4.0, 3.8, 3.5]);

    for (const out of [ceramic, brass, glint]) {
      for (const ch of out) {
        expect(Number.isFinite(ch)).toBe(true);
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThan(1);
      }
    }

    // Unlike legacy hard clipping (where 1.5 and 4.0 both collapse to identical clipped white),
    // monotonic roll-off preserves specular separation.
    expect(glint[0]).toBeGreaterThan(ceramic[0]);
    // Brass keeps rich gold hue separation instead of clipping R & G both to 1.0.
    expect(brass[0]).toBeGreaterThan(brass[1]);
    expect(brass[1]).toBeGreaterThan(brass[2]);
    expect(brass[0] - brass[1]).toBeGreaterThan(0.15);
  });

  it("preserves warm vermilion-amber and crimson-rose hues under night AgX without ACES yellow collapse", () => {
    const vermilionHdr: [number, number, number] = [2.4, 0.85, 0.25];
    const agxLinear = evaluateKomorebiNight(vermilionHdr, [0.5, 0.5]);
    const agxSRGB = linearToSRGB(agxLinear);
    const acesSRGB = linearToSRGB(acesFilmic(vermilionHdr));

    // Warm orange-red ordering strictly preserved in both linear and display sRGB
    expect(agxLinear[0]).toBeGreaterThan(agxLinear[1]);
    expect(agxLinear[1]).toBeGreaterThan(agxLinear[2]);
    expect(agxSRGB[0]).toBeGreaterThan(agxSRGB[1]);
    expect(agxSRGB[1]).toBeGreaterThan(agxSRGB[2]);

    // No neon-yellow G ≈ R collapse: AgX preserves much stronger R-G warmth than ACES
    expect(agxSRGB[0] - agxSRGB[1]).toBeGreaterThan(0.15);
    expect(agxSRGB[0] - agxSRGB[1]).toBeGreaterThan(acesSRGB[0] - acesSRGB[1] + 0.05);

    // Crimson-rose lotus lantern stays luminous rose-red
    const crimson = linearToSRGB(evaluateKomorebiNight([2.2, 0.45, 0.55], [0.5, 0.5]));
    expect(crimson[0]).toBeGreaterThan(crimson[2]);
    expect(crimson[0] - crimson[1]).toBeGreaterThan(0.25);

    // Zero black stays clean zero; neutrals remain neutral; 18% gray stays anchored
    expect(evaluateKomorebiNight([0, 0, 0], [0.5, 0.5])).toEqual([0, 0, 0]);
    const gray18 = evaluateKomorebiNight([0.18, 0.18, 0.18], [0.5, 0.5]);
    expect(gray18[0]).toBeGreaterThan(0.14);
    expect(gray18[0]).toBeLessThan(0.23);
    expect(Math.abs(gray18[0] - gray18[1])).toBeLessThan(0.01);

    // Subtle ~4% natural corner vignette depth: center untouched, extreme corners 0.96x
    const center = evaluateKomorebiNight([0.5, 0.4, 0.3], [0.5, 0.5]);
    const corner = evaluateKomorebiNight([0.5, 0.4, 0.3], [0.0, 0.0]);
    expect(corner[0] / center[0]).toBeCloseTo(0.96, 4);
    expect(corner[1] / center[1]).toBeCloseTo(0.96, 4);
    expect(corner[2] / center[2]).toBeCloseTo(0.96, 4);
  });
});

describe("createRenderStyle selective HDR Bloom, day/night rebuild & adaptive governor", () => {
  it("attaches BloomEffect with paper-safe daylight threshold (> 1.0) and warm night threshold (< 0.85) before tone/grade and outlines", () => {
    const { style, scene } = setup();
    style.setStyle("toon-soft");
    style.setEnvironmentTone("komorebi");
    scene.userData.environmentNight = false;
    style.render();

    const dayEffects = hooks.passes.flatMap(pass => pass.effects ?? []);
    const dayBloomIndex = dayEffects.findIndex(e => e.name === "BloomEffect");
    const dayGradeIndex = dayEffects.findIndex(e => e.name === "KomorebiGrade");
    const dayOutlineIndex = dayEffects.findIndex(e => e.name === "OutlineEffect");
    expect(dayBloomIndex).toBeGreaterThanOrEqual(0);
    expect(dayGradeIndex).toBeGreaterThan(dayBloomIndex);
    expect(dayOutlineIndex).toBeGreaterThan(dayGradeIndex);
    expect(dayEffects.some(e => e.name === "ToneMappingEffect")).toBe(false);

    const dayBloom = dayEffects[dayBloomIndex] as BloomEffect;
    expect(dayBloom.mipmapBlurPass.enabled).toBe(true);
    expect(dayBloom.blendMode.blendFunction).toBe(BlendFunction.ADD);
    // Critical paper guard: ritual-optics sheet paper ceiling is <= 0.99 linear.
    expect(dayBloom.luminanceMaterial.threshold).toBeGreaterThan(1.0);
    expect(dayBloom.luminanceMaterial.threshold).toBeCloseTo(1.01, 4);
    expect(dayBloom.luminanceMaterial.smoothing).toBeCloseTo(0.20, 4);
    expect(dayBloom.intensity).toBeCloseTo(0.16, 4);
    expect(dayBloom.mipmapBlurPass.levels).toBe(4);
    expect(dayBloom.mipmapBlurPass.radius).toBeCloseTo(0.62, 4);

    // Flip scene to night: must release old composer/bloom and rebuild cleanly with night AgX + night Bloom.
    const dayBloomDispose = vi.spyOn(dayBloom, "dispose");
    scene.userData.environmentNight = true;
    style.render();

    expect(hooks.composersCreated).toBe(2);
    expect(hooks.dispose).toHaveBeenCalledTimes(1);
    expect(dayBloomDispose).toHaveBeenCalled();

    const nightEffects = hooks.passes.flatMap(pass => pass.effects ?? []);
    const nightBloomIndex = nightEffects.findIndex(e => e.name === "BloomEffect");
    const nightGradeIndex = nightEffects.findIndex(e => e.name === "KomorebiGrade");
    const nightOutlineIndex = nightEffects.findIndex(e => e.name === "OutlineEffect");
    expect(nightBloomIndex).toBeGreaterThanOrEqual(0);
    expect(nightGradeIndex).toBeGreaterThan(nightBloomIndex);
    expect(nightOutlineIndex).toBeGreaterThan(nightGradeIndex);
    // Komorebi night uses AgX inside KomorebiGrade instead of ACES ToneMappingEffect.
    expect(nightEffects.some(e => e.name === "ToneMappingEffect")).toBe(false);
    expect(nightEffects[nightGradeIndex].getFragmentShader()).toContain("kmAgx");

    const nightBloom = nightEffects[nightBloomIndex] as BloomEffect;
    expect(nightBloom.mipmapBlurPass.enabled).toBe(true);
    expect(nightBloom.luminanceMaterial.threshold).toBeLessThan(0.85);
    expect(nightBloom.luminanceMaterial.threshold).toBeCloseTo(0.78, 4);
    expect(nightBloom.luminanceMaterial.smoothing).toBeCloseTo(0.26, 4);
    expect(nightBloom.intensity).toBeCloseTo(0.44, 4);
    expect(nightBloom.mipmapBlurPass.levels).toBe(4);
    expect(nightBloom.mipmapBlurPass.radius).toBeCloseTo(0.68, 4);

    // Flip back to day and dispose cleanly without leaks
    const nightBloomDispose = vi.spyOn(nightBloom, "dispose");
    scene.userData.environmentNight = false;
    style.render();
    expect(hooks.composersCreated).toBe(3);
    expect(nightBloomDispose).toHaveBeenCalled();

    const finalBloom = hooks.passes.flatMap(p => p.effects ?? []).find(e => e.name === "BloomEffect") as BloomEffect;
    const finalBloomDispose = vi.spyOn(finalBloom, "dispose");
    style.dispose();
    expect(finalBloomDispose).toHaveBeenCalled();
    expect(hooks.dispose).toHaveBeenCalledTimes(3);
  });

  it("places Bloom before tone/grade for original(komorebi), gouache, toon-outline, and toon-ink, and omits it for pixel-art, halftone, moebius, and gallery styles", () => {
    const { style } = setup();
    style.setEnvironmentTone("komorebi");

    for (const styleId of ["original", "toon-soft", "gouache", "toon-outline", "toon-ink"] as const) {
      style.setStyle(styleId);
      style.render();
      const effects = hooks.passes.flatMap(p => p.effects ?? []);
      const bloomIdx = effects.findIndex(e => e.name === "BloomEffect");
      const gradeIdx = effects.findIndex(e => e.name === "KomorebiGrade");
      expect(bloomIdx, `${styleId} should attach BloomEffect`).toBeGreaterThanOrEqual(0);
      expect(gradeIdx, `${styleId} should run KomorebiGrade after Bloom`).toBeGreaterThan(bloomIdx);
      if (styleId === "gouache") {
        // Gouache brush and outline stay in a separate pass AFTER bloom + grade
        expect(hooks.passes.length).toBeGreaterThanOrEqual(3);
        const brushPass = hooks.passes.find(p => (p.effects ?? []).some((e: any) => e.name === "Gouache"));
        expect(brushPass.effects.map((e: any) => e.name)).toEqual(["Gouache", "OutlineEffect"]);
      }
    }

    for (const styleId of ["pixel-art", "halftone", "moebius", "sketch-contour", "depth-rim"] as const) {
      style.setStyle(styleId as never);
      style.render();
      const effects = hooks.passes.flatMap(p => p.effects ?? []);
      expect(effects.some(e => e.name === "BloomEffect"), `${styleId} should not attach BloomEffect`).toBe(false);
    }

    // Non-komorebi comparison mode keeps ToneMappingEffect (ACES) after Bloom and before Outline.
    style.setEnvironmentTone("tiny-delivery");
    style.setStyle("toon-soft");
    style.render();
    const deliveryEffects = hooks.passes.flatMap(p => p.effects ?? []);
    const bIdx = deliveryEffects.findIndex(e => e.name === "BloomEffect");
    const tIdx = deliveryEffects.findIndex(e => e.name === "ToneMappingEffect");
    const oIdx = deliveryEffects.findIndex(e => e.name === "OutlineEffect");
    expect(bIdx).toBeGreaterThanOrEqual(0);
    expect(tIdx).toBeGreaterThan(bIdx);
    expect(oIdx).toBeGreaterThan(tIdx);
    style.dispose();
  });

  it("governs Bloom intensity under sustained slow frames (>25ms), recovers with hysteresis (<17ms), and keeps single-frame/capture gaps at 100%", () => {
    let now = 1000;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    const { style, scene } = setup();
    try {
      style.setStyle("toon-soft");
      style.setEnvironmentTone("komorebi");
      scene.userData.environmentNight = true;

      // Single-frame render gets 100% full quality
      style.render();
      const bloom = hooks.passes.flatMap(p => p.effects ?? []).find(e => e.name === "BloomEffect") as BloomEffect;
      expect(bloom.intensity).toBeCloseTo(0.44, 5);

      // Large idle / shader-compile / screenshot capture gaps (> 120ms) never trigger downgrade
      for (let i = 0; i < 30; i++) {
        now += 250;
        style.render();
      }
      expect(bloom.intensity).toBeCloseTo(0.44, 5);

      // 24 consecutive active slow frames (30ms each) start smoothly scaling bloom down to 0
      for (let i = 0; i < 24; i++) {
        now += 30;
        style.render();
      }
      expect(bloom.intensity).toBeLessThan(0.44);
      for (let i = 0; i < 12; i++) {
        now += 30;
        style.render();
      }
      expect(bloom.intensity).toBe(0);

      // Verify GPU luminance + mipmap passes are bypassed when intensity hits 0
      const lumSpy = vi.spyOn(bloom.luminancePass, "render");
      const mipSpy = vi.spyOn(bloom.mipmapBlurPass, "render");
      bloom.update({} as any, {} as any, 0.03);
      expect(lumSpy).not.toHaveBeenCalled();
      expect(mipSpy).not.toHaveBeenCalled();

      // Recovery: 15ms frames do NOT bounce immediately (hysteresis waits for EMA < 17 + 45 frames)
      for (let i = 0; i < 30; i++) {
        now += 15;
        style.render();
      }
      expect(bloom.intensity).toBe(0);

      // After sustained smooth frames (EMA settle + 45 frames + ramp), full intensity returns
      for (let i = 0; i < 40; i++) {
        now += 15;
        style.render();
      }
      expect(bloom.intensity).toBeCloseTo(0.44, 5);

      // Even if downgraded again, a > 120ms capture gap immediately restores 100% full-quality Bloom
      for (let i = 0; i < 40; i++) {
        now += 32;
        style.render();
      }
      expect(bloom.intensity).toBe(0);
      now += 180;
      style.render();
      expect(bloom.intensity).toBeCloseTo(0.44, 5);
    } finally {
      style.dispose();
      clock.mockRestore();
    }
  });
});
