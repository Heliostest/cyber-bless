import { Color3, Quaternion, Vector3 } from '@babylonjs/core';
import skeletons from './data/tree-skeletons.json';

export interface TreeGeometry { positions: number[]; indices: number[]; colors: number[]; normals: number[]; wind: number[] }
export interface TreePalette { shade: string; middle: string; light: string }
export const LEAFY_TREE_VARIANTS = skeletons.trees.length;
export const TREE_PALETTE: TreePalette = { shade: '#032e2b', middle: '#246d4f', light: '#88bd7b' };
const empty = (): TreeGeometry => ({ positions: [], indices: [], colors: [], normals: [], wind: [] });
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const random = (n: number, salt: number) => { const v = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453; return v - Math.floor(v); };

function vertex(g: TreeGeometry, p: Vector3, n: Vector3, color: Color3, anchor = p, flutter = 0) {
  g.positions.push(p.x, p.y, p.z); g.normals.push(n.x, n.y, n.z); g.colors.push(color.r, color.g, color.b, 1);
  g.wind.push(anchor.x, anchor.y, anchor.z, flutter);
}

/** Rounded leaf with a shallow midrib, shaded edges and an actual oval silhouette. */
function leaflet(g: TreeGeometry, base: Vector3, forward: Vector3, planeNormal: Vector3, length: number, width: number, color: Color3, canopyNormal: Vector3) {
  const side = Vector3.Cross(planeNormal, forward).normalize();
  const geometricNormal = Vector3.Cross(forward, side).normalize();
  // Keep the established soft canopy lighting while the actual leaf plane can turn freely.
  const normal = Vector3.Lerp(canopyNormal, geometricNormal, .22).normalize();
  const center = base.add(forward.scale(length * .5)), offset = g.positions.length / 3;
  vertex(g, center.add(geometricNormal.scale(length * .045)), normal, color.scale(.97), base, 1);
  const segments = 12;
  for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2, t = (Math.cos(a) + 1) * .5;
    const p = base.add(forward.scale(length * t)).add(side.scale(Math.sin(a) * width * (.88 + t * .12)));
    vertex(g, p, normal, color.scale(i < segments / 2 ? 1.09 : 1.015), base, 1);
    g.indices.push(offset, offset + 1 + (i + 1) % segments, offset + 1 + i);
  }
}

function branch(g: TreeGeometry, points: { p: number[]; r: number }[], segments: number, bark: Color3, seed: number, trunk: boolean) {
  const offset = g.positions.length / 3;
  points.forEach((section, ring) => {
    const center = Vector3.FromArray(section.p);
    const direction = Vector3.FromArray(points[Math.min(ring + 1, points.length - 1)].p)
      .subtract(Vector3.FromArray(points[Math.max(ring - 1, 0)].p)).normalize();
    const side = Vector3.Cross(direction, new Vector3(.1, 0, 1)).normalize(), other = Vector3.Cross(side, direction).normalize();
    for (let i = 0; i < segments; i++) {
      const twist = trunk ? ring * .065 + random(seed, 50) * .5 : 0;
      const a = i / segments * Math.PI * 2 + twist, normal = side.scale(Math.cos(a)).add(other.scale(Math.sin(a)));
      const ridges = trunk ? 1 + .055 * Math.cos(a * 5 + seed) + .025 * Math.sin(a * 3) : 1;
      const barkTone = trunk ? .96 + .065 * Math.cos(a * 5 + seed) + .035 * Math.sin(center.y * 4 + a) : 1;
      vertex(g, center.add(normal.scale(section.r * ridges)), normal, bark.scale(barkTone * (.82 + (normal.x * -.3 + normal.z * .3 + .6) * .22)));
      if (ring) { const p = offset + (ring - 1) * segments + i, q = offset + (ring - 1) * segments + (i + 1) % segments; g.indices.push(p, q, p + segments, q, q + segments, p + segments); }
    }
  });
}

