import * as THREE from "three";
import type { RenderStyleId } from "@wbr/content";
import { copyRitualOptics } from './ritual-optics';
import { copyCraftSurface, hasCraftFinish } from './craft-surfaces';
import { softenTreeFoliage } from './tree-foliage';
import { calibrateIconPigment, isSceneEnvironment } from './icon-style';
import { copyKomorebiTreeWind } from './komorebi-tree-wind';

/**
 * Optional art direction on mesh.userData.toonSurface. Source textures stay untouched.
 * `outline: false` keeps a surface cel-shaded but out of the ink selection, so large
 * backdrops (ground, walls) do not merge every silhouette into one outlined shape.
 */
type ToonSurface = { color?: THREE.ColorRepresentation; simplifyMap?: boolean; aoIntensity?: number; outline?: boolean; metalness?: number; roughness?: number; shading?: "smooth" };
type Lit = THREE.MeshStandardMaterial | THREE.MeshPhongMaterial | THREE.MeshLambertMaterial;
type Painted = THREE.MeshToonMaterial | THREE.MeshStandardMaterial;
type Adapted = [source: Lit, toon: Painted, fixedColor: THREE.Color | undefined];
type Entry = { original: THREE.Material | THREE.Material[]; members: THREE.Material[]; signature: string; styled: THREE.Material | THREE.Material[]; owned: Painted[]; adapted: Adapted[] };

