import * as THREE from 'three';
import fibers from './ritual-fibers.data.json';

export type RitualSurfaceKind = 'paper' | 'cloth' | 'leaf' | 'petal' | 'wax' | 'jade' | 'skin' | 'fruit' | 'glass' | 'water' | 'tea' | 'honey' | 'wet';
/** Local-space support projection or UV-anchored thin-sheet paper structure. */
export type RitualPaperStructure =
  | { layout: 'radial' | 'bands'; spacing: number; width: number; contrast: number; halfHeight?: number }
  | {
      layout: 'sheet';
      /** UV repeat scale for pulp and washi fiber detail (higher = finer grain). Default 2.4. */
      grainScale?: number;
      /** Sheet width / height aspect ratio so UV fiber stays isotropic on narrow slips. Default 1. */
      aspect?: number;
      /** Multi-scale pulp & paper-tooth grain contrast (0..1). Default 0.55. */
      grain?: number;
      /** Subtle interlaced kozo / washi fiber strands (0..1). Default 0.44. */
      fibers?: number;
      /** Subtle cut-edge / deckle border density contrast (0..1). Default 0.28. */
      edge?: number;
      /** Highlight roll-off guard to keep sunlit pale paper from clipping to flat white (0..1). Default 0.42. */
      highlightGuard?: number;
    };
export type RitualSurfaceOptions = { kind: RitualSurfaceKind; strength?: number; thickness?: number; fiber?: 'paper' | 'linen' | false; paper?: RitualPaperStructure };

type Fiber = 'paper' | 'linen';
type SupportPaper = { layout: 'radial' | 'bands'; spacing: number; width: number; contrast: number; halfHeight?: number };
type SheetPaper = { layout: 'sheet'; grainScale: number; aspect: number; grain: number; fibers: number; edge: number; highlightGuard: number };
type NormalizedPaper = SupportPaper | SheetPaper;
type Optics = { kind: RitualSurfaceKind; strength: number; fiber: Fiber | false; paper?: NormalizedPaper };
const states = new WeakMap<THREE.Material, Optics>();
const textures = new Map<Fiber, { texture: THREE.DataTexture; owners: number }>();
const scatterStrength: Partial<Record<RitualSurfaceKind, number>> = {
  paper: .24, cloth: .16, leaf: .19, petal: .22, wax: .17, jade: .10, skin: .08, fruit: .14,
};

function finite(value: number | undefined, fallback: number, min = 0, max = 1) {
  return Number.isFinite(value) ? THREE.MathUtils.clamp(value!, min, max) : fallback;
}

function ownFiber(kind: Fiber) {
  let entry = textures.get(kind);
  if (!entry) {
    const data = fibers[kind];
    const texture = new THREE.DataTexture(Uint8Array.from(data.data), data.width, data.height, THREE.RedFormat);
    texture.name = `ritual-${kind}-fiber-cc0`;
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    entry = { texture, owners: 0 };
    textures.set(kind, entry);
  }
  entry.owners++;
  return entry;
}

// Light-driven, single-pass approximation. Thin-sheet backlighting follows the
// Khronos diffuse-transmission model; the restrained forward lobe borrows the
// Three r170 SSS example's direction-warp idea. Sources/licenses live in
// assets/materials/ritual-optics/provenance.md and LICENSE.three.txt.
const SCATTER = `
uniform float ritualScatterStrength;
void ritualScatter(const in IncidentLight directLight, const in vec3 surfaceNormal,
  const in vec3 viewDirection, const in vec3 pigment, inout ReflectedLight reflectedLight) {
  float back = max(0.0, dot(-surfaceNormal, directLight.direction));
  vec3 throughDirection = normalize(directLight.direction + surfaceNormal * 0.18);
  float forward = pow(max(0.0, dot(viewDirection, -throughDirection)), 3.0);
  float transmissionLobe = back * (0.72 + forward * 0.28);
  reflectedLight.directDiffuse += pigment * directLight.color
    * (ritualScatterStrength * transmissionLobe * 0.31830988618);
}
`;

const FIBER_HEADER = `
uniform sampler2D ritualFiberMap;
float ritualFiber() {
  vec3 weights = abs(normalize(ritualLocalNormal));
  weights /= max(weights.x + weights.y + weights.z, 0.001);
  vec3 p = ritualLocalPosition * 3.0;
  return texture2D(ritualFiberMap, p.yz).r * weights.x
    + texture2D(ritualFiberMap, p.xz).r * weights.y
    + texture2D(ritualFiberMap, p.xy).r * weights.z;
}
`;

