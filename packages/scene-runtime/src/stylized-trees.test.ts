import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createStylizedTrees } from "./stylized-trees";

const placements = [
  { x: -5.4, z: -6.9, scale: 2.7, turn: .8 },
  { x: 5.9, z: -7.8, scale: 3.2, turn: 2.4 },
  { x: -8.4, z: -12, scale: 4, turn: 1.2 },
];

describe("the bundled broadleaf trees", () => {
  it("grounds the source trunks, keeps crowns out of the interaction area and batches repeated variants", () => {
    const trees = createStylizedTrees(placements, -.04), scene = new THREE.Scene(); scene.add(trees.root); scene.updateMatrixWorld(true);
    const protectedSpace = new THREE.Box3(new THREE.Vector3(-1.85, -.2, -1.2), new THREE.Vector3(1.85, 5.2, 2.2));
    expect(trees.root.children).toHaveLength(4);
    const bounds: THREE.Box3[] = [];
    trees.root.traverse(object => {
      if (!(object instanceof THREE.InstancedMesh)) return;
      expect(object.userData.toonSurface).toEqual({ outline: false, shading: "smooth" });
      expect(object.geometry.getAttribute("color")).toBeDefined();
      for (let i = 0; i < object.count; i++) {
        const matrix = new THREE.Matrix4(); object.getMatrixAt(i, matrix);
        const box = object.geometry.boundingBox!.clone().applyMatrix4(matrix);
        expect(box.intersectsBox(protectedSpace)).toBe(false);
        if (object.userData.treeRole === "wood") expect(box.min.y).toBeCloseTo(-.026, 6);
        bounds.push(box);
      }
    });
    expect(bounds).toHaveLength(placements.length * 2);
    trees.dispose();
  });

  it("moves only canopies and returns them to rest when reduced motion is enabled", () => {
    const trees = createStylizedTrees(placements, 0);
    const original = trees.root.children.map(object => Array.from((object as THREE.InstancedMesh).instanceMatrix.array));
    trees.update(3.2);
    trees.root.children.forEach((object, index) => {
      const mesh = object as THREE.InstancedMesh, actual = Array.from(mesh.instanceMatrix.array);
      if (mesh.userData.treeRole === "wood") expect(actual).toEqual(original[index]);
      else {
        expect(actual).not.toEqual(original[index]);
        for (let i = 0; i < mesh.count; i++) {
          expect(actual[i * 16 + 13]).toBe(original[index][i * 16 + 13]);
          expect(Math.abs(actual[i * 16 + 12] - original[index][i * 16 + 12])).toBeLessThan(.02);
        }
      }
    });
    trees.update(100, true);
    trees.root.children.forEach((object, index) => expect(Array.from((object as THREE.InstancedMesh).instanceMatrix.array)).toEqual(original[index]));
    trees.dispose();
  });

  it("releases every instance buffer, geometry and material exactly once without sharing across mounts", () => {
    const first = createStylizedTrees(placements, 0), other = createStylizedTrees(placements, 0), scene = new THREE.Scene();
    scene.add(first.root); const disposals = vi.fn();
    const firstMesh = first.root.children[0] as THREE.InstancedMesh, otherMesh = other.root.children[0] as THREE.InstancedMesh;
    expect(firstMesh.geometry).not.toBe(otherMesh.geometry); expect(firstMesh.material).not.toBe(otherMesh.material);
    first.root.children.forEach(object => {
      const mesh = object as THREE.InstancedMesh;
      mesh.addEventListener("dispose", disposals); mesh.geometry.addEventListener("dispose", disposals);
      (mesh.material as THREE.Material).addEventListener("dispose", disposals);
    });
    first.dispose(); first.dispose(); first.update(10);
    expect(disposals).toHaveBeenCalledTimes(12); expect(scene.children).toHaveLength(0); expect(other.root.children).toHaveLength(4);
    other.dispose();
  });
});
