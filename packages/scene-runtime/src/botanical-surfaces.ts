import * as THREE from 'three';

export type BotanicalSurfaceKind = 'petal' | 'leaf' | 'bud' | 'grain' | 'peel';
export type BotanicalLeafVenation = 'pinnate' | 'parallel' | 'needle';
export type BotanicalPeelKind = 'citrus' | 'pome' | 'berry' | 'rind';
export type BotanicalCoordSpace = 'uv' | 'local';
export type BotanicalAxis = 'x' | 'y' | 'z';

export interface BotanicalSurfaceOptions {
  kind: BotanicalSurfaceKind;
  /** Overall surface modulation strength (0..1). Defaults: petal 0.45, leaf 0.42, bud/grain 0.45, peel 0.40. */
  strength?: number;
  /** Pattern frequency scale (0.1..8). Default 1. */
  scale?: number;
  /** Coordinate source: authored UV (`u` width, `v` base->tip) or local coordinates. */
  coord?: BotanicalCoordSpace;
  /** Primary base->tip axis in geometry-local coordinates when `coord === 'local'`. Default 'y'. */
  axis?: BotanicalAxis;
  /** Local-space `[base, tip]` bounds along `axis` when using local coordinates. */
  axialRange?: readonly [number, number];
  /** Deterministic static seed (never world-position dependent, so dragged meshes never swim). Default 0. */
  seed?: number;

  // --- Petal options ---
  /** Optional throat/base tint (`v = 0`). When omitted, auto-warms base pigment toward a warm heart. */
  throatColor?: THREE.ColorRepresentation;
  /** Optional mid-blade tint (`v = 0.5`) for a 3-color petal gradient. */
  midColor?: THREE.ColorRepresentation;
  /** Optional tip tint (`v = 1`). When omitted, auto-brightens softly toward a cream-luminous tip. */
  tipColor?: THREE.ColorRepresentation;
  /** Number of faint radial velvet veins across petal width (3..12). Default 6. */
  veinCount?: number;

  // --- Leaf options ---
  /** Leaf venation pattern (`pinnate`, `parallel`, or `needle`). Default 'pinnate'. */
  venation?: BotanicalLeafVenation;
  /** Optional vein / midrib tint (defaults to pale warm yellow-green derived from base pigment). */
  veinColor?: THREE.ColorRepresentation;
  /** Optional base-sheath / shadow tint (`v = 0`). */
  baseColor?: THREE.ColorRepresentation;
  /** Fold-ridge brightening strength for folded parallel leaves (0..1). Default 0.35 on parallel, 0 otherwise. */
  foldRidge?: number;
  /** Soften wrapped direct diffuse on needle clusters so faceted cones do not turn dead-black. Default true for needle. */
  softenClusterNormals?: boolean;

  // --- Bud / Grain options (InstancedMesh-friendly) ---
  /** Calyx/base tint for `bud` (default soft calyx yellow-green) or hull base tint for `grain`. */
  calyxColor?: THREE.ColorRepresentation;
  /** Belly/tip tint for `bud` (default pearly ivory) or sun-ripened golden belly for `grain`. */
  bellyColor?: THREE.ColorRepresentation;
  /** Per-instance hue/warmth variation from `instanceMatrix` (0..0.12). Default 0.035 (±3.5%). */
  instanceVariation?: number;

  // --- Peel options (ready for Wave 2 fruit scenes) ---
  /** Fruit peel micro-surface style (`citrus`, `pome`, `berry`, or `rind`). Default 'citrus'. */
  peel?: BotanicalPeelKind;
  /** Optional sunlit shoulder tint (`v = 1`). */
  blushColor?: THREE.ColorRepresentation;
  /** Optional base/stem-end tint (`v = 0`). */
  underColor?: THREE.ColorRepresentation;
}

interface NormalizedBotanicalSurface {
  kind: BotanicalSurfaceKind;
  strength: number;
  scale: number;
  coord: BotanicalCoordSpace;
  axis: BotanicalAxis;
  axialRange: [number, number];
  seed: number;
  venation: BotanicalLeafVenation;
  peel: BotanicalPeelKind;
  veinCount: number;
  foldRidge: number;
  softenClusterNormals: boolean;
  instanceVariation: number;
  throatColor?: THREE.Color;
  midColor?: THREE.Color;
  tipColor?: THREE.Color;
  veinColor?: THREE.Color;
  baseColor?: THREE.Color;
  calyxColor?: THREE.Color;
  bellyColor?: THREE.Color;
  blushColor?: THREE.Color;
  underColor?: THREE.Color;
}

const surfaces = new WeakMap<THREE.Material, NormalizedBotanicalSurface>();

function bounded(value: number | undefined, fallback: number, min: number, max: number): number {
  return Number.isFinite(value) ? THREE.MathUtils.clamp(value!, min, max) : fallback;
}

function optionalColor(value: THREE.ColorRepresentation | undefined): THREE.Color | undefined {
  return value === undefined ? undefined : new THREE.Color(value);
}

function cloneSurface(s: NormalizedBotanicalSurface): NormalizedBotanicalSurface {
  return {
    ...s,
    axialRange: [s.axialRange[0], s.axialRange[1]],
    throatColor: s.throatColor?.clone(),
    midColor: s.midColor?.clone(),
    tipColor: s.tipColor?.clone(),
    veinColor: s.veinColor?.clone(),
    baseColor: s.baseColor?.clone(),
    calyxColor: s.calyxColor?.clone(),
    bellyColor: s.bellyColor?.clone(),
    blushColor: s.blushColor?.clone(),
    underColor: s.underColor?.clone(),
  };
}

