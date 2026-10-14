import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createStylizedMeadow } from "./stylized-meadow";

describe("a small windswept meadow", () => {
  it.each(["garden", "courtyard", "veranda", "river", "table"] as const)("keeps %s interaction space and built surfaces free of grass", kind => {
    const meadow = createStylizedMeadow({ kind, floor: 0, id: "meadow-test" });
    const mesh = meadow.mesh, matrix = new THREE.Matrix4(), point = new THREE.Vector3();
    expect(mesh.count).toBeGreaterThan(1000);
    expect(mesh.count).toBeLessThan(8000);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix); point.setFromMatrixPosition(matrix);
      expect(Math.abs(point.x) < 2.2 && point.z > -2.2 && point.z < 3.2).toBe(false);
      if (kind === "river") expect(Math.abs(point.x)).toBeGreaterThan(2.65);
      if (kind === "veranda") expect(Math.abs(point.x) < 6.2 && point.z > -2.8).toBe(false);
    }
    meadow.dispose();
  });

  it("does not grow new instances during animation and releases all owned resources exactly once", () => {
    const meadow = createStylizedMeadow({ kind: "garden", floor: -.04, id: "spring" });
    const parent = new THREE.Group(); parent.add(meadow.mesh);
    const releases = [meadow.mesh, meadow.mesh.geometry, meadow.mesh.material, meadow.groundMap].map(resource => vi.spyOn(resource, "dispose"));
    const original = meadow.mesh.instanceMatrix.array.slice();
    meadow.update(1); meadow.update(5);
    expect(meadow.mesh.instanceMatrix.array).toEqual(original);
    meadow.dispose(); meadow.dispose();
    expect(parent.children).toHaveLength(0);
    releases.forEach(release => expect(release).toHaveBeenCalledOnce());
  });
});