export function createToonSurfaces(style: Exclude<RenderStyleId, "original">, sceneId = '') {
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
  const mapFields = ['map','normalMap','bumpMap','aoMap','roughnessMap','metalnessMap','alphaMap','emissiveMap','lightMap','displacementMap','envMap'] as const;

  function signature(members: THREE.Material[], hint: ToonSurface) {
    return JSON.stringify(hint) + members.map(material => {
      const pbr = material as THREE.MeshPhysicalMaterial;
      return [material.version, material.transparent, material.side, material.alphaTest > 0, material.alphaHash,
        pbr.vertexColors, pbr.metalness >= .3, pbr.roughness <= .4, ...mapFields.map(key => !!pbr[key]), pbr.transmission > 0, pbr.clearcoat > 0, pbr.sheen > 0, pbr.iridescence > 0, pbr.anisotropy > 0].join(':');
    }).join('|');
  }

  function adapt(source: THREE.Material, hint: ToonSurface, owned: Painted[], adapted: Adapted[]) {
    // This source owns its pigment/light response and deformation. Replacing it
    // with a toon shader would copy incompatible Phong hooks and erase vertex color.
    if (source.userData.komorebiSurface) return source;
    const glass = source instanceof THREE.MeshPhysicalMaterial && source.userData.ritualOptics?.kind === 'glass';
    if (!(source instanceof THREE.MeshStandardMaterial || source instanceof THREE.MeshPhongMaterial || source instanceof THREE.MeshLambertMaterial) || source.transparent && !(style === 'toon-soft' && glass)) return source;
    const pbr = source instanceof THREE.MeshStandardMaterial ? source : undefined;
    const transmitted = source instanceof THREE.MeshPhysicalMaterial && source.transmission > 0;
    const keepFinish = transmitted || (style !== "toon-ink" && (hasCraftFinish(source) || source instanceof THREE.MeshPhysicalMaterial ||
      (hint.metalness ?? pbr?.metalness ?? 0) >= 0.3 || (hint.roughness ?? pbr?.roughness ?? 1) <= 0.4));
    const painted = {
      color: hint.color ?? source.color,
      map: hint.simplifyMap ? null : source.map,
      aoMap: source.aoMap,
      aoMapIntensity: hint.aoIntensity ?? (style === 'toon-soft' ? source.aoMapIntensity : Math.min(source.aoMapIntensity, 0.45)),
      // Preserve fine relief in continuous soft shading; stepped ink remains quieter.
      normalMap: style === 'toon-soft' || keepFinish && !hint.simplifyMap ? source.normalMap : null,
      bumpMap: style === 'toon-soft' || keepFinish && !hint.simplifyMap ? source.bumpMap : null,
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
    if (keepFinish || style === 'toon-soft') {
      // Preserve the original PBR subclass: glass beads and lacquer keep clearcoat,
      // metalness and their authored texture maps instead of becoming matte plastic.
      toon = pbr?.clone() ?? new THREE.MeshStandardMaterial();
      owned.push(toon);
      toon.setValues({ ...painted, roughness: hint.roughness ?? pbr?.roughness ?? (style === 'toon-soft' ? .88 : .35),
        metalness: hint.metalness ?? pbr?.metalness ?? 0 });
    } else if (style === "gouache") {
      toon = new THREE.MeshStandardMaterial({ ...painted, roughness: 0.94, metalness: 0, envMapIntensity: 0.45 });
      owned.push(toon);
    } else { toon = new THREE.MeshToonMaterial({ ...painted, gradientMap: gradient }); owned.push(toon); }
    toon.name = `${source.name || "surface"} / ${style}`;
    copyRitualOptics(source, toon);
    copyCraftSurface(source, toon);
    if (style === 'toon-soft' && glass) {
      const before = toon.onBeforeCompile, baseKey = toon.customProgramCacheKey();
      toon.onBeforeCompile = function(shader, renderer) {
        before.call(this, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          // Product art: gentle grazing-angle absorption makes a thin clear
          // rim readable against sky. Multiplication keeps night glass dark.
          float iconGlassRim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
          outgoingLight *= mix(vec3(1.0), mix(vec3(0.32), diffuseColor.rgb, 0.65), iconGlassRim * 0.7);
          #include <opaque_fragment>
        `);
      };
      toon.customProgramCacheKey = () => `${baseKey}|icon-glass-rim-v1`;
    }
    if (source.userData.treeClusterNormals) softenTreeFoliage(toon);
    copyKomorebiTreeWind(source, toon);
    if (source.userData.komorebiGrass) {
      toon.onBeforeCompile = source.onBeforeCompile;
      toon.customProgramCacheKey = source.customProgramCacheKey;
    }
    adapted.push([source, toon, hint.color !== undefined ? new THREE.Color(hint.color) : undefined]);
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
          const hint: ToonSurface = object.userData.toonSurface ?? {};
          const members = Array.isArray(object.material) ? object.material : [object.material];
          const currentSignature = signature(members, hint);
          if (!entry || entry.original !== object.material || entry.members.length !== members.length || entry.members.some((member, i) => member !== members[i]) || entry.signature !== currentSignature) {
            entry?.owned.forEach((material) => material.dispose());
            cache.delete(object);
            const owned: Painted[] = [];
            const adapted: Adapted[] = [];
            const original = object.material;
            let styled: THREE.Material | THREE.Material[];
            try { styled = Array.isArray(original) ? original.map(material => adapt(material, hint, owned, adapted)) : adapt(original, hint, owned, adapted); }
            catch (error) { owned.forEach(material => material.dispose()); throw error; }
            entry = { original, members: [...members], signature: currentSignature, styled, owned, adapted };
            cache.set(object, entry);
          }
          if (entry.owned.length) {
            // Scenes animate glow, fades and tints on their source materials.
            for (const [source, toon, fixedColor] of entry.adapted) {
              toon.color.copy(fixedColor ?? source.color);
              if (style === 'toon-soft' && sceneId && !isSceneEnvironment(object) && !source.vertexColors && (!source.map || hint.simplifyMap) && !(source.emissiveIntensity > .1 && source.emissive.getHex() !== 0))
                calibrateIconPigment(toon.color, toon.color, sceneId);
              toon.emissive.copy(source.emissive);
              toon.emissiveIntensity = source.emissiveIntensity;
              toon.opacity = source.opacity;
              toon.visible = source.visible;
              if (style === 'toon-soft' && source instanceof THREE.MeshStandardMaterial && toon instanceof THREE.MeshStandardMaterial) {
                for (const key of mapFields) toon[key] = key === 'map' && hint.simplifyMap ? null : source[key];
                toon.roughness = hint.roughness ?? source.roughness;
                if (source.userData.craftSurface?.kind === 'wood' && hint.roughness === undefined) toon.roughness = Math.min(toon.roughness, .78);
                toon.metalness = hint.metalness ?? source.metalness;
                toon.normalScale.copy(source.normalScale); toon.bumpScale = source.bumpScale;
                toon.normalMapType = source.normalMapType;
                toon.aoMapIntensity = hint.aoIntensity ?? source.aoMapIntensity;
                toon.lightMapIntensity = source.lightMapIntensity;
                toon.envMapIntensity = Math.min(source.envMapIntensity, source instanceof THREE.MeshPhysicalMaterial || hasCraftFinish(source) ? .85 : .55);
                toon.displacementScale = source.displacementScale; toon.displacementBias = source.displacementBias;
              }
              if ((style === 'toon-soft' || source.userData.ritualOptics || source.userData.craftSurface) && source instanceof THREE.MeshStandardMaterial && toon instanceof THREE.MeshStandardMaterial) {
                if (style !== 'toon-soft') {
                toon.roughness = (object.userData.toonSurface as ToonSurface | undefined)?.roughness ?? source.roughness;
                toon.metalness = (object.userData.toonSurface as ToonSurface | undefined)?.metalness ?? source.metalness;
                }
                if (source instanceof THREE.MeshPhysicalMaterial && toon instanceof THREE.MeshPhysicalMaterial) {
                  toon.transmission = source.transmission;
                  toon.thickness = source.thickness;
                  toon.attenuationColor.copy(source.attenuationColor);
                  toon.attenuationDistance = source.attenuationDistance;
                  toon.ior = source.ior;
                  toon.clearcoat = source.clearcoat;
                  toon.clearcoatRoughness = source.clearcoatRoughness;
                  for (const key of ['transmissionMap','thicknessMap','clearcoatMap','clearcoatRoughnessMap','clearcoatNormalMap','sheenColorMap','sheenRoughnessMap','iridescenceMap','iridescenceThicknessMap','specularIntensityMap','specularColorMap','anisotropyMap'] as const) toon[key] = source[key] ?? null;
                  for (const key of ['sheen','sheenRoughness','iridescence','iridescenceIOR','anisotropy','anisotropyRotation','specularIntensity','reflectivity','dispersion'] as const) { const value = source[key]; if (value !== undefined) toon[key] = value; }
                  toon.clearcoatNormalScale.copy(source.clearcoatNormalScale); toon.sheenColor.copy(source.sheenColor); toon.specularColor.copy(source.specularColor);
                  toon.iridescenceThicknessRange = [...source.iridescenceThicknessRange];
                }
              }
            }
            swaps.push([object, entry]);
            object.material = entry.styled;
            if ((object.userData.toonSurface as ToonSurface | undefined)?.outline !== false && entry.members.some(material => !material.transparent)) outlined.push(object);
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