/** EZ Tree owns the woody skeleton; the original leaf sprays are made here for Babylon. */
export function createLeafyTree(variant: number, mobile = false, palette: TreePalette = TREE_PALETTE): { leaves: TreeGeometry; branches: TreeGeometry; name: string } {
  const tree = skeletons.trees[((variant % LEAFY_TREE_VARIANTS) + LEAFY_TREE_VARIANTS) % LEAFY_TREE_VARIANTS];
  const leaves = empty(), branches = empty(), shade = Color3.FromHexString(palette.shade), middle = Color3.FromHexString(palette.middle), light = Color3.FromHexString(palette.light);
  const bark = Color3.FromHexString(['#927a62', '#8b7764', '#a8afa5', '#8e7d6c', '#8d715a', '#82705c'][((variant % LEAFY_TREE_VARIANTS) + LEAFY_TREE_VARIANTS) % LEAFY_TREE_VARIANTS]);
  for (const [index,b] of tree.branches.entries()) branch(branches, b.sections, b.segments, bark, tree.seed, index===0);

  // Each primary branch ends in a lobe. Anchor leaves form coherent sprays rather than loose confetti.
  const centers = tree.lobes.map(p => Vector3.FromArray(p));
  const allTips = tree.tips.map(p => Vector3.FromArray(p));
  const top = Math.max(...allTips.map(p => p.y));
  const count = mobile ? 140 : 220;
  for (let i = 0; i < count; i++) {
    const seed = i + tree.seed;
    const tipIndex = Math.floor(random(seed, 2) * allTips.length), tip = allTips[tipIndex];
    const twig = Vector3.FromArray(tree.tipDirections[tipIndex]);
    const lobe = centers.reduce((a, b) => Vector3.DistanceSquared(tip, a) < Vector3.DistanceSquared(tip, b) ? a : b);
    // Keep a dense inner canopy with selected sprays reaching the lit silhouette.
    const azimuth = random(seed, 3) * Math.PI * 2, vertical = random(seed, 4) * 2 - 1;
    const radial = Math.sqrt(1 - vertical * vertical), radius = .28 + random(seed, 5) * .15;
    const outward = new Vector3(Math.cos(azimuth) * radial, vertical, Math.sin(azimuth) * radial);
    const center = Vector3.Lerp(lobe, tip, .62).add(outward.scale(radius));
    const yaw = Math.atan2(twig.x * .65 + outward.x * .35, twig.z * .65 + outward.z * .35) + (random(seed, 6) - .5) * .9;
    const posture = random(seed, 14), tilt = posture < .3 ? .30 + random(seed, 7) * .65
      : posture < .80 ? -.15 + random(seed, 7) * .35 : -.35 - random(seed, 7) * .65;
    const direction = new Vector3(Math.sin(yaw), tilt + twig.y * .20, Math.cos(yaw)).normalize();
    const roll = (random(seed, 15) - .5) * (random(seed, 18) < .3 ? 2.3 : 1.25);
    const rotation = Quaternion.RotationAxis(direction, roll);
    const axis = Vector3.Cross(Vector3.Up(), direction).normalize().rotateByQuaternionToRef(rotation, new Vector3());
    const sprayNormal = Vector3.Cross(direction, axis).normalize();
    const length = .30 + random(seed, 8) * .16, pairs = mobile ? 3 : 4;
    const localNormal = center.subtract(lobe).normalize();
    const normal = new Vector3(localNormal.x * .45, 1.15 + localNormal.y * .24, localNormal.z * .45).normalize();
    const elevation = clamp((center.y - tree.crownBase) / (top - tree.crownBase));
    const sun = new Vector3(-.5, 1, .5).normalize();
    const exposure = clamp(.25 + Vector3.Dot(localNormal, sun) * .75);
    let occlusion = 0;
    for (const other of centers) {
      const delta = other.subtract(center), along = Vector3.Dot(delta, sun);
      if (along > .15 && along < 1.3) {
        const distance = delta.subtract(sun.scale(along)).length();
        occlusion = Math.max(occlusion, clamp(1 - distance / .57) * .30);
      }
    }
    const tone = clamp(elevation * .32 + exposure * .68 - occlusion + (random(seed, 9) - .5) * .055);
    const color = tone < .48 ? Color3.Lerp(shade, middle, tone / .48) : Color3.Lerp(middle, light, (tone - .48) / .52);
    for (let pair = 0; pair < pairs; pair++) {
      const t = .12 + pair / pairs * .74, size = (.145 + random(seed + pair, 10) * .055) * (1 - t * .22);
      for (const sign of [-1, 1]) {
        const arch = (random(seed, 16) - .5) * .35, bend = (random(seed + pair * 2 + sign, 11) - .4) * .7;
        const base = center.add(direction.scale((t - .5) * length)).add(axis.scale(sign * .012))
          .add(sprayNormal.scale((t - .5) ** 2 * arch));
        const splay = 1.02 - t * .24 + (random(seed + pair, 17) - .5) * .2;
        const forward = direction.scale(Math.cos(splay)).add(axis.scale(sign * Math.sin(splay))).add(sprayNormal.scale(bend)).normalize();
        leaflet(leaves, base, forward, sprayNormal,
          size, size * (.34 + random(seed + pair, 12) * .07), color.scale(.97 + random(seed + pair, 13) * .065), normal);
      }
    }
    leaflet(leaves, center.add(direction.scale(length * .48)), direction.add(sprayNormal.scale(.1)).normalize(), sprayNormal, .14, .05, color, normal);
  }
  // One uniform horizontal normalization preserves every spray and guarantees the rotated footprint.
  let radius = 0;
  for (let i = 0; i < leaves.positions.length; i += 3) radius = Math.max(radius, Math.hypot(leaves.positions[i], leaves.positions[i + 2]));
  // Reserve motion space inside the existing 1.35m canopy clearance.
  const scale = Math.min(1, (variant === 2 ? 1.04 : 1.25) / radius);
  for (const g of [leaves, branches]) {
    for (let i = 0; i < g.positions.length; i += 3) { g.positions[i] *= scale; g.positions[i + 2] *= scale; }
    for (let i = 0; i < g.wind.length; i += 4) { g.wind[i] *= scale; g.wind[i + 2] *= scale; }
  }
  return { leaves, branches, name: tree.name };
}
