import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createStylizedMeadow } from "./stylized-meadow";
import {
  courtyardPathCenterX,
  courtyardPathEdgeLateral,
  courtyardPathHalfWidth,
  courtyardPathT,
  isInsideCourtyardStonePath,
} from "./courtyard-stone-path";
import { isInsideGardenPaving } from "./garden-courtyard-paving";

describe("a small windswept meadow", () => {
  it.each(["garden", "courtyard", "veranda", "river", "table"] as const)("keeps %s interaction space and built surfaces free of grass", kind => {
    const meadow = createStylizedMeadow({ kind, floor: 0, id: "meadow-test" });
    const mesh = meadow.mesh, matrix = new THREE.Matrix4(), point = new THREE.Vector3();
    expect(mesh.count).toBeGreaterThan(1000);
    expect(mesh.count).toBeLessThan(8000);
    let closeBayTufts = 0;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix); point.setFromMatrixPosition(matrix);
      expect(Math.abs(point.x) < 2.2 && point.z > -2.2 && point.z < 3.2).toBe(false);
      if (kind === "river") expect(Math.abs(point.x)).toBeGreaterThan(2.65);
      if (kind === "veranda") expect(Math.abs(point.x) < 6.2 && point.z > -2.8).toBe(false);
      if (kind === "garden") expect(isInsideGardenPaving(point.x, point.z, 0.14)).toBe(false);
      if (kind === "courtyard") {
        expect(isInsideCourtyardStonePath(point.x, point.z, 0.09)).toBe(false);
        const t = courtyardPathT(point.z), center = courtyardPathCenterX(t), half = courtyardPathHalfWidth(t);
        const side: -1 | 1 = point.x >= center ? 1 : -1;
        const maxLocalEdge = Math.abs(courtyardPathEdgeLateral(t, side));
        if (point.z < -2.4 && Math.abs(point.x - center) < half + 0.34 && Math.abs(point.x - center) > maxLocalEdge) {
          closeBayTufts++;
        }
      }
    }
    if (kind === "courtyard") {
      // Grass organically tucks into concave stone-path bays rather than stopping at a uniform outer wall.
      expect(closeBayTufts).toBeGreaterThan(4);
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
