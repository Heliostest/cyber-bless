import * as THREE from 'three';
import type { EnvironmentTone } from './debug-environment-tone';

// Art direction inferred from the reference's outdoor screenshots, not extracted assets.
export const DELIVERY_PALETTE = {
  grass: 0x83bf3b, sand: 0xe5d4ad, wood: 0xc5a076, trim: 0x9d805e,
  hill: 0x71ad3d, distantHill: 0x98c65e, stone: 0xb7b6a0,
  foliage: 0x63ab38, flower: 0xe9b8a4, horizon: 0x67caff, zenith: 0x248fe6,
};

/** Only background-owned surfaces are visited. Source maps and geometry stay owned by their loaders. */
export function createEnvironmentTone(root: THREE.Group, night = false) {
  let tone: EnvironmentTone = 'original';
  const colors = new WeakMap<THREE.Material, THREE.Color>();
  const vertices = new WeakMap<THREE.BufferAttribute, Float32Array>();
  const cloudColors = new WeakMap<THREE.Material, THREE.Color>();
  const source = new THREE.Color(), target = new THREE.Color();
  function remap(color: THREE.Color, role?: keyof typeof DELIVERY_PALETTE) {
    const green = color.g > color.r * 1.08 && color.g > color.b * 1.1;
    // Pink blossoms and other authored foliage accents keep their identity.
    if (role === 'foliage' && !green) return color;
    const neutral = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b) < .12;
    target.setHex(DELIVERY_PALETTE[role ?? (green ? 'foliage' : neutral ? 'stone' : 'wood')]);
    if (night) target.multiplyScalar(.62);
    // Preserve source variation so tree crowns and small stones retain their facets.
    const brightness = THREE.MathUtils.clamp(.8 + color.r * .15 + color.g * .3 + color.b * .05, .8, 1.3);
    return color.lerp(target.multiplyScalar(brightness), role ? .9 : .72);
  }
  function refresh() {
    const seenMaterials = new Set<THREE.Material>(), seenAttributes = new Set<THREE.BufferAttribute>();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const surfaces = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of surfaces) {
        if (seenMaterials.has(material)) continue;
        seenMaterials.add(material);
        if (material instanceof THREE.ShaderMaterial && material.name === 'Toon Cloud distant layer') {
          const color = material.uniforms.uColor.value as THREE.Color;
          if (!cloudColors.has(material)) cloudColors.set(material, color.clone());
          color.copy(cloudColors.get(material)!);
          if (tone !== 'original') color.lerp(new THREE.Color(night ? 0x648093 : 0xfff4d9).multiplyScalar(night ? .7 : 2.4), night ? .3 : .18);
        }
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        if (!colors.has(material)) colors.set(material, material.color.clone());
        material.color.copy(colors.get(material)!);
        // The meadow owns its painted ground texture and per-blade palette.
        if (tone !== 'original' && material.map?.name !== 'painted-meadow-patches') {
          if (material.vertexColors) {
            // Simple Tree keeps its pink/green tint in the base material; its
            // vertex colors mostly hold AO. White would erase the blossom hue.
            if (object.userData.treeRole === 'leaves') remap(material.color, 'foliage');
          } else remap(material.color, material.userData.environmentRole);
        }
      }
      const attribute = object.geometry.getAttribute('color');
      if (!(attribute instanceof THREE.BufferAttribute) || seenAttributes.has(attribute)) return;
      seenAttributes.add(attribute);
      if (!vertices.has(attribute)) vertices.set(attribute, Float32Array.from(attribute.array));
      const original = vertices.get(attribute)!;
      for (let i = 0; i < attribute.count; i++) {
        source.fromArray(original, i * attribute.itemSize);
        if (tone !== 'original') remap(source, object.userData.treeRole === 'leaves' ? 'foliage' : undefined);
        attribute.setXYZ(i, source.r, source.g, source.b);
      }
      attribute.needsUpdate = true;
    });
  }
  return {
    refresh,
    setTone(next: EnvironmentTone) { tone = next; refresh(); },
  };
}
