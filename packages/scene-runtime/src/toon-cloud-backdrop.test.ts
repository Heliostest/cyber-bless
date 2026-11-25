import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createToonCloudBackdrop } from "./toon-cloud-backdrop";

describe("viewport-anchored distant clouds", () => {
  it("fits the logical viewport on every render, independently of device pixel ratio", () => {
    const clouds = createToonCloudBackdrop();
    const layer = clouds.root.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 40), scene = new THREE.Scene();
    const size = new THREE.Vector2(350, 480);
    const renderer = { getSize: (target: THREE.Vector2) => target.copy(size) } as THREE.WebGLRenderer;
    try {
      layer.onBeforeRender(renderer, scene, camera, layer.geometry, layer.material, null as never);
      expect(layer.material.uniforms.uViewport?.value).toEqual(new THREE.Vector2(350, 480));
      size.set(1280, 600);
      layer.onBeforeRender(renderer, scene, camera, layer.geometry, layer.material, null as never);
      expect(layer.material.uniforms.uViewport?.value).toEqual(size);
      // Resizing must not advance animation or replace the mounted GPU resources.
      expect(layer.material.uniforms.uTime.value).toBe(0);
      const geometry = layer.geometry, material = layer.material;
      clouds.update(12);
      size.set(284, 320);
      layer.onBeforeRender(renderer, scene, camera, layer.geometry, layer.material, null as never);
      expect(layer.geometry).toBe(geometry); expect(layer.material).toBe(material);
      expect(layer.material.uniforms.uTime.value).toBe(12);
    } finally { clouds.dispose(); }
  });

  it("keeps a finite layout through zero-size mounts and releases fitted resources once", () => {
    const clouds = createToonCloudBackdrop();
    const layer = clouds.root.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    const renderer = { getSize: (target: THREE.Vector2) => target.set(0, 0) } as THREE.WebGLRenderer;
    const geometry = vi.spyOn(layer.geometry, "dispose"), material = vi.spyOn(layer.material, "dispose");
    layer.onBeforeRender(renderer, new THREE.Scene(), new THREE.Camera(), layer.geometry, layer.material, null as never);
    expect(layer.material.uniforms.uViewport?.value.x).toBeGreaterThan(0);
    expect(Number.isFinite(layer.material.uniforms.uCeiling?.value)).toBe(true);
    clouds.dispose(); clouds.dispose();
    expect(geometry).toHaveBeenCalledOnce(); expect(material).toHaveBeenCalledOnce();
  });

  it("attaches display-referred Komorebi daylight shade parameters only on day clouds", () => {
    const day = createToonCloudBackdrop("day");
    const night = createToonCloudBackdrop("night");
    try {
      const dayLayers = day.root.children as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[];
      const nightLayers = night.root.children as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[];
      expect(dayLayers).toHaveLength(6);
      dayLayers.forEach(layer => {
        expect(layer.material.uniforms.uShadeAmount?.value).toBe(0);
        expect(layer.material.uniforms.uShade?.value).toBeInstanceOf(THREE.Color);
        expect(layer.material.uniforms.uShadeRange?.value).toEqual(new THREE.Vector2(6, 42));
        const daylight = layer.material.userData.komorebiDaylight;
        expect(daylight).toBeDefined();
        expect(daylight.amount).toBeGreaterThan(0);
        // Base shade stays darker than its sunlit crest on every band.
        expect(daylight.shade.r).toBeLessThan(daylight.color.r);
        expect(daylight.shade.g).toBeLessThan(daylight.color.g);
        expect(daylight.shade.b).toBeLessThan(daylight.color.b);
      });
      // Near crest is brighter than the farthest distant crest.
      expect(dayLayers[5]!.material.userData.komorebiDaylight.color.r)
        .toBeGreaterThan(dayLayers[0]!.material.userData.komorebiDaylight.color.r);
      nightLayers.forEach(layer => {
        expect(layer.material.uniforms.uShadeAmount?.value).toBe(0);
        expect(layer.material.userData.komorebiDaylight).toBeUndefined();
      });
    } finally {
      day.dispose();
      night.dispose();
    }
  });
});
