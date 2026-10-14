import * as THREE from "three";
import data from "./stylized-trees.data.json";

export type TreePlacement = {
  x: number;
  z: number;
  /** Tree height in world units: all bundled variants are grounded and one unit tall. */
  scale: number;
  turn: number;
  lift?: number;
  variant?: "round" | "cluster";
};
type Part = { role: string; positions: number[]; normals: number[]; colors: number[]; indices: number[] };
const models = data as Record<"round" | "cluster", { parts: Part[] }>;

/** Two CC0 KayKit broadleaf trees, with the original atlas baked offline to vertex colors. */
export function createStylizedTrees(placements: readonly TreePlacement[], groundY: number) {
  const root = new THREE.Group();
  root.name = "stylized-trees";
  const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const batches: { mesh: THREE.InstancedMesh; placements: readonly TreePlacement[]; foliage: boolean }[] = [];
  const transform = new THREE.Object3D();
  let disposed = false;
  for (const variant of ["round", "cluster"] as const) {
    const trees = placements.filter((item, i) => (item.variant ?? (i % 2 ? "round" : "cluster")) === variant);
    if (!trees.length) continue;
    for (const part of models[variant].parts) {
      const surface = new THREE.BufferGeometry();
      surface.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
      surface.setAttribute("normal", new THREE.Float32BufferAttribute(part.normals, 3));
      surface.setAttribute("color", new THREE.Float32BufferAttribute(part.colors, 3));
      surface.setIndex(part.indices);
      surface.computeBoundingBox(); surface.computeBoundingSphere();
      geometry.add(surface);
      const foliage = part.role === "leaves";
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, metalness: 0, envMapIntensity: .45 });
      material.name = `KayKit ${variant} ${part.role}`;
      materials.add(material);
      const mesh = new THREE.InstancedMesh(surface, material, trees.length);
      mesh.name = `trees-${variant}-${part.role}`;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.toonSurface = { outline: false, shading: "smooth" };
      mesh.userData.treeRole = part.role;
      if (foliage) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      trees.forEach((item, i) => {
        transform.position.set(item.x, groundY + .014 + (item.lift ?? 0), item.z);
        transform.rotation.set(0, item.turn, 0); transform.scale.setScalar(item.scale); transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
        // Small deterministic tint shifts keep repeated silhouettes from reading as clones.
        const variation = .95 + .05 * (.5 + .5 * Math.sin(item.x * 1.7 + item.z * .9));
        mesh.setColorAt(i, foliage ? new THREE.Color(variation, 1, .96) : new THREE.Color(1, 1, 1));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      if (mesh.boundingSphere) mesh.boundingSphere.radius += Math.max(...trees.map(item => item.scale)) * .015;
      batches.push({ mesh, placements: trees, foliage }); root.add(mesh);
    }
  }
  return {
    root,
    update(time: number, reducedMotion = false) {
      if (disposed) return;
      for (const batch of batches) {
        if (!batch.foliage) continue;
        batch.placements.forEach((item, i) => {
          const phase = item.x * .61 + item.z * .37;
          const breeze = reducedMotion ? 0 : Math.sin(time * .72 + phase) * .0035 + Math.sin(time * 1.13 + phase * 1.8) * .001;
          transform.position.set(item.x + breeze * item.scale, groundY + .014 + (item.lift ?? 0), item.z + breeze * item.scale * .55);
          transform.rotation.set(0, item.turn, 0); transform.scale.setScalar(item.scale); transform.updateMatrix();
          batch.mesh.setMatrixAt(i, transform.matrix);
        });
        batch.mesh.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      batches.forEach(({ mesh }) => mesh.dispose());
      geometry.forEach(item => item.dispose());
      materials.forEach(item => item.dispose());
      root.clear();
    },
  };
}
