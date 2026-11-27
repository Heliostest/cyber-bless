import { BlendFunction, Effect } from 'postprocessing';
import { Uniform, Vector4 } from 'three';
import curves from './komorebi/color-curves.json';

type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];

const KM_POSITIVE = curves.vCameraColorCurvePositive as Vec4;
const KM_NEUTRAL = curves.vCameraColorCurveNeutral as Vec4;
const KM_NEGATIVE = curves.vCameraColorCurveNegative as Vec4;

/** Daylight C1 asymptotic highlight shoulder parameters (identity for peak <= 0.90). */
export const KOMOREBI_DAYLIGHT_SHOULDER = {
  knee: 0.9,
  headroom: 0.13,
  desatStart: 1.15,
  desatEnd: 2.4,
  desatAmount: 0.12,
} as const;

/** Night Troy Sobotka AgX + subtle natural corner vignette parameters. */
export const KOMOREBI_NIGHT_AGX = {
  exposure: 1.15,
  minEv: -12.47393,
  maxEv: 4.026069,
  logFloor: 0.00012,
  punchPower: 1.16,
  punchSaturation: 1.24,
  vignetteStrength: 0.04,
  vignetteInner: 0.18,
  vignetteOuter: 0.5,
  kmStrength: 0.45,
} as const;

// Column-major AgX sRGB inset/outset matrices (Troy Sobotka / Benjamin Wrensch).
const AGX_INSET = [
  0.842479062253094, 0.0423282422610123, 0.0423756549057051,
  0.0784335999999992, 0.878468636469772, 0.0784336,
  0.0792237451477643, 0.0791661274605434, 0.879142973793104,
] as const;

const AGX_OUTSET = [
  1.19687900512017, -0.0528968517574562, -0.0529716355144438,
  -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
  -0.0990297440797205, -0.0989611768448433, 1.15107367264116,
] as const;

const DAYLIGHT_FRAGMENT = /* glsl */ `
  uniform vec4 kmPositive;
  uniform vec4 kmNeutral;
  uniform vec4 kmNegative;
  uniform float kmStrength;

  // Smooth C1 asymptotic highlight shoulder above 0.90 (asymptote 1.03 so 1.03 * 0.97 < 1.0).
  // Exact identity for peak <= 0.90 so calibrated Komorebi greens and ritual-optics paper stay untouched.
  vec3 kmDaylightShoulder(vec3 color) {
    vec3 c = max(color, vec3(0.0));
    float peak = max(c.r, max(c.g, c.b));
    if (peak > 0.90) {
      float excess = peak - 0.90;
      float target = 0.90 + 0.13 * excess / (excess + 0.13);
      c *= target / peak;
      float desat = 0.12 * smoothstep(1.15, 2.40, peak);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, vec3(l), desat);
    }
    return c;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 linearIn = kmDaylightShoulder(inputColor.rgb);
    vec3 exposed = clamp(pow(max(linearIn * 0.97, vec3(0.0)), vec3(1.0 / 2.2)), 0.0, 1.0);
    vec3 rgb = mix(exposed, exposed * exposed * (3.0 - 2.0 * exposed), 0.17);
    float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    vec2 weights = clamp(vec2(luma * 3.0 - 1.5, 1.5 - luma * 3.0), 0.0, 1.0);
    vec4 curve = kmNeutral + weights.x * kmPositive - weights.y * kmNegative;
    rgb = mix(vec3(luma), rgb * curve.rgb, curve.a);
    // The source writes display RGB; the host composer subsequently encodes
    // linear sRGB. Use its exact inverse, rather than a second gamma approximation.
    vec3 hostLinear = sRGBToLinear(vec4(max(rgb, vec3(0.0)), 1.0)).rgb;
    outputColor = vec4(mix(linearIn, hostLinear, kmStrength), inputColor.a);
  }
`;