function defaultStrength(kind: BotanicalSurfaceKind): number {
  if (kind === 'petal') return 0.45;
  if (kind === 'leaf') return 0.42;
  if (kind === 'bud' || kind === 'grain') return 0.45;
  return 0.40;
}

function defaultRoughness(options: BotanicalSurfaceOptions): number {
  if (options.kind === 'petal') return 0.86;
  if (options.kind === 'leaf') {
    const v = options.venation ?? 'pinnate';
    return v === 'parallel' ? 0.54 : v === 'needle' ? 0.78 : 0.68;
  }
  if (options.kind === 'bud') return 0.84;
  if (options.kind === 'grain') return 0.74;
  const p = options.peel ?? 'citrus';
  return p === 'pome' ? 0.48 : p === 'berry' ? 0.52 : p === 'rind' ? 0.64 : 0.56;
}

function normalizeOptions(options: BotanicalSurfaceOptions): NormalizedBotanicalSurface {
  const kind = options.kind;
  const venation: BotanicalLeafVenation =
    options.venation === 'parallel' || options.venation === 'needle' ? options.venation : 'pinnate';
  const peel: BotanicalPeelKind =
    options.peel === 'pome' || options.peel === 'berry' || options.peel === 'rind' ? options.peel : 'citrus';
  const defaultCoord: BotanicalCoordSpace =
    kind === 'petal' || (kind === 'leaf' && venation !== 'needle') ? 'uv' : 'local';
  const coord: BotanicalCoordSpace = options.coord === 'uv' || options.coord === 'local' ? options.coord : defaultCoord;
  const axis: BotanicalAxis = options.axis === 'x' || options.axis === 'z' ? options.axis : 'y';
  const defaultRange: [number, number] =
    kind === 'petal' || (kind === 'leaf' && venation !== 'needle') ? [0, 1] : [-0.5, 0.5];
  const r0 = options.axialRange && Number.isFinite(options.axialRange[0]) ? options.axialRange[0] : defaultRange[0];
  const r1 = options.axialRange && Number.isFinite(options.axialRange[1]) ? options.axialRange[1] : defaultRange[1];
  const axialRange: [number, number] = Math.abs(r1 - r0) > 1e-5 ? [r0, r1] : defaultRange;

  return {
    kind,
    strength: bounded(options.strength, defaultStrength(kind), 0, 1),
    scale: bounded(options.scale, 1, 0.1, 8),
    coord,
    axis,
    axialRange,
    seed: Number.isFinite(options.seed) ? options.seed! : 0,
    venation,
    peel,
    veinCount: Math.round(bounded(options.veinCount, 6, 3, 12)),
    foldRidge: bounded(options.foldRidge, kind === 'leaf' && venation === 'parallel' ? 0.35 : 0, 0, 1),
    softenClusterNormals: options.softenClusterNormals ?? (kind === 'leaf' && venation === 'needle'),
    instanceVariation: bounded(options.instanceVariation, 0.035, 0, 0.12),
    throatColor: optionalColor(options.throatColor),
    midColor: optionalColor(options.midColor),
    tipColor: optionalColor(options.tipColor),
    veinColor: optionalColor(options.veinColor),
    baseColor: optionalColor(options.baseColor),
    calyxColor: optionalColor(options.calyxColor),
    bellyColor: optionalColor(options.bellyColor),
    blushColor: optionalColor(options.blushColor),
    underColor: optionalColor(options.underColor),
  };
}

// Single-pass procedural botanical primitives. Zero external textures, zero DOM/Canvas2D.
// Filtered waves use analytic fwidth Gaussian AA so small cards converge cleanly to zero mean;
// height evaluation calls only raw derivative-free primitives to avoid undefined higher derivatives.
const BOTANICAL_HEADER = `
uniform float botanicalStrength;
uniform float botanicalScale;
uniform vec2 botanicalAxialRange;
uniform float botanicalInstVariation;
float botanicalHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float botanicalNoise(vec3 p) {
  vec3 cell = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(botanicalHash(cell), botanicalHash(cell + vec3(1.0, 0.0, 0.0)), f.x),
        mix(botanicalHash(cell + vec3(0.0, 1.0, 0.0)), botanicalHash(cell + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(botanicalHash(cell + vec3(0.0, 0.0, 1.0)), botanicalHash(cell + vec3(1.0, 0.0, 1.0)), f.x),
        mix(botanicalHash(cell + vec3(0.0, 1.0, 1.0)), botanicalHash(cell + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z
  );
}
float botanicalRawNoise(vec3 p) { return botanicalNoise(p) - 0.5; }
float botanicalFineNoise(vec3 p) {
  float footprint = max(length(dFdx(p)), length(dFdy(p)));
  return (botanicalNoise(p) - 0.5) * (1.0 - smoothstep(0.5, 1.7, footprint));
}
float botanicalWave(float phase) {
  float f = fwidth(phase);
  return sin(phase) * exp(-0.42 * f * f);
}
float botanicalCos(float phase) {
  float f = fwidth(phase);
  return cos(phase) * exp(-0.42 * f * f);
}
vec3 botanicalReliefNormal(vec3 baseNormal, vec3 surfacePosition, float height, float visibility) {
  vec3 dx = dFdx(surfacePosition), dy = dFdy(surfacePosition);
  vec2 heightGradient = vec2(dFdx(height), dFdy(height));
  vec3 acrossX = cross(dy, baseNormal), acrossY = cross(baseNormal, dx);
  float determinant = dot(dx, acrossX);
  if (abs(determinant) < 1e-10) return baseNormal;
  vec3 gradient = sign(determinant) * (heightGradient.x * acrossX + heightGradient.y * acrossY);
  return normalize(abs(determinant) * baseNormal - gradient * visibility);
}
`;

