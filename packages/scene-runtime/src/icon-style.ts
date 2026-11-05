import * as THREE from 'three';
import palettes from './icon-style-palettes.generated.json';

const anchors = palettes as Record<string, number[][]>;
const hsl = { h: 0, s: 0, l: 0 };

/** Product art reference only: keep hue/meaningful colors, gently nudge s/l. */
export function calibrateIconPigment(target: THREE.Color, source: THREE.Color, sceneId: string) {
  target.copy(source);
  const palette = anchors[sceneId]; if (!palette?.length) return;
  const { h, s, l } = source.getHSL(hsl, THREE.SRGBColorSpace);
  if (s < .16 || l < .15 || l > .86) return;
  let best: number[] | undefined, distance = Infinity;
  for (const candidate of palette) {
    const hue = Math.min(Math.abs(h - candidate[0]), 1 - Math.abs(h - candidate[0]));
    if (hue > .07 || Math.abs(l - candidate[2]) > .25) continue;
    const score = hue * 6 + Math.abs(l - candidate[2]) + Math.abs(s - candidate[1]) * .15;
    if (score < distance) { distance = score; best = candidate; }
  }
  if (!best) return;
  target.setHSL(h,
    THREE.MathUtils.lerp(s, THREE.MathUtils.clamp(best[1], s - .16, s + .16), .42),
    THREE.MathUtils.lerp(l, THREE.MathUtils.clamp(best[2], l - .075, l + .075), .42), THREE.SRGBColorSpace);
}

export function isSceneEnvironment(object: THREE.Object3D) {
  for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent)
    if (parent.name === 'cozy-environment' || parent.userData.environment !== undefined) return true;
  return false;
}

/** Temporary soft-style lighting, preserving color, night and local flame lights. */
export function softenObjectLighting(scene: THREE.Scene, sceneId = '') {
  const restore: (() => void)[] = [];
  scene.traverse(object => {
    if (!(object instanceof THREE.DirectionalLight)) return;
    const intensity = object.intensity, radius = object.shadow.radius, strength = object.shadow.intensity;
    restore.push(() => { object.intensity = intensity; object.shadow.radius = radius; object.shadow.intensity = strength; });
    const daylight = intensity > 1.2;
    object.intensity *= daylight ? .74 : .94;
    object.shadow.radius = Math.max(radius, daylight ? 5 : 4);
    object.shadow.intensity *= sceneId === 'woodfish' ? .95 : daylight ? .68 : .88;
  });
  return { restore() { for (const reset of restore) reset(); } };
}
