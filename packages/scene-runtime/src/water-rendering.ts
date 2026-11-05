import * as THREE from 'three';
import type { WaterRenderMethod } from './debug-water';
import { createToonWaterMaterial } from './toon-water-material';

function isWater(material: THREE.Material) {
  if (material.userData.waterRendering === false) return false;
  return material.userData.waterRendering === true || material.userData.ritualOptics?.kind === 'water';
}

/** Scoped render-time override: never mutates geometry or owns source resources. */
export function createWaterRendering(scene: THREE.Scene) {
  const cache = new Map<THREE.Material, Map<boolean, THREE.ShaderMaterial>>();
  let time = 0, disposed = false;
  function styled(source: THREE.Material, projected: boolean) {
    const variants = cache.get(source) ?? new Map<boolean, THREE.ShaderMaterial>();
    let material = variants.get(projected);
    if (!material) {
      material = createToonWaterMaterial(projected);
      variants.set(projected, material); cache.set(source, variants);
    }
    material.uniforms.uTime.value = time;
    material.uniforms.uOpacity.value = source.opacity;
    if (material.side !== source.side || material.transparent !== source.transparent) {
      material.side = source.side; material.transparent = source.transparent; material.needsUpdate = true;
    }
    material.opacity = source.opacity;
    material.depthWrite = source.depthWrite; material.depthTest = source.depthTest;
    material.visible = source.visible; material.colorWrite = source.colorWrite;
    material.blending = source.blending;
    material.polygonOffset = source.polygonOffset;
    material.polygonOffsetFactor = source.polygonOffsetFactor;
    material.polygonOffsetUnits = source.polygonOffsetUnits;
    material.clippingPlanes = source.clippingPlanes;
    return material;
  }
  return {
    get time() { return time; },
    update(dt: number, motion: { active: boolean; reducedMotion: boolean }) {
      if (disposed || !motion.active || motion.reducedMotion || !Number.isFinite(dt) || dt <= 0) return;
      time += Math.min(dt, .1);
    },
    apply(method: WaterRenderMethod) {
      const changed: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
      let surfaces = 0;
      if (!disposed) scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const original = object.material, materials = Array.isArray(original) ? original : [original];
        if (!materials.some(isWater)) return;
        surfaces++;
        if (method !== 'toon-water') return;
        const projected = !object.geometry.hasAttribute('uv');
        const next = materials.map(source => isWater(source) ? styled(source, projected) : source);
        changed.push([object, original]);
        object.material = Array.isArray(original) ? next : next[0];
      });
      return {
        surfaces,
        restore() { changed.forEach(([mesh, material]) => { mesh.material = material; }); },
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cache.forEach(variants => variants.forEach(material => material.dispose())); cache.clear();
    },
  };
}