// Injected right before void main(), after Three's normal_pars_fragment declares vNormal.
const BERRY_GRAZING_HELPER = `
float botanicalGrazing(const in vec3 viewPos) {
#ifdef FLAT_SHADED
  vec3 gn = normalize(cross(dFdx(-viewPos), dFdy(-viewPos)));
#else
  vec3 gn = normalize(vNormal);
#endif
  return clamp(1.0 - abs(dot(gn, normalize(viewPos))), 0.0, 1.0);
}
`;

function axisSwizzle(axis: BotanicalAxis): string {
  return axis === 'y' ? 'botanicalLocalPosition.yxz' : axis === 'z' ? 'botanicalLocalPosition.zxy' : 'botanicalLocalPosition';
}

function coordHelper(surface: NormalizedBotanicalSurface): string {
  const swiz = axisSwizzle(surface.axis);
  if (surface.coord === 'uv') {
    return `
vec2 botanicalCoords() {
  return clamp(botanicalUv, vec2(0.0), vec2(1.0));
}
vec3 botanicalAlignedPos() {
  return ${swiz};
}
`;
  }
  return `
vec3 botanicalAlignedPos() {
  return ${swiz};
}
vec2 botanicalCoords() {
  vec3 ap = botanicalAlignedPos();
  float span = max(botanicalAxialRange.y - botanicalAxialRange.x, 0.0001);
  float v = clamp((ap.x - botanicalAxialRange.x) / span, 0.0, 1.0);
  float u = clamp(ap.y / (span * 0.65) + 0.5, 0.0, 1.0);
  return vec2(u, v);
}
`;
}