function paperHeader(paper: SupportPaper) {
  return `
uniform float ritualPaperSpacing;
uniform float ritualPaperWidth;
uniform float ritualPaperContrast;
uniform float ritualPaperHalfHeight;
float ritualPaperClearance() {
  float coordinate = ${paper.layout === 'radial' ? 'atan(ritualLocalPosition.z, ritualLocalPosition.x)' : 'ritualLocalPosition.y'};
  float distanceToSupport = abs(fract(coordinate / ritualPaperSpacing + 0.5) - 0.5);
  return smoothstep(ritualPaperWidth * 0.30, ritualPaperWidth, distanceToSupport);
}
float ritualPaperInternalProfile() {
  ${paper.layout === 'bands' ? `float edge = clamp(abs(ritualLocalPosition.y) / ritualPaperHalfHeight, 0.0, 1.0);
  return mix(0.38, 1.0, pow(max(0.0, 1.0 - edge * edge), 0.65));` : 'return 1.0;'}
}
float ritualPaperViewTransmission(const in vec3 surfaceNormal, const in vec3 viewDirection) {
  ${paper.layout === 'bands' ? 'return mix(0.30, 1.0, pow(abs(dot(surfaceNormal, viewDirection)), 0.75));' : 'return 1.0;'}
}
`;
}

// UV-anchored handmade sheet detail: combines multi-scale CC0 paper roughness
// sampling with subtle laid screen lines and oblique kozo fiber wisps (inspired
// by the layered pulp/fiber concept of MIT ittybitty paper shader), so bending
// meshes never swim and pale sunlit paper resists white blowout.
function sheetPaperHeader(hasFiber: boolean) {
  return `
uniform float ritualSheetScale;
uniform float ritualSheetAspect;
uniform float ritualSheetGrain;
uniform float ritualSheetFibers;
uniform float ritualSheetEdge;
uniform float ritualSheetHighlightGuard;
vec2 ritualSheetCoord() {
  return vec2(ritualSheetUv.x * ritualSheetAspect, ritualSheetUv.y) * ritualSheetScale;
}
vec4 ritualSheetDetail() {
  vec2 su = ritualSheetCoord();
  ${hasFiber ? `
  float rawMacro = texture2D(ritualFiberMap, su * 0.62).r - 0.5;
  float rawTooth = texture2D(ritualFiberMap, su * 2.45 + vec2(0.37, 0.71)).r - 0.5;
  float pulp = clamp(rawMacro * 3.1, -0.46, 0.46);
  float tooth = clamp(rawTooth * 2.6, -0.42, 0.42);` : `
  float pulp = sin(su.x * 5.2 + cos(su.y * 4.7)) * cos(su.y * 6.1 - sin(su.x * 3.8)) * 0.24;
  float tooth = sin(su.x * 29.0 + su.y * 17.0) * cos(su.y * 31.0 - su.x * 19.0) * 0.16;`}
  float laid = sin(su.y * 54.0 + pulp * 3.4) * 0.048;
  vec2 f1 = mat2(0.84, 0.54, -0.54, 0.84) * (su * 6.8);
  vec2 f2 = mat2(0.38, -0.92, 0.92, 0.38) * (su * 9.8 + vec2(1.4, 0.8));
  float w1 = smoothstep(0.60, 0.95, sin(f1.x * 2.1 + sin(f1.y * 1.3) * 1.7) * sin(f1.y * 0.68 + 0.35));
  float w2 = smoothstep(0.66, 0.96, sin(f2.x * 1.9 + sin(f2.y * 1.5) * 1.4) * sin(f2.y * 0.74 + 1.2));
  float kozo = (w1 * 0.64 + w2 * 0.52) * ritualSheetFibers;
  float ex = min(ritualSheetUv.x, 1.0 - ritualSheetUv.x) * ritualSheetAspect;
  float ey = min(ritualSheetUv.y, 1.0 - ritualSheetUv.y);
  float edgeDist = min(ex, ey);
  float rimLight = (1.0 - smoothstep(0.0, 0.015, edgeDist)) * ritualSheetEdge;
  float innerBorder = smoothstep(0.008, 0.022, edgeDist) * (1.0 - smoothstep(0.022, 0.068, edgeDist)) * ritualSheetEdge;
  return vec4(pulp, tooth + laid, kozo, rimLight - innerBorder * 0.45);
}
`;
}

