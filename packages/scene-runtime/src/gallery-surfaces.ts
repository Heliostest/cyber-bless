import * as THREE from 'three';
import type { RenderStyleParameters } from './render-style-parameters';
import { copyRitualOptics } from './ritual-optics';

export type GallerySurfaceStyle = 'gallery-toon' | 'pencil-hatch' | 'height-palette' | 'normal-palette';

type Lit = THREE.MeshStandardMaterial | THREE.MeshPhongMaterial | THREE.MeshLambertMaterial | THREE.MeshToonMaterial;
type Entry = {
  original: THREE.Material | THREE.Material[];
  sources: Lit[];
  styled: THREE.Material | THREE.Material[];
  clones: Lit[];
  hooks: THREE.Material['onBeforeCompile'][];
  keys: string[];
  versions: number[];
};

export function isGallerySurfaceStyle(value: string): value is GallerySurfaceStyle {
  return value === 'gallery-toon' || value === 'pencil-hatch' || value === 'height-palette' || value === 'normal-palette';
}

function isOpaqueLit(material: THREE.Material): material is Lit {
  return (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhongMaterial ||
    material instanceof THREE.MeshLambertMaterial || material instanceof THREE.MeshToonMaterial) &&
    material.visible && !material.transparent && material.alphaTest === 0 && !material.alphaHash &&
    !(material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0);
}

function surfaceMeshes(scene: THREE.Scene): THREE.Mesh[] {
  const subjects: THREE.Mesh[] = [];
  scene.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (let parent = object.parent; parent && parent !== scene; parent = parent.parent) {
      if (parent.name === 'cozy-environment' || parent.userData.environment !== undefined) return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.length && materials.every(isOpaqueLit)) subjects.push(object);
  });
  return subjects;
}

/** The normal/depth prepass respects the authored contour selection independently of surface styling. */
export function gallerySubjects(scene: THREE.Scene): THREE.Mesh[] {
  return surfaceMeshes(scene).filter(mesh => mesh.userData.toonSurface?.outline !== false);
}

// Original mesh treatments composed with Three's existing lighting, texture,
// skinning and morph pipeline. No Gallery/Shadertoy shader source is embedded.
const HEADER = `
varying vec3 galleryWorldPosition;
uniform float galleryLevels;
uniform float galleryRim;
uniform float galleryPencilScale;
uniform float galleryPencilStrength;
uniform float galleryPaletteStrength;
uniform float galleryNormalStrength;
uniform vec2 galleryHeightRange;
float galleryStroke(vec2 coordinate) {
  float phase = (coordinate.x + coordinate.y * 0.43) * galleryPencilScale;
  float footprint = max(fwidth(phase), 0.001);
  float distanceToStroke = abs(fract(phase) - 0.5);
  float coverage = 1.0 - smoothstep(0.10 - footprint, 0.10 + footprint, distanceToStroke);
  return mix(coverage, 0.20, smoothstep(0.3, 0.8, footprint));
}
`;

const POSITION = `
  #include <project_vertex>
  vec4 galleryPosition = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    galleryPosition = batchingMatrix * galleryPosition;
  #endif
  #ifdef USE_INSTANCING
    galleryPosition = instanceMatrix * galleryPosition;
  #endif
  galleryWorldPosition = (modelMatrix * galleryPosition).xyz;
`;

