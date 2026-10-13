import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createCozyEnvironment } from "./cozy-environment";

describe("a scene's surrounding world", () => {
  it.each([
    ["barcelos-clay-rooster", "veranda"],
    ["finnish-birch-basket", "veranda"],
    ["croatian-licitar-heart", "courtyard"],
    ["catalan-festival-giant", "courtyard"],
    ["sorbian-painted-egg", "veranda"],
    ["basque-sunflower", "courtyard"],
    ["breton-banner", "courtyard"],
    ["lithuanian-straw-garden", "veranda"],
    ["dalarna-wooden-horse", "veranda"], ["aland-votive-ship", "veranda"],
    ["blang-tea", "garden"], ["minangkabau-spinning-top", "courtyard"],
    ["chinese-incense", "courtyard"], ["hongsheng-red-string", "veranda"],
    ["italian-ex-voto", "veranda"], ["czech-pilgrim-journal", "garden"],
    ["omikuji", "courtyard"], ["polish-blessing-basket", "veranda"],
    ["navruz-sumalak", "courtyard"], ["floating-lantern-loy-krathong", "river"],
  ])("grounds %s in its local environment and releases its sky", async (id, kind) => {
    const scene = new THREE.Scene(), sky = new THREE.DataTexture(), released = vi.spyOn(sky, 'dispose');
    const environment = createCozyEnvironment(scene, { id, loadSky: async () => sky });
    expect(environment).not.toBeNull(); await environment!.ready;
    expect(scene.getObjectByName('cozy-environment')!.userData.environment).toBe(kind);
    environment!.dispose(); expect(released).toHaveBeenCalledOnce(); expect(scene.children).toHaveLength(0);
  });
  it("keeps a usable world when its bundled sky cannot load", async () => {
    const scene = new THREE.Scene();
    const world = createCozyEnvironment(scene, {
      id: "celtic-folk-spring", loadSky: async () => { throw Error("offline"); },
    });
    await world!.ready;
    expect(scene.background).toBeInstanceOf(THREE.Color);
    expect(scene.children.some(object => object.name === "cozy-environment")).toBe(true);
    world!.dispose();
    expect(scene.children).toHaveLength(0);
    expect(scene.background).toBeNull();
  });

  it("releases a sky arriving after the user has left instead of remounting it", async () => {
    let resolve!: (texture: THREE.DataTexture) => void;
    const sky = new THREE.DataTexture();
    const released = vi.fn();
    sky.addEventListener("dispose", released);
    const scene = new THREE.Scene();
    const original = new THREE.Color(0xffffff);
    scene.background = original;
    const world = createCozyEnvironment(scene, {
      id: "lantern", loadSky: () => new Promise(resolveSky => { resolve = resolveSky; }),
    });
    world!.dispose();
    resolve(sky);
    await world!.ready;
    expect(scene.background).toBe(original);
    expect(scene.environment).toBeNull();
    expect(scene.children).toHaveLength(0);
    expect(released).toHaveBeenCalledOnce();
  });

  it("releases loaded textures and geometry only once, restoring the host's scene", async () => {
    const scene = new THREE.Scene();
    const sky = new THREE.DataTexture();
    const released = vi.fn();
    sky.addEventListener("dispose", released);
    const world = createCozyEnvironment(scene, { id: "woodfish", loadSky: async () => sky });
    await world!.ready;
    const geometryReleased = vi.fn();
    scene.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.addEventListener("dispose", geometryReleased);
    });
    expect(scene.background).toBe(sky);
    world!.dispose();
    const releasedCount = geometryReleased.mock.calls.length;
    world!.dispose();
    expect(releasedCount).toBeGreaterThan(0);
    expect(geometryReleased).toHaveBeenCalledTimes(releasedCount);
    expect(released).toHaveBeenCalledOnce();
    expect(scene.background).toBeNull();
    expect(scene.environment).toBeNull();
  });

  it("leaves an unrelated content engine's environment alone", () => {
    const scene = new THREE.Scene();
    const background = new THREE.Color(0x123456);
    scene.background = background;
    expect(createCozyEnvironment(scene, { id: "third-party-engine" })).toBeNull();
    expect(scene.background).toBe(background);
    expect(scene.children).toHaveLength(0);
  });

  it("keeps lighting consistent after a content pack arrives, without resetting animated lamp glow", async () => {
    const scene = new THREE.Scene();
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    const lamp = new THREE.PointLight(0xffaa44, 0);
    scene.add(key, lamp);
    const world = createCozyEnvironment(scene, { id: "woodfish", loadSky: async () => new THREE.DataTexture() });
    const renderer = { shadowMap: { enabled: false, type: THREE.PCFShadowMap } } as THREE.WebGLRenderer;
    world!.prepare(renderer);
    const intensity = key.intensity;
    key.intensity = 3.2; // A late content pack restores its own lighting parameters.
    lamp.intensity = 0.7;
    world!.prepare(renderer);
    expect(key.intensity).toBe(intensity);
    expect(lamp.intensity).toBe(0.7);
    await world!.ready;
    world!.dispose();
  });
});
