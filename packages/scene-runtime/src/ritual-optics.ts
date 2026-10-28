import * as THREE from 'three';
import fibers from './ritual-fibers.data.json';

export type RitualSurfaceKind = 'paper' | 'cloth' | 'leaf' | 'wax' | 'jade' | 'skin' | 'fruit' | 'glass' | 'water' | 'tea' | 'honey' | 'wet';
/** Local-space support projection; an art-directed thin-paper approximation. */
export type RitualPaperStructure = { layout: 'radial' | 'bands'; spacing: number; width: number; contrast: number; halfHeight?: number };
export type RitualSurfaceOptions = { kind: RitualSurfaceKind; strength?: number; thickness?: number; fiber?: 'paper' | 'linen' | false; paper?: RitualPaperStructure };

type Fiber = 'paper' | 'linen';
type Optics = { kind: RitualSurfaceKind; strength: number; fiber: Fiber | false; paper?: RitualPaperStructure };
const states = new WeakMap<THREE.Material, Optics>();
const textures = new Map<Fiber, { texture: THREE.DataTexture; owners: number }>();
const scatterStrength: Partial<Record<RitualSurfaceKind, number>> = {
  paper: .24, cloth: .16, leaf: .19, wax: .17, jade: .10, skin: .08, fruit: .14,
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

function paperHeader(paper: RitualPaperStructure) {
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

function attach(material: THREE.Material, options: Optics) {
  if (states.has(material)) return;
  states.set(material, options);
  material.userData.ritualOptics = { ...options, ...(options.paper ? { paper: { ...options.paper } } : {}) };
  const fiber = options.fiber ? ownFiber(options.fiber) : undefined;
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
      const varyings = 'varying vec3 ritualLocalPosition;\nvarying vec3 ritualLocalNormal;\n';
      shader.vertexShader = varyings + shader.vertexShader;
      shader.fragmentShader = varyings + shader.fragmentShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        ritualLocalPosition = transformed;
        ritualLocalNormal = normal;
      `);
    }
    if (fiber) {
      shader.uniforms.ritualFiberMap = { value: fiber.texture };
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', FIBER_HEADER + '\nvoid main() {');
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float ritualGrain = ritualFiber() - 0.5;
        diffuseColor.rgb *= 1.0 + ritualGrain * ${options.paper ? '0.38' : '0.10'};
      `).replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + ritualGrain * 0.12, 0.06, 1.0);
      `);
    }
    if (options.paper) {
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
    if (options.strength > 0 && scatterStrength[options.kind] !== undefined) {
      shader.uniforms.ritualScatterStrength = { value: options.strength };
      const scatter = options.paper ? SCATTER.replace(
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
      const lights = THREE.ShaderChunk.lights_fragment_begin.split(direct).join(`${direct}
        ritualScatter(directLight, geometryNormal, geometryViewDir, diffuseColor.rgb, reflectedLight);`);
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
    material = new THREE.MeshStandardMaterial({ roughness: .9, ...parameters });
  }
  const fiber = options.fiber ?? (kind === 'paper' ? 'paper' : kind === 'cloth' ? 'linen' : false);
  const structure = kind === 'paper' ? options.paper : undefined;
  const paper = structure ? {
    layout: structure.layout,
    spacing: finite(structure.spacing, .1, .0001, 10),
    width: finite(structure.width, .1, .001, .49),
    contrast: finite(structure.contrast, .5),
    ...(structure.halfHeight === undefined ? {} : { halfHeight: finite(structure.halfHeight, 1, .0001, 10) }),
  } : undefined;
  attach(material, { kind, fiber, strength: finite(options.strength, scatterStrength[kind] ?? 0), ...(paper ? { paper } : {}) });
  return material;
}

/** Rebuild the patch on a styled clone, with its own shader hook and texture lifetime. */
export function copyRitualOptics(source: THREE.Material, target: THREE.Material): void {
  const options = states.get(source);
  if (options) attach(target, { ...options });
}