const SHEET_SCATTER = `
uniform float ritualScatterStrength;
void ritualScatter(const in IncidentLight directLight, const in vec3 surfaceNormal,
  const in vec3 viewDirection, const in vec3 pigment, const in float pulpDensity,
  inout ReflectedLight reflectedLight) {
  float back = max(0.0, dot(-surfaceNormal, directLight.direction));
  vec3 throughDirection = normalize(directLight.direction + surfaceNormal * 0.18);
  float forward = pow(max(0.0, dot(viewDirection, -throughDirection)), 2.8);
  float pulpTrans = clamp(1.0 - pulpDensity * 0.85, 0.68, 1.32);
  float backLobe = back * (0.76 + forward * 0.32) * pulpTrans;
  float frontDot = dot(surfaceNormal, directLight.direction);
  float luma = dot(pigment, vec3(0.299, 0.587, 0.114));
  float headroom = clamp(1.0 - luma * ritualSheetHighlightGuard * 0.68, 0.30, 1.0);
  float wrapLobe = 0.24 * smoothstep(-0.24, 0.62, frontDot) * headroom;
  vec3 warmPigment = mix(pigment, pigment * vec3(1.04, 1.00, 0.93), 0.35);
  reflectedLight.directDiffuse += warmPigment * directLight.color
    * (ritualScatterStrength * (backLobe + wrapLobe) * 0.31830988618);
}
`;

// Dedicated botanical scatter kernel for leaf, fruit, and thin petal surfaces:
// preserves back-facing transmission while adding a front-wrap lobe for top-front
// Komorebi daylight, warm biological pigment shift, and subtle cuticle rim sheen.
const LEAF_FRUIT_SCATTER = `
uniform float ritualScatterStrength;
uniform vec3 ritualScatterTint;
uniform float ritualCuticleRim;
void ritualScatter(const in IncidentLight directLight, const in vec3 surfaceNormal,
  const in vec3 viewDirection, const in vec3 pigment, inout ReflectedLight reflectedLight) {
  float back = max(0.0, dot(-surfaceNormal, directLight.direction));
  vec3 throughDirection = normalize(directLight.direction + surfaceNormal * 0.18);
  float forward = pow(max(0.0, dot(viewDirection, -throughDirection)), 3.0);
  float transmissionLobe = back * (0.72 + forward * 0.28);
  float frontDot = dot(surfaceNormal, directLight.direction);
  float wrapLobe = 0.28 * smoothstep(-0.32, 0.65, frontDot);
  float grazing = pow(clamp(1.0 - abs(dot(surfaceNormal, viewDirection)), 0.0, 1.0), 3.0);
  float rimLobe = grazing * ritualCuticleRim * smoothstep(-0.30, 0.70, frontDot);
  vec3 warmPigment = pigment * ritualScatterTint;
  reflectedLight.directDiffuse += warmPigment * directLight.color
    * (ritualScatterStrength * (transmissionLobe + wrapLobe) * 0.31830988618);
  reflectedLight.directDiffuse += mix(warmPigment, vec3(1.0), 0.22) * directLight.color
    * (rimLobe * 0.31830988618);
}
`;

