import * as THREE from "three";
import type { RenderStyleId } from "@wbr/content";

/**
 * Optional art direction on mesh.userData.toonSurface. Source textures stay untouched.
 * `outline: false` keeps a surface cel-shaded but out of the ink selection, so large
 * backdrops (ground, walls) do not merge every silhouette into one outlined shape.
 */
type ToonSurface = { color?: THREE.ColorRepresentation; simplifyMap?: boolean; aoIntensity?: number; outline?: boolean; metalness?: number; roughness?: number; shading?: "smooth" };
type Lit = THREE.MeshStandardMaterial | THREE.MeshPhongMaterial | THREE.MeshLambertMaterial;
type Painted = THREE.MeshToonMaterial | THREE.MeshStandardMaterial;
type Adapted = [source: Lit, toon: Painted, keepColor: boolean];
type Entry = { original: THREE.Material | THREE.Material[]; styled: THREE.Material | THREE.Material[]; owned: Painted[]; adapted: Adapted[] };

export function createToonSurfaces(style: Exclude<RenderStyleId, "original">) {
  // Standard Three.js gradient-map configuration, not a custom shader.
  const crisp = style === "toon-ink" || style === "toon-outline";
  const values = style === "toon-outline" ? [55, 145, 245] : style === "toon-ink" ? [85, 165, 235] : Array.from({ length: 128 }, (_, i) => {
    const x = i / 127, bands = [60, 110, 160, 204, 238];
    let value = bands[0];
    for (let j = 1; j < bands.length; j++) {
      // Broad plateaus with short smooth joins: cel form without crawling hard edges.
      const t = THREE.MathUtils.smoothstep(x, j / bands.length - 0.035, j / bands.length + 0.035);
      value += (bands[j] - bands[j - 1]) * t;
    }
    return Math.round(value);
  });
  const gradient = new THREE.DataTexture(new Uint8Array(values), values.length, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = crisp ? THREE.NearestFilter : THREE.LinearFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  const cache = new Map<THREE.Mesh, Entry>();
  let colorLevels = 3;

  function adapt(source: THREE.Material, hint: ToonSurface, owned: Painted[], adapted: Adapted[]) {
    if (!(source instanceof THREE.MeshStandardMaterial || source instanceof THREE.MeshPhongMaterial || source instanceof THREE.MeshLambertMaterial) || source.transparent) return source;
    const pbr = source instanceof THREE.MeshStandardMaterial ? source : undefined;
    const keepFinish = style !== "toon-ink" && (source instanceof THREE.MeshPhysicalMaterial ||
      (hint.metalness ?? pbr?.metalness ?? 0) >= 0.3 || (hint.roughness ?? pbr?.roughness ?? 1) <= 0.4);
    const painted = {
      color: hint.color ?? source.color,
      map: hint.simplifyMap ? null : source.map,
      aoMap: source.aoMap,
      aoMapIntensity: hint.aoIntensity ?? Math.min(source.aoMapIntensity, 0.45),
      // Fine normal/bump detail makes stepped lighting noisy. Keep geometry shading.
      normalMap: keepFinish && !hint.simplifyMap ? source.normalMap : null,
      bumpMap: keepFinish && !hint.simplifyMap ? source.bumpMap : null,
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
    let toon: Painted;
    if (keepFinish) {
      // Preserve the original PBR subclass: glass beads and lacquer keep clearcoat,
      // metalness and their authored texture maps instead of becoming matte plastic.
      toon = pbr?.clone() ?? new THREE.MeshStandardMaterial();
      toon.setValues({ ...painted, roughness: hint.roughness ?? pbr?.roughness ?? 0.35,
        metalness: hint.metalness ?? pbr?.metalness ?? 0 });
    } else if (style === "gouache" || (style === "toon-soft" && hint.shading === "smooth")) {
      toon = new THREE.MeshStandardMaterial({ ...painted, roughness: 0.94, metalness: 0, envMapIntensity: 0.45 });
    } else toon = new THREE.MeshToonMaterial({ ...painted, gradientMap: gradient });
    toon.name = `${source.name || "surface"} / ${style}`;
    owned.push(toon);
    adapted.push([source, toon, hint.color !== undefined]);
    return toon;
  }

  return {
    setColorLevels(value: number) {
      if (style !== "toon-outline" || !Number.isFinite(value)) return;
      const count = THREE.MathUtils.clamp(Math.round(value), 2, 8);
      if (count === colorLevels) return;
      colorLevels = count;
      const bands = [55, 145, 245];
      const data = Uint8Array.from({ length: count }, (_, i) => {
        const position = i / (count-1)*2, low = Math.min(Math.floor(position), 1);
        return Math.round(THREE.MathUtils.lerp(bands[low], bands[low+1], position-low));
      });
      // Reupload the same map at its new dimensions; cached materials keep it.
      gradient.dispose();
      gradient.image = { data, width: count, height: 1 };
      gradient.needsUpdate = true;
    },
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