function buildModeShaders(surface: NormalizedBotanicalSurface) {
  const uniforms: Record<string, THREE.IUniform> = {
    botanicalStrength: { value: surface.strength },
    botanicalScale: { value: surface.scale },
    botanicalAxialRange: { value: new THREE.Vector2(surface.axialRange[0], surface.axialRange[1]) },
    botanicalSeed: { value: surface.seed },
    botanicalInstVariation: { value: surface.instanceVariation },
  };

  let extraUniformDecl = '';
  let heightFn = 'float botanicalHeight() { return 0.0; }';
  let colorPatch = '';
  let roughnessPatch = '';
  let relief = 0.00032;
  let frequency = 28.0;
  const useUvFootprint = surface.coord === 'uv';

  if (surface.kind === 'petal') {
    uniforms.botanicalVeinCount = { value: surface.veinCount };
    extraUniformDecl += 'uniform float botanicalVeinCount;\n';
    if (surface.throatColor) {
      uniforms.botanicalThroatColor = { value: surface.throatColor.clone() };
      extraUniformDecl += 'uniform vec3 botanicalThroatColor;\n';
    }
    if (surface.midColor) {
      uniforms.botanicalMidColor = { value: surface.midColor.clone() };
      extraUniformDecl += 'uniform vec3 botanicalMidColor;\n';
    }
    if (surface.tipColor) {
      uniforms.botanicalTipColor = { value: surface.tipColor.clone() };
      extraUniformDecl += 'uniform vec3 botanicalTipColor;\n';
    }
    relief = 0.00028;
    frequency = surface.veinCount * Math.PI * 2.0;
    heightFn = `
float botanicalHeight() {
  vec2 uv = botanicalCoords();
  float lat = (uv.x - 0.5) * 2.0;
  float fan = lat / (0.42 + 0.58 * uv.y) * botanicalVeinCount * 3.14159265 * botanicalScale;
  float env = smoothstep(0.04, 0.22, uv.y) * smoothstep(1.0, 0.80, uv.y) * smoothstep(1.0, 0.72, abs(lat));
  return sin(fan) * env;
}`;
    const throatExpr = surface.throatColor
      ? 'botanicalThroatColor'
      : 'diffuseColor.rgb * vec3(1.06, 0.91, 0.76)';
    const tipExpr = surface.tipColor
      ? 'botanicalTipColor'
      : 'mix(diffuseColor.rgb, vec3(1.0, 0.985, 0.94), 0.34)';
    const gradMix = (surface.throatColor || surface.midColor || surface.tipColor)
      ? 'mix(botanicalStrength, 1.0, 0.42)'
      : 'botanicalStrength';
    const midStep = surface.midColor
      ? `
      float botanicalMidMask = exp(-pow((botanicalUvCoord.y - 0.50) * 3.1, 2.0));
      botanicalGrad = mix(botanicalGrad, botanicalMidColor, botanicalMidMask * 0.65);`
      : '';
    colorPatch = `
      vec2 botanicalUvCoord = botanicalCoords();
      float botanicalLat = (botanicalUvCoord.x - 0.5) * 2.0;
      float botanicalThroatW = smoothstep(0.54, 0.0, botanicalUvCoord.y);
      float botanicalTipW = smoothstep(0.44, 1.0, botanicalUvCoord.y);
      vec3 botanicalGrad = diffuseColor.rgb;
      botanicalGrad = mix(botanicalGrad, ${throatExpr}, botanicalThroatW);
      ${midStep}
      botanicalGrad = mix(botanicalGrad, ${tipExpr}, botanicalTipW);
      diffuseColor.rgb = mix(diffuseColor.rgb, botanicalGrad, ${gradMix});
      float botanicalFan = botanicalLat / (0.42 + 0.58 * botanicalUvCoord.y) * botanicalVeinCount * 3.14159265 * botanicalScale;
      float botanicalVeinEnv = smoothstep(0.04, 0.22, botanicalUvCoord.y) * smoothstep(1.0, 0.80, botanicalUvCoord.y) * smoothstep(1.0, 0.72, abs(botanicalLat));
      float botanicalVelvet = botanicalWave(botanicalFan) * botanicalVeinEnv;
      // Faint radial velvet petal veins (~0.04 amplitude), never harsh dark lines.
      diffuseColor.rgb *= 1.0 + botanicalVelvet * (0.04 * botanicalStrength);
      diffuseColor.rgb *= vec3(1.0 + botanicalInstVar * botanicalInstVariation, 1.0 + botanicalInstVar * botanicalInstVariation * 0.45, 1.0 - botanicalInstVar * botanicalInstVariation * 0.85);
    `;
    roughnessPatch = `
      roughnessFactor = clamp(roughnessFactor - botanicalVelvet * (0.04 * botanicalStrength), 0.42, 1.0);
    `;
  } else if (surface.kind === 'leaf') {
    if (surface.veinColor) {
      uniforms.botanicalVeinColor = { value: surface.veinColor.clone() };
      extraUniformDecl += 'uniform vec3 botanicalVeinColor;\n';
    }
    if (surface.baseColor) {
      uniforms.botanicalBaseColor = { value: surface.baseColor.clone() };
      extraUniformDecl += 'uniform vec3 botanicalBaseColor;\n';
    }
    if (surface.venation === 'pinnate') {
      relief = 0.00055;
      frequency = 32.0;
      heightFn = `
float botanicalHeight() {
  vec2 uv = botanicalCoords();
  float midDist = abs(uv.x - 0.5) * 2.0;
  float midW = mix(0.072, 0.018, uv.y);
  float midrib = (1.0 - smoothstep(midW * 0.30, midW, midDist)) * smoothstep(1.0, 0.86, uv.y);
  float sidePhase = (uv.y * 5.2 - midDist * 1.45) * 6.2831853 * botanicalScale;
  float sideMask = smoothstep(0.05, 0.16, midDist) * smoothstep(0.96, 0.72, midDist)
    * smoothstep(0.06, 0.20, uv.y) * smoothstep(0.96, 0.76, uv.y);
  float sideVeins = pow(max(0.0, 0.5 + 0.5 * cos(sidePhase)), 2.4) * sideMask;
  return midrib + sideVeins * 0.42;
}`;
      const veinTintExpr = surface.veinColor
        ? 'botanicalVeinColor'
        : 'diffuseColor.rgb * vec3(1.24, 1.28, 0.92) + vec3(0.035, 0.045, 0.01)';
      const baseTintExpr = surface.baseColor
        ? 'botanicalBaseColor'
        : 'diffuseColor.rgb * vec3(0.84, 0.91, 0.86)';
      colorPatch = `
      vec2 botanicalUvCoord = botanicalCoords();
      float botanicalMidDist = abs(botanicalUvCoord.x - 0.5) * 2.0;
      float botanicalMidW = mix(0.072, 0.018, botanicalUvCoord.y);
      float botanicalMidrib = (1.0 - smoothstep(botanicalMidW * 0.30, botanicalMidW, botanicalMidDist)) * smoothstep(1.0, 0.86, botanicalUvCoord.y);
      float botanicalSidePhase = (botanicalUvCoord.y * 5.2 - botanicalMidDist * 1.45) * 6.2831853 * botanicalScale;
      float botanicalSideMask = smoothstep(0.05, 0.16, botanicalMidDist) * smoothstep(0.96, 0.72, botanicalMidDist)
        * smoothstep(0.06, 0.20, botanicalUvCoord.y) * smoothstep(0.96, 0.76, botanicalUvCoord.y);
      float botanicalSideVeins = pow(max(0.0, 0.5 + 0.5 * botanicalCos(botanicalSidePhase)), 2.4) * botanicalSideMask;
      float botanicalVeinMask = clamp(botanicalMidrib + botanicalSideVeins * 0.52, 0.0, 1.0);
      vec3 botanicalBasePigment = mix(diffuseColor.rgb, ${baseTintExpr}, smoothstep(0.45, 0.0, botanicalUvCoord.y) * botanicalStrength);
      vec3 botanicalTipPigment = botanicalBasePigment * mix(vec3(1.0), vec3(1.10, 1.06, 0.84), smoothstep(0.35, 1.0, botanicalUvCoord.y) * botanicalStrength * 0.85);
      float botanicalBladeNoise = botanicalFineNoise(botanicalLocalPosition * (7.5 * botanicalScale));
      botanicalTipPigment *= 1.0 + botanicalBladeNoise * (0.06 * botanicalStrength);
      diffuseColor.rgb = mix(botanicalTipPigment, ${veinTintExpr}, botanicalVeinMask * botanicalStrength * 0.56);
      diffuseColor.rgb *= vec3(1.0 + botanicalInstVar * botanicalInstVariation, 1.0 + botanicalInstVar * botanicalInstVariation * 0.45, 1.0 - botanicalInstVar * botanicalInstVariation * 0.85);
      `;
      roughnessPatch = `
      roughnessFactor = clamp(roughnessFactor + botanicalVeinMask * (0.08 * botanicalStrength) - (1.0 - botanicalVeinMask) * (0.05 * botanicalStrength), 0.24, 1.0);
      `;
    } else if (surface.venation === 'parallel') {
      uniforms.botanicalFoldRidge = { value: surface.foldRidge };
      extraUniformDecl += 'uniform float botanicalFoldRidge;\n';
      relief = 0.00048;
      frequency = 144.0;
      heightFn = `
float botanicalHeight() {
  vec2 uv = botanicalCoords();
  float pPhase = uv.x * 46.0 * 3.14159265 * botanicalScale + sin(uv.y * 5.0) * 0.18;
  float ridge = exp(-pow((uv.x - 0.5) * 5.5, 2.0)) * smoothstep(0.05, 0.25, uv.y);
  return sin(pPhase) * 0.55 + sin(pPhase * 0.25 + 0.4) * 0.25 + ridge * 0.65;
}`;
      const veinTintExpr = surface.veinColor
        ? 'botanicalVeinColor'
        : 'diffuseColor.rgb * vec3(1.16, 1.18, 0.86)';
      const baseTintExpr = surface.baseColor
        ? 'botanicalBaseColor'
        : 'diffuseColor.rgb * vec3(0.86, 0.92, 0.88)';
      colorPatch = `
      vec2 botanicalUvCoord = botanicalCoords();
      float botanicalPPhase = botanicalUvCoord.x * 46.0 * 3.14159265 * botanicalScale + sin(botanicalUvCoord.y * 5.0) * 0.18;
      float botanicalParallel = botanicalWave(botanicalPPhase) * 0.65 + botanicalWave(botanicalPPhase * 0.25 + 0.4) * 0.35;
      float botanicalRidge = exp(-pow((botanicalUvCoord.x - 0.5) * 5.5, 2.0)) * smoothstep(0.05, 0.25, botanicalUvCoord.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, ${baseTintExpr}, smoothstep(0.38, 0.0, botanicalUvCoord.y) * botanicalStrength);
      diffuseColor.rgb *= 1.0 + botanicalParallel * (0.09 * botanicalStrength);
      diffuseColor.rgb = mix(diffuseColor.rgb, ${veinTintExpr}, botanicalRidge * botanicalFoldRidge * botanicalStrength * 0.82);
      diffuseColor.rgb *= vec3(1.0 + botanicalInstVar * botanicalInstVariation, 1.0 + botanicalInstVar * botanicalInstVariation * 0.45, 1.0 - botanicalInstVar * botanicalInstVariation * 0.85);
      `;
      roughnessPatch = `
      roughnessFactor = clamp(roughnessFactor - (0.5 + 0.5 * botanicalParallel) * (0.12 * botanicalStrength) - botanicalRidge * (0.05 * botanicalFoldRidge), 0.20, 1.0);
      `;
    } else {
      // needle
      relief = 0.00030;
      frequency = 36.0;
      heightFn = `
float botanicalHeight() {
  vec3 ap = botanicalAlignedPos();
  float ang = atan(ap.z, ap.y);
  return sin(ang * 5.0 + ap.x * 14.0 * botanicalScale) * 0.45;
}`;
      const sheathExpr = surface.baseColor
        ? 'botanicalBaseColor'
        : 'diffuseColor.rgb * vec3(0.62, 0.56, 0.42)';
      colorPatch = `
      vec2 botanicalUvCoord = botanicalCoords();
      float botanicalSheath = smoothstep(0.26, 0.0, botanicalUvCoord.y);
      float botanicalTipLift = smoothstep(0.32, 1.0, botanicalUvCoord.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, ${sheathExpr}, botanicalSheath * mix(botanicalStrength, 1.0, 0.35));
      diffuseColor.rgb *= mix(vec3(1.0), vec3(1.08, 1.18, 0.88), botanicalTipLift * botanicalStrength * 0.92);
      diffuseColor.rgb *= vec3(1.0 + botanicalInstVar * botanicalInstVariation, 1.0 + botanicalInstVar * botanicalInstVariation * 0.45, 1.0 - botanicalInstVar * botanicalInstVariation * 0.85);
      `;
      roughnessPatch = `
      roughnessFactor = clamp(roughnessFactor + botanicalSheath * 0.12 - botanicalTipLift * (0.06 * botanicalStrength), 0.35, 1.0);
      `;
    }
  } else if (surface.kind === 'bud' || surface.kind === 'grain') {
    const isBud = surface.kind === 'bud';
    if (surface.calyxColor) {
      uniforms.botanicalCalyxColor = { value: surface.calyxColor.clone() };
      extraUniformDecl += 'uniform vec3 botanicalCalyxColor;\n';
    }
    if (surface.bellyColor) {
      uniforms.botanicalBellyColor = { value: surface.bellyColor.clone() };
      extraUniformDecl += 'uniform vec3 botanicalBellyColor;\n';
    }
    relief = isBud ? 0.00028 : 0.00038;
    frequency = isBud ? 24.0 : 42.0;
    heightFn = isBud
      ? `
float botanicalHeight() {
  vec3 ap = botanicalAlignedPos();
  vec2 uv = botanicalCoords();
  float ang = atan(ap.z, ap.y);
  return sin(ang * 3.0 + uv.y * 2.2) * smoothstep(0.08, 0.32, uv.y) * smoothstep(1.0, 0.72, uv.y) * 0.65;
}`
      : `
float botanicalHeight() {
  vec3 ap = botanicalAlignedPos();
  vec2 uv = botanicalCoords();
  float ang = atan(ap.z, ap.y);
  float crease = -exp(-pow(ang * 2.2, 2.0)) * smoothstep(0.08, 0.25, uv.y) * smoothstep(1.0, 0.78, uv.y);
  float hull = sin(ang * 10.0 * botanicalScale + ap.x * 16.0) * 0.18;
  return crease + hull;
}`;
    const baseExpr = surface.calyxColor
      ? 'botanicalCalyxColor'
      : isBud
        ? 'mix(diffuseColor.rgb, vec3(0.56, 0.72, 0.42), 0.58)'
        : 'diffuseColor.rgb * vec3(0.76, 0.61, 0.42)';
    const bellyExpr = surface.bellyColor
      ? 'botanicalBellyColor'
      : isBud
        ? 'mix(diffuseColor.rgb, vec3(1.0, 0.985, 0.94), 0.28)'
        : 'diffuseColor.rgb * vec3(1.10, 1.03, 0.85)';
    const detailExpr = isBud
      ? `
      float botanicalPleat = botanicalWave(atan(botanicalAp.z, botanicalAp.y) * 3.0 + botanicalUvCoord.y * 2.2)
        * smoothstep(0.08, 0.32, botanicalUvCoord.y) * smoothstep(1.0, 0.72, botanicalUvCoord.y);
      diffuseColor.rgb *= 1.0 + botanicalPleat * (0.035 * botanicalStrength);`
      : `
      float botanicalAng = atan(botanicalAp.z, botanicalAp.y);
      float botanicalCrease = exp(-pow(botanicalAng * 2.2, 2.0))
        * smoothstep(0.08, 0.25, botanicalUvCoord.y) * smoothstep(1.0, 0.78, botanicalUvCoord.y);
      diffuseColor.rgb *= 1.0 - botanicalCrease * (0.16 * botanicalStrength);`;
    colorPatch = `
      vec2 botanicalUvCoord = botanicalCoords();
      vec3 botanicalAp = botanicalAlignedPos();
      float botanicalCalyxMask = smoothstep(0.36, 0.04, botanicalUvCoord.y);
      float botanicalBellyMask = smoothstep(0.28, 0.86, botanicalUvCoord.y);
      vec3 botanicalToned = mix(diffuseColor.rgb, ${baseExpr}, botanicalCalyxMask * mix(botanicalStrength, 1.0, 0.30));
      botanicalToned = mix(botanicalToned, ${bellyExpr}, botanicalBellyMask * botanicalStrength * 0.80);
      diffuseColor.rgb = botanicalToned;
      ${detailExpr}
      // ±3.5% default per-instance hue/warmth shift from static instanceMatrix (zero drag swim).
      diffuseColor.rgb *= vec3(
        1.0 + botanicalInstVar * botanicalInstVariation,
        1.0 + botanicalInstVar * botanicalInstVariation * 0.45,
        1.0 - botanicalInstVar * botanicalInstVariation * 0.85
      );
    `;
    roughnessPatch = isBud
      ? `roughnessFactor = clamp(roughnessFactor + botanicalCalyxMask * 0.08 - botanicalBellyMask * (0.05 * botanicalStrength), 0.45, 1.0);`
      : `roughnessFactor = clamp(roughnessFactor + botanicalCalyxMask * 0.10 - botanicalBellyMask * (0.08 * botanicalStrength), 0.35, 1.0);`;
  } else {
    // peel: citrus | pome | berry | rind
    if (surface.blushColor) {
      uniforms.botanicalBlushColor = { value: surface.blushColor.clone() };
      extraUniformDecl += 'uniform vec3 botanicalBlushColor;\n';
    }
    if (surface.underColor) {
      uniforms.botanicalUnderColor = { value: surface.underColor.clone() };
      extraUniformDecl += 'uniform vec3 botanicalUnderColor;\n';
    }
    const blushExpr = surface.blushColor
      ? 'botanicalBlushColor'
      : 'diffuseColor.rgb * vec3(1.10, 0.99, 0.86)';
    const underExpr = surface.underColor
      ? 'botanicalUnderColor'
      : 'diffuseColor.rgb * vec3(0.88, 0.94, 0.82)';

    if (surface.peel === 'citrus') {
      relief = 0.00052;
      frequency = 68.0;
      heightFn = `
float botanicalHeight() {
  vec3 p = botanicalLocalPosition * (34.0 * botanicalScale);
  return botanicalRawNoise(p) * 0.72 + botanicalRawNoise(p * 2.1 + vec3(3.7, 1.9, 5.2)) * 0.28;
}`;
      colorPatch = `
      vec2 botanicalUvCoord = botanicalCoords();
      float botanicalPore = botanicalFineNoise(botanicalLocalPosition * (34.0 * botanicalScale));
      diffuseColor.rgb = mix(diffuseColor.rgb, ${underExpr}, smoothstep(0.40, 0.0, botanicalUvCoord.y) * botanicalStrength * 0.65);
      diffuseColor.rgb = mix(diffuseColor.rgb, ${blushExpr}, smoothstep(0.55, 1.0, botanicalUvCoord.y) * botanicalStrength * 0.65);
      diffuseColor.rgb *= 1.0 + botanicalPore * (0.11 * botanicalStrength);
      diffuseColor.rgb *= vec3(1.0 + botanicalInstVar * botanicalInstVariation, 1.0 + botanicalInstVar * botanicalInstVariation * 0.45, 1.0 - botanicalInstVar * botanicalInstVariation * 0.85);
      `;
      roughnessPatch = `
      roughnessFactor = clamp(roughnessFactor - botanicalPore * (0.10 * botanicalStrength), 0.28, 1.0);
      `;
    } else if (surface.peel === 'pome') {
      relief = 0.00024;
      frequency = 32.0;
      heightFn = `
float botanicalHeight() {
  vec3 p = botanicalLocalPosition * (16.0 * botanicalScale);
  return botanicalRawNoise(vec3(p.x * 1.4, p.y * 0.45, p.z * 1.4)) * 0.55;
}`;
      colorPatch = `
      vec2 botanicalUvCoord = botanicalCoords();
      vec3 botanicalPomeP = botanicalLocalPosition * botanicalScale;
      float botanicalStreak = botanicalFineNoise(vec3(botanicalPomeP.x * 14.0, botanicalPomeP.y * 3.5, botanicalPomeP.z * 14.0));
      float botanicalLenticel = smoothstep(0.32, 0.46, botanicalFineNoise(botanicalPomeP * 48.0));
      diffuseColor.rgb = mix(diffuseColor.rgb, ${underExpr}, smoothstep(0.38, 0.0, botanicalUvCoord.y) * botanicalStrength * 0.72);
      diffuseColor.rgb = mix(diffuseColor.rgb, ${blushExpr}, smoothstep(0.42, 0.96, botanicalUvCoord.y + botanicalStreak * 0.25) * botanicalStrength * 0.85);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.16, 1.12, 0.94) + vec3(0.03), botanicalLenticel * botanicalStrength * 0.45);
      diffuseColor.rgb *= vec3(1.0 + botanicalInstVar * botanicalInstVariation, 1.0 + botanicalInstVar * botanicalInstVariation * 0.45, 1.0 - botanicalInstVar * botanicalInstVariation * 0.85);
      `;
      roughnessPatch = `
      roughnessFactor = clamp(roughnessFactor + botanicalLenticel * (0.08 * botanicalStrength), 0.24, 1.0);
      `;
    } else if (surface.peel === 'berry') {
      relief = 0.00018;
      frequency = 24.0;
      heightFn = `
float botanicalHeight() {
  return botanicalRawNoise(botanicalLocalPosition * (12.0 * botanicalScale)) * 0.35;
}`;
      colorPatch = `
      vec2 botanicalUvCoord = botanicalCoords();
      float botanicalBloom = pow(botanicalGrazing(vViewPosition), 2.2);
      float botanicalMottle = botanicalFineNoise(botanicalLocalPosition * (12.0 * botanicalScale));
      diffuseColor.rgb = mix(diffuseColor.rgb, ${underExpr}, smoothstep(0.36, 0.0, botanicalUvCoord.y) * botanicalStrength * 0.55);
      diffuseColor.rgb = mix(diffuseColor.rgb, ${blushExpr}, smoothstep(0.58, 1.0, botanicalUvCoord.y) * botanicalStrength * 0.50);
      // Powdery grape/berry bloom softens grazing silhouettes without washing out color.
      vec3 botanicalBloomTint = mix(diffuseColor.rgb, vec3(0.84, 0.88, 0.84), 0.38);
      diffuseColor.rgb = mix(diffuseColor.rgb, botanicalBloomTint, botanicalBloom * (0.42 + botanicalMottle * 0.12) * botanicalStrength);
      diffuseColor.rgb *= vec3(1.0 + botanicalInstVar * botanicalInstVariation, 1.0 + botanicalInstVar * botanicalInstVariation * 0.45, 1.0 - botanicalInstVar * botanicalInstVariation * 0.85);
      `;
      roughnessPatch = `
      roughnessFactor = clamp(roughnessFactor + botanicalBloom * (0.24 * botanicalStrength), 0.26, 1.0);
      `;
    } else {
      // rind (pomegranate / melon leathery mottled peel)
      relief = 0.00046;
      frequency = 36.0;
      heightFn = `
float botanicalHeight() {
  vec3 p = botanicalLocalPosition * (14.0 * botanicalScale);
  return botanicalRawNoise(p) * 0.65 + botanicalRawNoise(p * 2.7 + vec3(4.1, 2.3, 6.7)) * 0.35;
}`;
      colorPatch = `
      vec2 botanicalUvCoord = botanicalCoords();
      vec3 botanicalRindP = botanicalLocalPosition * botanicalScale;
      float botanicalCloud = botanicalNoise(botanicalRindP * 6.5) - 0.5;
      float botanicalSpeck = botanicalFineNoise(botanicalRindP * 24.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, ${underExpr}, smoothstep(0.36, 0.0, botanicalUvCoord.y) * botanicalStrength * 0.62);
      diffuseColor.rgb = mix(diffuseColor.rgb, ${blushExpr}, smoothstep(0.50, 1.0, botanicalUvCoord.y) * botanicalStrength * 0.62);
      diffuseColor.rgb *= 1.0 + (botanicalCloud * 0.22 + botanicalSpeck * 0.12) * botanicalStrength;
      diffuseColor.rgb *= vec3(1.0 + botanicalInstVar * botanicalInstVariation, 1.0 + botanicalInstVar * botanicalInstVariation * 0.45, 1.0 - botanicalInstVar * botanicalInstVariation * 0.85);
      `;
      roughnessPatch = `
      roughnessFactor = clamp(roughnessFactor + (botanicalCloud * 0.10 + botanicalSpeck * 0.08) * botanicalStrength, 0.36, 1.0);
      `;
    }
  }

  return { uniforms, extraUniformDecl, heightFn, colorPatch, roughnessPatch, relief, frequency, useUvFootprint };
}