function attach(material: THREE.Material, options: Optics) {
  if (states.has(material)) return;
  states.set(material, options);
  material.userData.ritualOptics = { ...options, ...(options.paper ? { paper: { ...options.paper } } : {}) };
  const fiber = options.fiber ? ownFiber(options.fiber) : undefined;
  const isSheet = options.paper?.layout === 'sheet';
  const isBotanical = options.kind === 'leaf' || options.kind === 'fruit' || options.kind === 'petal';
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey.bind(material);
  // Capture the old key before replacing onBeforeCompile: Three's default key
  // reads the current callback, so evaluating it later would lose its identity.
  const baseKey = previousKey();
  material.onBeforeCompile = function(shader, renderer) {
    previousCompile.call(this, shader, renderer);
    if (shader.fragmentShader.includes('WBR_RITUAL_OPTICS')) return;
    shader.fragmentShader = '#define WBR_RITUAL_OPTICS\n' + shader.fragmentShader;
    if (fiber || options.kind === 'water' || options.paper) {
      const varyings = `varying vec3 ritualLocalPosition;\nvarying vec3 ritualLocalNormal;\n${isSheet ? 'varying vec2 ritualSheetUv;\n' : ''}`;
      shader.vertexShader = varyings + shader.vertexShader;
      shader.fragmentShader = varyings + shader.fragmentShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        ritualLocalPosition = transformed;
        ritualLocalNormal = normal;
        ${isSheet ? 'ritualSheetUv = uv;' : ''}
      `);
    }
    if (fiber) {
      shader.uniforms.ritualFiberMap = { value: fiber.texture };
      if (!isSheet) {
        shader.fragmentShader = shader.fragmentShader.replace('void main() {', FIBER_HEADER + '\nvoid main() {');
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
          #include <color_fragment>
          float ritualGrain = ritualFiber() - 0.5;
          diffuseColor.rgb *= 1.0 + ritualGrain * ${options.paper ? '0.38' : '0.10'};
        `).replace('#include <roughnessmap_fragment>', `
          #include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor + ritualGrain * 0.12, 0.06, 1.0);
        `);
      } else {
        shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'uniform sampler2D ritualFiberMap;\nvoid main() {');
      }
    }
    if (options.paper && options.paper.layout !== 'sheet') {
      const paper = options.paper;
      Object.assign(shader.uniforms, {
        ritualPaperSpacing: { value: paper.spacing }, ritualPaperWidth: { value: paper.width },
        ritualPaperContrast: { value: paper.contrast }, ritualPaperHalfHeight: { value: paper.halfHeight ?? 1 },
      });
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', paperHeader(paper) + '\nvoid main() {');
      // A support intercepts light reaching the thin sheet. Keep this density
      // mask on the paper, without alpha holes or a second translucent shell.
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float ritualClearance = ritualPaperClearance();
        diffuseColor.rgb *= mix(1.0 - ritualPaperContrast, 1.0, ritualClearance);
      `).replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        float ritualPaperBody = ritualPaperInternalProfile()
          * ritualPaperViewTransmission(normal, normalize(vViewPosition));
        ${paper.layout === 'bands' ? 'diffuseColor.rgb *= mix(0.60, 1.0, ritualPaperBody);' : ''}
        totalEmissiveRadiance *= ritualPaperBody
          * mix(1.0 - ritualPaperContrast, 1.0, ritualClearance)
          ${fiber ? '* (1.0 + ritualGrain * 0.38)' : ''};
      `);
    } else if (options.paper && options.paper.layout === 'sheet') {
      const sheet = options.paper;
      Object.assign(shader.uniforms, {
        ritualSheetScale: { value: sheet.grainScale },
        ritualSheetAspect: { value: sheet.aspect },
        ritualSheetGrain: { value: sheet.grain },
        ritualSheetFibers: { value: sheet.fibers },
        ritualSheetEdge: { value: sheet.edge },
        ritualSheetHighlightGuard: { value: sheet.highlightGuard },
      });
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', sheetPaperHeader(!!fiber) + '\nvoid main() {');
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        vec4 ritualSheet = ritualSheetDetail();
        float ritualSheetDensity = (ritualSheet.x * 0.56 + ritualSheet.y * 0.44) * ritualSheetGrain;
        vec3 ritualWarmPaper = vec3(0.99, 0.96, 0.90);
        diffuseColor.rgb *= 1.0 + ritualSheetDensity * 0.38;
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, ritualWarmPaper, 0.44), clamp(ritualSheet.z * 0.62, 0.0, 0.42));
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, ritualWarmPaper, 0.36), max(0.0, ritualSheet.w) * 0.58);
        diffuseColor.rgb *= 1.0 + min(0.0, ritualSheet.w) * 0.16;
      `).replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + ritualSheet.y * 0.14 - ritualSheet.z * 0.05, 0.45, 1.0);
      `).replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        ${fiber ? `vec2 ritualToothUv = ritualSheetCoord() * 2.45 + vec2(0.37, 0.71);
        float ritualH0 = texture2D(ritualFiberMap, ritualToothUv).r;
        float ritualHx = texture2D(ritualFiberMap, ritualToothUv + vec2(0.025, 0.0)).r - ritualH0;
        float ritualHy = texture2D(ritualFiberMap, ritualToothUv + vec2(0.0, 0.025)).r - ritualH0;
        normal = normalize(normal + vec3(ritualHx, ritualHy, 0.0) * (ritualSheetGrain * 0.52));` : ''}
      `).replace('#include <opaque_fragment>', `
        if (ritualSheetHighlightGuard > 0.001) {
          float ritualPeak = max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b));
          // Komorebi daylight skips ACES and clips linear > ~1.03 to flat white;
          // a C1 asymptotic shoulder preserves fiber and fold shading on sunlit white paper.
          float ritualGuardSq = ritualSheetHighlightGuard * ritualSheetHighlightGuard;
          float ritualKnee = mix(0.84, 0.56, ritualGuardSq);
          float ritualCeil = mix(0.99, 0.89, ritualGuardSq);
          float ritualHeadroom = max(0.06, ritualCeil - ritualKnee);
          if (ritualPeak > ritualKnee) {
            float ritualExcess = ritualPeak - ritualKnee;
            float ritualTarget = ritualKnee + ritualHeadroom * (ritualExcess / (ritualExcess + ritualHeadroom));
            outgoingLight *= ritualTarget / ritualPeak;
          }
        }
        #include <opaque_fragment>
      `);
    }
    if (options.kind === 'water') {
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        // Quiet local micro-ripples, no extra render target or independent clock.
        vec2 ritualRipple = vec2(sin(ritualLocalPosition.x * 18.0 + ritualLocalPosition.z * 7.0),
          cos(ritualLocalPosition.z * 15.0 - ritualLocalPosition.x * 6.0));
        normal = normalize(normal + vec3(ritualRipple * 0.012, 0.0));
        float ritualFresnel = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        diffuseColor.a = min(1.0, diffuseColor.a * (1.0 + ritualFresnel * 0.18));
      `);
    }
    if (isBotanical && !shader.fragmentShader.includes('WBR_BOTANICAL_SHOULDER')) {
      shader.fragmentShader = '#define WBR_BOTANICAL_SHOULDER\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        vec3 ritualBotanicalLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        float ritualBotanicalPeak = max(ritualBotanicalLit.r, max(ritualBotanicalLit.g, ritualBotanicalLit.b));
        // C1 asymptotic highlight shoulder (knee = 0.74, headroom = 0.24) keeps sunlit
        // pale leaves, fruit, and petals soft and readable without clipping to flat white.
        if (ritualBotanicalPeak > 0.74) {
          float ritualBotanicalExcess = ritualBotanicalPeak - 0.74;
          float ritualBotanicalTarget = 0.74 + 0.24 * (ritualBotanicalExcess / (ritualBotanicalExcess + 0.24));
          outgoingLight = ritualBotanicalLit * (ritualBotanicalTarget / ritualBotanicalPeak) + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
      `);
    }
    if (options.strength > 0 && scatterStrength[options.kind] !== undefined) {
      shader.uniforms.ritualScatterStrength = { value: options.strength };
      if (isBotanical) {
        shader.uniforms.ritualScatterTint = {
          value: options.kind === 'leaf'
            ? new THREE.Vector3(1.06, 1.12, 0.74)
            : new THREE.Vector3(1.10, 0.96, 0.86),
        };
        shader.uniforms.ritualCuticleRim = {
          value: options.kind === 'leaf' ? 0.14 : options.kind === 'fruit' ? 0.16 : 0.07,
        };
      }
      const scatter = isSheet
        ? SHEET_SCATTER
        : isBotanical
          ? LEAF_FRUIT_SCATTER
          : options.paper ? SCATTER.replace(
            'reflectedLight.directDiffuse +=',
            `// Thin paper also wraps front light into its shallow body. The support
             // projection reduces this response before light is accumulated.
             transmissionLobe = (transmissionLobe + 0.60 * max(0.0, dot(surfaceNormal, directLight.direction)) + 0.14)
               * ritualPaperClearance() * ritualPaperInternalProfile()
               * ritualPaperViewTransmission(surfaceNormal, viewDirection);
             reflectedLight.directDiffuse +=`,
          ) : SCATTER;
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', scatter + '\nvoid main() {');
      const direct = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
      const call = isSheet
        ? 'ritualScatter(directLight, geometryNormal, geometryViewDir, diffuseColor.rgb, ritualSheet.x, reflectedLight);'
        : 'ritualScatter(directLight, geometryNormal, geometryViewDir, diffuseColor.rgb, reflectedLight);';
      const lights = THREE.ShaderChunk.lights_fragment_begin.split(direct).join(`${direct}\n        ${call}`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', lights);
    }
  };
  material.customProgramCacheKey = () => `${baseKey}|ritual-optics-v1:${options.kind}:${options.fiber || 'none'}:${options.strength > 0}:${options.paper?.layout ?? 'plain'}`;
  if (fiber) {
    const release = () => {
      material.removeEventListener('dispose', release);
      if (--fiber.owners === 0) {
        fiber.texture.dispose();
        textures.delete(options.fiber as Fiber);
      }
    };
    material.addEventListener('dispose', release);
  }
  material.needsUpdate = true;
}

/** Authored optical response; color, maps, geometry and animated references remain scene-owned. */
export function createRitualMaterial(parameters: THREE.MeshStandardMaterialParameters | THREE.MeshPhysicalMaterialParameters, options: RitualSurfaceOptions): THREE.MeshStandardMaterial {
  const kind = options.kind;
  let material: THREE.MeshStandardMaterial;
  if (kind === 'glass' || kind === 'tea' || kind === 'honey') {
    const isGlass = kind === 'glass';
    const physical = parameters as THREE.MeshPhysicalMaterialParameters;
    material = new THREE.MeshPhysicalMaterial({
      roughness: isGlass ? .10 : .22,
      ior: isGlass ? 1.5 : kind === 'honey' ? 1.47 : 1.333,
      transmission: isGlass ? .72 : kind === 'honey' ? .24 : .18,
      thickness: finite(options.thickness, isGlass ? .025 : .12, 0, 5),
      attenuationColor: new THREE.Color(parameters.color ?? 0xffffff),
      attenuationDistance: isGlass ? 2.5 : .65,
      clearcoat: .35, clearcoatRoughness: .16,
      // The host's shadow policy uses transparent to avoid treating a clear
      // medium as a solid shadow caster. Optical transmission still uses alpha 1.
      transparent: true, depthWrite: false,
      ...physical,
      metalness: 0, opacity: 1,
    });
  } else if (kind === 'wet') {
    material = new THREE.MeshPhysicalMaterial({
      clearcoat: .32, clearcoatRoughness: .16, ...parameters,
      roughness: Math.min(parameters.roughness ?? .30, .36),
      metalness: 0, transmission: 0, transparent: false, opacity: 1,
    });
  } else if (kind === 'water') {
    material = new THREE.MeshStandardMaterial({
      roughness: .20, transparent: true, opacity: .58, depthWrite: false,
      ...parameters, metalness: 0,
    });
  } else {
    material = new THREE.MeshStandardMaterial({ roughness: kind === 'petal' ? .86 : .9, ...parameters });
  }
  const fiber = options.fiber ?? (kind === 'paper' ? 'paper' : kind === 'cloth' ? 'linen' : false);
  const structure = kind === 'paper' ? options.paper : undefined;
  const paper: NormalizedPaper | undefined = structure
    ? structure.layout === 'sheet'
      ? {
          layout: 'sheet',
          grainScale: finite(structure.grainScale, 2.4, .2, 20),
          aspect: finite(structure.aspect, 1, .05, 20),
          grain: finite(structure.grain, .55, 0, 1),
          fibers: finite(structure.fibers, .44, 0, 1),
          edge: finite(structure.edge, .28, 0, 1),
          highlightGuard: finite(structure.highlightGuard, .42, 0, 1),
        }
      : {
          layout: structure.layout,
          spacing: finite(structure.spacing, .1, .0001, 10),
          width: finite(structure.width, .1, .001, .49),
          contrast: finite(structure.contrast, .5),
          ...(structure.halfHeight === undefined ? {} : { halfHeight: finite(structure.halfHeight, 1, .0001, 10) }),
        }
    : undefined;
  attach(material, { kind, fiber, strength: finite(options.strength, scatterStrength[kind] ?? 0), ...(paper ? { paper } : {}) });
  return material;
}

/** Rebuild the patch on a styled clone, with its own shader hook and texture lifetime. */
export function copyRitualOptics(source: THREE.Material, target: THREE.Material): void {
  const options = states.get(source);
  if (options) attach(target, { ...options, ...(options.paper ? { paper: { ...options.paper } } : {}) });
}