function treatment(style: GallerySurfaceStyle): string {
  const common = `
    vec3 galleryNormal = inverseTransformDirection(normal, viewMatrix);
    vec3 galleryLumaWeights = vec3(0.2126, 0.7152, 0.0722);
    float galleryPigmentLuma = max(dot(diffuseColor.rgb, galleryLumaWeights), 0.025);
    float galleryLight = dot(max(outgoingLight - totalEmissiveRadiance, vec3(0.0)), galleryLumaWeights) / galleryPigmentLuma;
  `;
  const modes: Record<GallerySurfaceStyle, string> = {
    'gallery-toon': `
      float galleryBand = (floor(min(galleryLight, 2.0) * galleryLevels) + 0.5) / galleryLevels;
      float galleryRatio = clamp(galleryBand / max(galleryLight, 0.05), 0.5, 1.5);
      outgoingLight = (outgoingLight - totalEmissiveRadiance) * galleryRatio + totalEmissiveRadiance;
      float galleryFacing = abs(dot(normal, normalize(vViewPosition)));
      outgoingLight += diffuseColor.rgb * pow(1.0 - galleryFacing, 4.0) * galleryRim * 0.3;
    `,
    'pencil-hatch': `
      vec3 galleryWeights = abs(galleryNormal);
      galleryWeights /= max(dot(galleryWeights, vec3(1.0)), 0.001);
      vec3 galleryLines = vec3(galleryStroke(galleryWorldPosition.yz), galleryStroke(galleryWorldPosition.zx), galleryStroke(galleryWorldPosition.xy));
      vec3 galleryCross = vec3(galleryStroke(galleryWorldPosition.zy * vec2(1.0, -1.0)), galleryStroke(galleryWorldPosition.xz * vec2(1.0, -1.0)), galleryStroke(galleryWorldPosition.yx * vec2(1.0, -1.0)));
      float galleryDarkness = 1.0 - smoothstep(0.2, 1.4, galleryLight);
      float galleryInk = dot(galleryLines, galleryWeights) * smoothstep(0.08, 0.6, galleryDarkness);
      galleryInk = max(galleryInk, dot(galleryCross, galleryWeights) * smoothstep(0.55, 0.95, galleryDarkness));
      outgoingLight *= 1.0 - galleryInk * galleryPencilStrength * 0.8;
    `,
    'height-palette': `
      float galleryHeight = clamp((galleryWorldPosition.y - galleryHeightRange.x) / max(galleryHeightRange.y - galleryHeightRange.x, 0.001), 0.0, 1.0);
      // Five height bands are independent of another mode's shade-level control.
      galleryHeight = floor(galleryHeight * 4.0 + 0.5) / 4.0;
      vec3 galleryPalette = mix(vec3(0.62, 0.26, 0.15), vec3(0.24, 0.53, 0.44), smoothstep(0.0, 0.6, galleryHeight));
      galleryPalette = mix(galleryPalette, vec3(0.94, 0.79, 0.46), smoothstep(0.45, 1.0, galleryHeight));
      outgoingLight = mix(outgoingLight, galleryPalette * dot(outgoingLight, galleryLumaWeights) * 1.5, galleryPaletteStrength);
    `,
    'normal-palette': `
      vec3 galleryPalette = galleryNormal * 0.5 + 0.5;
      outgoingLight = mix(outgoingLight, galleryPalette * dot(outgoingLight, galleryLumaWeights) * 1.5, galleryNormalStrength);
    `,
  };
  return common + modes[style];
}

function meshBounds(mesh: THREE.Mesh, bounds: THREE.Box3) {
  if (mesh instanceof THREE.InstancedMesh || mesh instanceof THREE.SkinnedMesh) {
    mesh.computeBoundingBox();
    if (mesh.boundingBox) bounds.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld);
    else bounds.makeEmpty();
  } else {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox) bounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    else bounds.makeEmpty();
  }
}