function attach(material: THREE.Material, surface: NormalizedBotanicalSurface) {
  if (surfaces.has(material)) return;
  const owned = cloneSurface(surface);
  surfaces.set(material, owned);
  material.userData.botanicalSurface = {
    kind: owned.kind,
    strength: owned.strength,
    scale: owned.scale,
    coord: owned.coord,
    axis: owned.axis,
    axialRange: [...owned.axialRange],
    seed: owned.seed,
    ...(owned.kind === 'leaf' ? { venation: owned.venation, softenClusterNormals: owned.softenClusterNormals } : {}),
    ...(owned.kind === 'peel' ? { peel: owned.peel } : {}),
  };

  const before = material.onBeforeCompile;
  const baseKey = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    before.call(this, shader, renderer);
    if (shader.fragmentShader.includes('#define WBR_BOTANICAL_SURFACE')) return;

    const mode = buildModeShaders(owned);
    Object.assign(shader.uniforms, mode.uniforms);

    const uvVarying = owned.coord === 'uv' ? 'varying vec2 botanicalUv;\n' : '';
    const vertPrefix = `uniform float botanicalSeed;\nvarying vec3 botanicalLocalPosition;\nvarying vec3 botanicalLocalNormal;\nvarying float botanicalInstVar;\n${uvVarying}`;
    const fragVaryings = `varying vec3 botanicalLocalPosition;\nvarying vec3 botanicalLocalNormal;\nvarying float botanicalInstVar;\n${uvVarying}`;

    shader.vertexShader = vertPrefix + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      botanicalLocalPosition = transformed;
      botanicalLocalNormal = normal;
      ${owned.coord === 'uv' ? 'botanicalUv = uv;' : ''}
      botanicalInstVar = 0.0;
      #ifdef USE_INSTANCING
        vec3 botanicalOrigin = instanceMatrix[3].xyz + vec3(botanicalSeed, botanicalSeed * 1.37, -botanicalSeed * 0.73);
        vec3 botanicalBasis = instanceMatrix[0].xyz + instanceMatrix[1].xyz * 0.5;
        float botanicalHash = sin(dot(botanicalOrigin, vec3(12.9898, 78.233, 37.719))
          + dot(botanicalBasis, vec3(4.17, -6.31, 5.29)) + botanicalSeed * 19.37) * 43758.5453;
        botanicalInstVar = (fract(botanicalHash) - 0.5) * 2.0;
      #endif
    `);

    const fragPrefix =
      '#define WBR_BOTANICAL_SURFACE\n'
      + fragVaryings
      + BOTANICAL_HEADER
      + mode.extraUniformDecl
      + coordHelper(owned)
      + mode.heightFn
      + '\n';
    shader.fragmentShader = fragPrefix + shader.fragmentShader;
    if (owned.kind === 'peel' && owned.peel === 'berry') {
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', BERRY_GRAZING_HELPER + '\nvoid main() {');
    }

    const footprintExpr = mode.useUvFootprint
      ? `max(length(dFdx(botanicalUv)), length(dFdy(botanicalUv))) * botanicalScale * ${mode.frequency.toFixed(1)}`
      : `max(length(dFdx(botanicalLocalPosition)), length(dFdy(botanicalLocalPosition))) * botanicalScale * ${mode.frequency.toFixed(1)}`;

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        ${mode.colorPatch}
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        ${mode.roughnessPatch}
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        float botanicalH = botanicalHeight() * botanicalStrength * ${mode.relief.toFixed(5)};
        float botanicalFootprint = ${footprintExpr};
        float botanicalVis = exp(-0.5 * botanicalFootprint * botanicalFootprint);
        normal = botanicalReliefNormal(normal, -vViewPosition, botanicalH, botanicalVis);
      `);

    if (owned.kind === 'leaf' && owned.venation === 'needle' && owned.softenClusterNormals) {
      const wrappedIncidence = '0.78 * saturate( ( dot( geometryNormal, directLight.direction ) + 0.48 ) / 1.48 )';
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(
          'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
          `reflectedLight.directDiffuse += ${wrappedIncidence} * directLight.color * BRDF_Lambert( material.diffuseColor );`,
        ))
        .replace('#include <lights_lambert_pars_fragment>', THREE.ShaderChunk.lights_lambert_pars_fragment.replace(
          'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
          `float dotNL = ${wrappedIncidence};`,
        ));
    }

    if (!shader.fragmentShader.includes('WBR_BOTANICAL_SHOULDER')) {
      shader.fragmentShader = '#define WBR_BOTANICAL_SHOULDER\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        vec3 botanicalLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        float botanicalPeak = max(botanicalLit.r, max(botanicalLit.g, botanicalLit.b));
        // C1 asymptotic highlight shoulder (knee = 0.74, headroom = 0.24) prevents sunlit
        // pale petals, jasmine buds, and glossy leaves from clipping to flat white.
        if (botanicalPeak > 0.74) {
          float botanicalExcess = botanicalPeak - 0.74;
          float botanicalTarget = 0.74 + 0.24 * (botanicalExcess / (botanicalExcess + 0.24));
          outgoingLight = botanicalLit * (botanicalTarget / botanicalPeak) + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
      `);
    }
  };

  const subMode = owned.kind === 'leaf' ? owned.venation : owned.kind === 'peel' ? owned.peel : 'std';
  const colorFlags = [
    owned.throatColor ? 'T' : '',
    owned.midColor ? 'M' : '',
    owned.tipColor ? 'P' : '',
    owned.veinColor ? 'V' : '',
    owned.baseColor ? 'B' : '',
    owned.calyxColor ? 'C' : '',
    owned.bellyColor ? 'Y' : '',
    owned.blushColor ? 'L' : '',
    owned.underColor ? 'U' : '',
    owned.softenClusterNormals ? 'S' : '',
  ].join('');
  material.customProgramCacheKey = () =>
    `${baseKey}|wbr-botanical-v1:${owned.kind}:${subMode}:${owned.coord}:${owned.axis}:${colorFlags || 'def'}`;
  material.needsUpdate = true;
}

/** Create a single-pass procedural botanical material with zero external textures. */
export function createBotanicalMaterial(
  parameters: THREE.MeshStandardMaterialParameters,
  options: BotanicalSurfaceOptions,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    roughness: defaultRoughness(options),
    metalness: 0,
    ...parameters,
  });
  return applyBotanicalSurface(material, options);
}

/** Attach procedural botanical surface shading to an existing material (composable with `createRitualMaterial`). */
export function applyBotanicalSurface<T extends THREE.MeshStandardMaterial>(
  material: T,
  options: BotanicalSurfaceOptions,
): T {
  attach(material, normalizeOptions(options));
  return material;
}

/** Check whether a material carries an attached botanical surface shader. */
export function hasBotanicalSurface(material: THREE.Material): boolean {
  return surfaces.has(material);
}

/** Reconstruct the botanical surface patch on a styled clone (used by `toon-surfaces`). */
export function copyBotanicalSurface(source: THREE.Material, target: THREE.Material): void {
  const surface = surfaces.get(source);
  if (surface) attach(target, surface);
}
