import * as THREE from 'three';
import { createKomorebiSurface } from './komorebi-surface';

/**
 * Display-referred Komorebi daylight pigments for shared backdrop surfaces that were
 * still lit as PBR after 2026-11-06: sand pads, Kenney rocks, planting beds and distant hills.
 * The Komorebi diffuse response clamps the light sum before the pigment, so a sunlit
 * surface shows approximately this colour after the Komorebi grade.
 * Grass, its ground texture, the approved grass palette, and the courtyard stone path
 * own their own Komorebi surfaces and are not remapped here.
 */
export const KOMOREBI_BACKDROP_PIGMENTS = {
  /** Garden sand pads stay near the palette sand (L*≈75). */
  sand: 0xc8b48c,
  /** Warm grey Kenney rocks (L*≈68), instead of the cool lavender grey. */
  stone: 0xaca595,
  /** Bushes, leaves and bed grasses join the meadow's yellow-green family. */
  foliage: 0x5a7b33,
  /** Kenney flower petals and centres keep their hues without glowing. */
  flower: 0xe2c3a2,
  bloom: 0xc4b3d2,
  blossomHeart: 0xe6d6ab,
  /** The two meadow silhouettes stay lighter than the lawn for atmospheric depth. */
  hill: 0x6f9149,
  distantHill: 0x97b17e,
} as const;
export type BackdropRole = keyof typeof KOMOREBI_BACKDROP_PIGMENTS;

function isBackdropRole(value: unknown): value is BackdropRole {
  return typeof value === 'string' && Object.hasOwn(KOMOREBI_BACKDROP_PIGMENTS, value);
}

const FLOWER_CALIBRATION_ROLES = new Set<BackdropRole>(['flower', 'bloom', 'blossomHeart']);

/**
 * Soften Kenney flower petal/centre shadows under Komorebi's ambient-free daylight rig:
 * thin Kenney petals carry many downward normals that otherwise crush too dark against
 * the dark hemisphere ground. Sunlit faces (light = 1) stay exact; bushes (`foliage`)
 * and rocks (`stone`) keep the base Komorebi diffuse response.
 */
function calibratePropSurface(surface: THREE.MeshPhongMaterial, role: BackdropRole) {
  if (!FLOWER_CALIBRATION_ROLES.has(role)) return;
  const compileSurface = surface.onBeforeCompile;
  surface.onBeforeCompile = (shader, renderer) => {
    compileSurface.call(surface, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\nobjectNormal = normalize(vec3(objectNormal.x * 0.55, abs(objectNormal.y) * 0.5 + 0.55, objectNormal.z * 0.55));',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec3 outgoingLight=clamp(reflectedLight.directDiffuse+reflectedLight.indirectDiffuse,0.0,1.0)*kmPigment',
      'vec3 outgoingLight=mix(vec3(.38,.44,.48),vec3(1.0),clamp(reflectedLight.directDiffuse+reflectedLight.indirectDiffuse,0.0,1.0))*kmPigment',
    );
  };
  surface.customProgramCacheKey = () => 'komorebi-backdrop-flower-v1';
}

/**
 * Komorebi daylight paints tagged backdrop materials (`userData.backdropRole`) with the
 * meadow's clamped diffuse response. Their PBR sources are kept and restored for other
 * tones and night, so the comparison console and teardown see the original materials.
 */
export function createKomorebiBackdrop(root: THREE.Object3D) {
  const surfaces = new Map<THREE.MeshStandardMaterial, THREE.MeshPhongMaterial>();
  const swapped = new Map<THREE.Mesh, THREE.Material>();
  let enabled = false, disposed = false;
  function surfaceFor(source: THREE.MeshStandardMaterial, role: BackdropRole) {
    let surface = surfaces.get(source);
    if (!surface) {
      surface = createKomorebiSurface(source);
      // Like the meadow, Komorebi pigments are display values carried in the linear slots.
      surface.color.setHex(KOMOREBI_BACKDROP_PIGMENTS[role], THREE.LinearSRGBColorSpace);
      surface.name = `Komorebi backdrop ${role}`;
      // An optional linear multiplier (grain, worn edges) owned by the environment, daylight only.
      const detail = source.userData.komorebiDetailMap;
      if (detail instanceof THREE.Texture) surface.map = detail;
      calibratePropSurface(surface, role);
      surfaces.set(source, surface);
    }
    return surface;
  }
  function attach() {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material) || swapped.has(object)) return;
      if (object.userData.stonePath) return;
      const source = object.material, role = source.userData.backdropRole;
      if (!(source instanceof THREE.MeshStandardMaterial) || source.userData.komorebiPigment || !isBackdropRole(role)) return;
      swapped.set(object, source);
      object.material = surfaceFor(source, role);
    });
  }
  function detach() {
    swapped.forEach((source, mesh) => { mesh.material = source; });
    swapped.clear();
  }
  return {
    get enabled() { return enabled; },
    /** Night and the comparison tones keep the PBR backdrop; Komorebi daylight uses the calibrated diffuse. */
    setEnabled(next: boolean) {
      if (disposed) return;
      enabled = next;
      if (next) attach(); else detach();
    },
    dispose() {
      if (disposed) return;
      disposed = true; detach();
      surfaces.forEach(surface => surface.dispose()); surfaces.clear();
    },
  };
}