export function createGallerySurfaces(style: GallerySurfaceStyle) {
  const cache = new Map<THREE.Mesh, Entry>();
  const uniforms = {
    galleryLevels: { value: 4 }, galleryRim: { value: .18 },
    galleryPencilScale: { value: 24 }, galleryPencilStrength: { value: .65 },
    galleryPaletteStrength: { value: .65 }, galleryNormalStrength: { value: .7 },
    galleryHeightRange: { value: new THREE.Vector2(0, 1) },
  };
  const shaderUniforms: Record<string, THREE.IUniform> = { ...uniforms };
  if (style === 'height-palette') delete shaderUniforms.galleryLevels;
  const bounds = new THREE.Box3(), partBounds = new THREE.Box3();
  let disposed = false;
  let activeRestore: (() => void) | undefined;
  const release = (entry: Entry) => entry.clones.forEach(material => material.dispose());

  function createEntry(original: THREE.Material | THREE.Material[]): Entry {
    const sources = (Array.isArray(original) ? [...original] : [original]) as Lit[];
    const keys = sources.map(source => source.customProgramCacheKey());
    const hooks = sources.map(source => source.onBeforeCompile);
    const clones = sources.map((source, index) => {
      const target = source.clone() as Lit;
      target.onBeforeCompile = hooks[index];
      target.customProgramCacheKey = () => keys[index];
      // Material.clone does not copy shader hooks. Rebuild ownership of optical
      // fibers while retaining any custom hook wrapped around the source optics.
      copyRitualOptics(source, target);
      const before = target.onBeforeCompile, baseKey = target.customProgramCacheKey();
      target.onBeforeCompile = function(shader, renderer) {
        before.call(this, shader, renderer);
        Object.assign(shader.uniforms, shaderUniforms);
        shader.vertexShader = 'varying vec3 galleryWorldPosition;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', POSITION);
        shader.fragmentShader = HEADER + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', treatment(style) + '\n#include <opaque_fragment>');
      };
      target.customProgramCacheKey = () => `${baseKey}|wbr-gallery-surfaces-v1:${style}`;
      return target;
    });
    return { original, sources, styled: Array.isArray(original) ? clones : clones[0], clones, hooks, keys, versions: sources.map(source => source.version) };
  }

  return {
    setParameters(parameters: RenderStyleParameters) {
      const set = (key: keyof Omit<typeof uniforms, 'galleryHeightRange'>, value: number | undefined, fallback: number, min: number, max: number) => {
        uniforms[key].value = Number.isFinite(value) ? THREE.MathUtils.clamp(value!, min, max) : fallback;
      };
      set('galleryLevels', Math.round(parameters.galleryLevels), 4, 2, 8);
      set('galleryRim', parameters.galleryRim, .18, 0, 1);
      set('galleryPencilScale', parameters.pencilScale, 24, 6, 60);
      set('galleryPencilStrength', parameters.pencilStrength, .65, 0, 1);
      set('galleryPaletteStrength', parameters.paletteStrength, .65, 0, 1);
      set('galleryNormalStrength', parameters.normalStrength, .7, 0, 1);
    },
    apply(scene: THREE.Scene) {
      if (disposed) throw new Error('Gallery surfaces have been disposed.');
      activeRestore?.();
      const swaps: [THREE.Mesh, Entry][] = [];
      let restored = false;
      const restore = () => {
        if (restored) return;
        restored = true;
        for (const [mesh, entry] of swaps) if (mesh.material === entry.styled) mesh.material = entry.original;
        if (activeRestore === restore) activeRestore = undefined;
      };
      activeRestore = restore;
      try {
        scene.updateMatrixWorld(true);
        const subjects = surfaceMeshes(scene), live = new Set(subjects);
        bounds.makeEmpty();
        for (const mesh of subjects) { meshBounds(mesh, partBounds); bounds.union(partBounds); }
        if (bounds.isEmpty()) uniforms.galleryHeightRange.value.set(0, 1);
        else uniforms.galleryHeightRange.value.set(bounds.min.y, Math.max(bounds.max.y, bounds.min.y + .001));
        for (const [mesh, entry] of cache) if (!live.has(mesh)) { release(entry); cache.delete(mesh); }
        for (const mesh of subjects) {
          const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          let entry = cache.get(mesh);
          if (!entry || entry.original !== mesh.material || entry.sources.length !== sources.length || sources.some((source, index) =>
            entry!.sources[index] !== source || entry!.hooks[index] !== source.onBeforeCompile || entry!.keys[index] !== source.customProgramCacheKey())) {
            if (entry) release(entry);
            entry = createEntry(mesh.material); cache.set(mesh, entry);
          }
          entry.sources.forEach((source, index) => {
            const target = entry!.clones[index];
            target.copy(source);
            target.defines = source.defines ? { ...source.defines } : undefined;
            target.name = `${source.name || 'surface'} / ${style}`;
            if (entry!.versions[index] !== source.version) { target.needsUpdate = true; entry!.versions[index] = source.version; }
          });
          swaps.push([mesh, entry]); mesh.material = entry.styled;
        }
        return { outlined: subjects.filter(mesh => mesh.userData.toonSurface?.outline !== false), restore };
      } catch (error) { restore(); throw error; }
    },
    dispose() {
      if (disposed) return;
      disposed = true; activeRestore?.();
      cache.forEach(release); cache.clear();
    },
  };
}