const NIGHT_FRAGMENT = /* glsl */ `
  uniform vec4 kmPositive;
  uniform vec4 kmNeutral;
  uniform vec4 kmNegative;
  uniform float kmStrength;

  // Troy Sobotka's AgX filmic tone mapping (sRGB inset/outset + 6th-order polynomial),
  // gently tuned for moonlit navy stages and warm vermilion/amber/rose flames without ACES yellow-skew.
  vec3 kmAgx(vec3 color) {
    const mat3 inset = mat3(
      0.842479062253094, 0.0423282422610123, 0.0423756549057051,
      0.0784335999999992, 0.878468636469772, 0.0784336,
      0.0792237451477643, 0.0791661274605434, 0.879142973793104
    );
    const mat3 outset = mat3(
      1.19687900512017, -0.0528968517574562, -0.0529716355144438,
      -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
      -0.0990297440797205, -0.0989611768448433, 1.15107367264116
    );
    vec3 v = inset * max(color * 1.15, vec3(0.0));
    // Floor 0.00012 stays well above FP16 normal minimum (~6.1e-5) while still < 2^-12.47393 (~1.76e-4).
    v = clamp((log2(max(v, vec3(0.00012))) + 12.47393) / (4.026069 + 12.47393), 0.0, 1.0);
    vec3 x2 = v * v;
    vec3 x4 = x2 * x2;
    v = 15.5 * x4 * x2 - 40.14 * x4 * v + 31.96 * x4 - 6.868 * x2 * v + 0.4298 * x2 + 0.1191 * v - 0.00232;
    v = pow(max(v, vec3(0.0)), vec3(1.16));
    float l = dot(v, vec3(0.2126, 0.7152, 0.0722));
    v = mix(vec3(l), v, 1.24);
    return clamp(pow(max(outset * v, vec3(0.0)), vec3(2.2)), 0.0, 1.0);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 filmic = kmAgx(inputColor.rgb);
    vec3 exposed = clamp(pow(max(filmic * 0.97, vec3(0.0)), vec3(1.0 / 2.2)), 0.0, 1.0);
    vec3 rgb = mix(exposed, exposed * exposed * (3.0 - 2.0 * exposed), 0.17);
    float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    vec2 weights = clamp(vec2(luma * 3.0 - 1.5, 1.5 - luma * 3.0), 0.0, 1.0);
    vec4 curve = kmNeutral + weights.x * kmPositive - weights.y * kmNegative;
    rgb = mix(vec3(luma), rgb * curve.rgb, curve.a);
    vec3 hostLinear = sRGBToLinear(vec4(clamp(rgb, 0.0, 1.0), 1.0)).rgb;
    vec3 graded = mix(filmic, hostLinear, kmStrength);
    vec2 q = uv - 0.5;
    float vignette = 1.0 - 0.04 * smoothstep(0.18, 0.50, dot(q, q));
    outputColor = vec4(graded * vignette, inputColor.a);
  }
`;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function luma709(rgb: readonly [number, number, number]) {
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function srgbToLinearChannel(value: number) {
  return value <= 0.04045
    ? value * 0.0773993808
    : Math.pow(value * 0.9478672986 + 0.0521327014, 2.4);
}

function mulMat3Col(m: readonly number[], v: readonly [number, number, number]): Vec3 {
  return [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ];
}

function applyKomorebiCurves(linearIn: readonly [number, number, number], clampDisplay: boolean): Vec3 {
  const exposed: Vec3 = [
    clamp(Math.pow(Math.max(linearIn[0] * 0.97, 0), 1 / 2.2), 0, 1),
    clamp(Math.pow(Math.max(linearIn[1] * 0.97, 0), 1 / 2.2), 0, 1),
    clamp(Math.pow(Math.max(linearIn[2] * 0.97, 0), 1 / 2.2), 0, 1),
  ];
  const sCurved: Vec3 = [
    mix(exposed[0], exposed[0] * exposed[0] * (3 - 2 * exposed[0]), 0.17),
    mix(exposed[1], exposed[1] * exposed[1] * (3 - 2 * exposed[1]), 0.17),
    mix(exposed[2], exposed[2] * exposed[2] * (3 - 2 * exposed[2]), 0.17),
  ];
  const luma = luma709(sCurved);
  const wx = clamp(luma * 3 - 1.5, 0, 1);
  const wy = clamp(1.5 - luma * 3, 0, 1);
  const c0 = KM_NEUTRAL[0] + wx * KM_POSITIVE[0] - wy * KM_NEGATIVE[0];
  const c1 = KM_NEUTRAL[1] + wx * KM_POSITIVE[1] - wy * KM_NEGATIVE[1];
  const c2 = KM_NEUTRAL[2] + wx * KM_POSITIVE[2] - wy * KM_NEGATIVE[2];
  const ca = KM_NEUTRAL[3] + wx * KM_POSITIVE[3] - wy * KM_NEGATIVE[3];
  const rgb: Vec3 = [
    mix(luma, sCurved[0] * c0, ca),
    mix(luma, sCurved[1] * c1, ca),
    mix(luma, sCurved[2] * c2, ca),
  ];
  const prep = (ch: number) => (clampDisplay ? clamp(ch, 0, 1) : Math.max(ch, 0));
  return [
    srgbToLinearChannel(prep(rgb[0])),
    srgbToLinearChannel(prep(rgb[1])),
    srgbToLinearChannel(prep(rgb[2])),
  ];
}

/** CPU mirror of the daylight C1 highlight shoulder + Komorebi grade shader (linear -> linear). */
export function evaluateKomorebiDaylight(rgb: readonly [number, number, number]): Vec3 {
  const c: Vec3 = [Math.max(rgb[0], 0), Math.max(rgb[1], 0), Math.max(rgb[2], 0)];
  const peak = Math.max(c[0], c[1], c[2]);
  if (peak > KOMOREBI_DAYLIGHT_SHOULDER.knee) {
    const excess = peak - KOMOREBI_DAYLIGHT_SHOULDER.knee;
    const { knee, headroom, desatStart, desatEnd, desatAmount } = KOMOREBI_DAYLIGHT_SHOULDER;
    const target = knee + (headroom * excess) / (excess + headroom);
    const scale = target / peak;
    c[0] *= scale;
    c[1] *= scale;
    c[2] *= scale;
    const desat = desatAmount * smoothstep(desatStart, desatEnd, peak);
    const l = luma709(c);
    c[0] = mix(c[0], l, desat);
    c[1] = mix(c[1], l, desat);
    c[2] = mix(c[2], l, desat);
  }
  return applyKomorebiCurves(c, false);
}

/** CPU mirror of the night AgX filmic tone map + Komorebi night curve + corner vignette (linear -> linear). */
export function evaluateKomorebiNight(
  rgb: readonly [number, number, number],
  uv: readonly [number, number] = [0.5, 0.5],
): Vec3 {
  const {
    exposure, minEv, maxEv, logFloor, punchPower, punchSaturation,
    vignetteStrength, vignetteInner, vignetteOuter, kmStrength,
  } = KOMOREBI_NIGHT_AGX;
  const exposedIn: Vec3 = [
    Math.max(rgb[0] * exposure, 0),
    Math.max(rgb[1] * exposure, 0),
    Math.max(rgb[2] * exposure, 0),
  ];
  let v = mulMat3Col(AGX_INSET, exposedIn);
  const invEvRange = 1 / (maxEv - minEv);
  v = [
    clamp((Math.log2(Math.max(v[0], logFloor)) - minEv) * invEvRange, 0, 1),
    clamp((Math.log2(Math.max(v[1], logFloor)) - minEv) * invEvRange, 0, 1),
    clamp((Math.log2(Math.max(v[2], logFloor)) - minEv) * invEvRange, 0, 1),
  ];
  const poly = (x: number) => {
    const x2 = x * x;
    const x4 = x2 * x2;
    return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
  };
  v = [
    Math.pow(Math.max(poly(v[0]), 0), punchPower),
    Math.pow(Math.max(poly(v[1]), 0), punchPower),
    Math.pow(Math.max(poly(v[2]), 0), punchPower),
  ];
  const l = luma709(v);
  v = [
    mix(l, v[0], punchSaturation),
    mix(l, v[1], punchSaturation),
    mix(l, v[2], punchSaturation),
  ];
  v = mulMat3Col(AGX_OUTSET, v);
  const filmic: Vec3 = [
    clamp(Math.pow(Math.max(v[0], 0), 2.2), 0, 1),
    clamp(Math.pow(Math.max(v[1], 0), 2.2), 0, 1),
    clamp(Math.pow(Math.max(v[2], 0), 2.2), 0, 1),
  ];
  const hostLinear = applyKomorebiCurves(filmic, true);
  const qx = uv[0] - 0.5;
  const qy = uv[1] - 0.5;
  const vignette = 1 - vignetteStrength * smoothstep(vignetteInner, vignetteOuter, qx * qx + qy * qy);
  return [
    mix(filmic[0], hostLinear[0], kmStrength) * vignette,
    mix(filmic[1], hostLinear[1], kmStrength) * vignette,
    mix(filmic[2], hostLinear[2], kmStrength) * vignette,
  ];
}

/**
 * Source exposure, display conversion and curves.
 * - Daylight: skips ACES and adds a C1 asymptotic highlight shoulder above 0.90 (identity <= 0.90).
 * - Night: applies Troy Sobotka's AgX filmic tone map blended with Komorebi night curves and a subtle corner vignette.
 */
export function createKomorebiGrade(night = false) {
  return new Effect('KomorebiGrade', night ? NIGHT_FRAGMENT : DAYLIGHT_FRAGMENT, {
    blendFunction: BlendFunction.NORMAL,
    uniforms: new Map<string, Uniform>([
      ['kmPositive', new Uniform(new Vector4(...KM_POSITIVE))],
      ['kmNeutral', new Uniform(new Vector4(...KM_NEUTRAL))],
      ['kmNegative', new Uniform(new Vector4(...KM_NEGATIVE))],
      ['kmStrength', new Uniform(night ? KOMOREBI_NIGHT_AGX.kmStrength : 1)],
    ]),
  });
}
