import * as THREE from "three";
import type { RenderStyleId } from "@wbr/content";

/**
 * Optional art direction on mesh.userData.toonSurface. Source textures stay untouched.
 * `outline: false` keeps a surface cel-shaded but out of the ink selection, so large
 * backdrops (ground, walls) do not merge every silhouette into one outlined shape.
 */
type ToonSurface = { color?: THREE.ColorRepresentation; simplifyMap?: boolean; aoIntensity?: number; outline?: boolean; metalness?: number; roughness?: number };
type Lit = THREE.MeshStandardMaterial | THREE.MeshPhongMaterial | THREE.MeshLambertMaterial;
type Painted = THREE.MeshToonMaterial | THREE.MeshStandardMaterial;
type Adapted = [source: Lit, toon: Painted, keepColor: boolean];
type Entry = { original: THREE.Material | THREE.Material[]; styled: THREE.Material | THREE.Material[]; owned: Painted[]; adapted: Adapted[] };

export function createToonSurfaces(style: Exclude<RenderStyleId, "original">) {
  // Standard Three.js gradient-map configuration, not a custom shader.
  const values = [85, 165, 235];
  const gradient = new THREE.DataTexture(new Uint8Array(values), values.length, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  const cache = new Map<THREE.Mesh, Entry>();

  function adapt(source: THREE.Material, hint: ToonSurface, owned: Painted[], adapted: Adapted[]) {
    if (!(source instanceof THREE.MeshStandardMaterial || source instanceof THREE.MeshPhongMaterial || source instanceof THREE.MeshLambertMaterial) || source.transparent) return source;
    const painted = {
      color: hint.color ?? source.color,
      map: hint.simplifyMap ? null : source.map,
      aoMap: source.aoMap,
      aoMapIntensity: hint.aoIntensity ?? Math.min(source.aoMapIntensity, 0.45),
      // Fine normal/bump detail makes stepped lighting noisy. Keep geometry shading.
      normalMap: null,
      bumpMap: null,
      emissive: source.emissive,
      emissiveMap: source.emissiveMap,
      emissiveIntensity: source.emissiveIntensity,
      alphaMap: source.alphaMap,
      alphaTest: source.alphaTest,
      opacity: source.opacity,
      side: source.side,
      vertexColors: source.vertexColors,
      depthWrite: source.depthWrite,
      depthTest: source.depthTest,
      // A surface pushed back in depth lets ink lines lie exactly on it.
      polygonOffset: source.polygonOffset,
      polygonOffsetFactor: source.polygonOffsetFactor,
      polygonOffsetUnits: source.polygonOffsetUnits,
      visible: source.visible,
      wireframe: source.wireframe,
      fog: source.fog,
      displacementMap: source.displacementMap,
      displacementScale: source.displacementScale,
      displacementBias: source.displacementBias,
    };
    // Soft village materials keep continuous volume, diffuse sky reflection and
    // contact shadows. The optional ink preset still uses the original cel bands.
    const toon = style === "toon-soft"
      ? new THREE.MeshStandardMaterial({ ...painted, roughness: hint.roughness ?? 0.94, metalness: hint.metalness ?? 0, envMapIntensity: 0.45 })
      : new THREE.MeshToonMaterial({ ...painted, gradientMap: gradient });
    toon.name = `${source.name || "surface"} / ${style}`;
    owned.push(toon);
    adapted.push([source, toon, hint.color !== undefined]);
    return toon;
  }

  return {
    apply(scene: THREE.Scene) {
      const live = new Set<THREE.Mesh>();
      const swaps: [THREE.Mesh, Entry][] = [];
      const outlined: THREE.Mesh[] = [];
      const restore = () => { swaps.forEach(([mesh, entry]) => { mesh.material = entry.original; }); };
      try {
        scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          live.add(object);
          let entry = cache.get(object);
          if (!entry || entry.original !== object.material) {
            entry?.owned.forEach((material) => material.dispose());
            const owned: Painted[] = [];
            const adapted: Adapted[] = [];
            const hint: ToonSurface = object.userData.toonSurface ?? {};
            const original = object.material;
            const styled = Array.isArray(original)
              ? original.map((material) => adapt(material, hint, owned, adapted))
              : adapt(original, hint, owned, adapted);
            entry = { original, styled, owned, adapted };
            cache.set(object, entry);
          }
          if (entry.owned.length) {
            // Scenes animate glow, fades and tints on their source materials.
            for (const [source, toon, keepColor] of entry.adapted) {
              if (!keepColor) toon.color.copy(source.color);
              toon.emissive.copy(source.emissive);
              toon.emissiveIntensity = source.emissiveIntensity;
              toon.opacity = source.opacity;
              toon.visible = source.visible;
            }
            swaps.push([object, entry]);
            object.material = entry.styled;
            if ((object.userData.toonSurface as ToonSurface | undefined)?.outline !== false) outlined.push(object);
          }
        });
        for (const [mesh, entry] of cache) {
          if (!live.has(mesh)) {
            entry.owned.forEach((material) => material.dispose());
            cache.delete(mesh);
          }
        }
      } catch (error) { restore(); throw error; }
      return { outlined, restore };
    },
    dispose() {
      cache.forEach((entry) => entry.owned.forEach((material) => material.dispose()));
      cache.clear();
      gradient.dispose();
    },
  };
}
