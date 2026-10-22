import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createCozyEnvironment } from "./cozy-environment";

describe("a scene's surrounding world", () => {
  it("softens daylight in gouache and restores the existing rig on switching back", async () => {
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(), ambient = new THREE.AmbientLight(), sky = new THREE.HemisphereLight();
    const lamp = new THREE.PointLight(0xffaa44, .7);
    scene.add(sun, ambient, sky, lamp);
    const world = createCozyEnvironment(scene, { id: "dalarna-wooden-horse", loadSky: async () => new THREE.DataTexture() })!;
    const renderer = { shadowMap: { enabled: false, type: THREE.PCFShadowMap } } as THREE.WebGLRenderer;
    world.prepare(renderer);
    const original = { sun: sun.intensity, ambient: ambient.intensity, sky: sky.intensity };
    world.prepare(renderer, "gouache");
    expect(sun.intensity).toBeLessThan(original.sun);
    expect(sky.intensity).toBeGreaterThan(original.sky);
    expect(renderer.shadowMap.type).toBe(THREE.PCFSoftShadowMap);
    expect(lamp.intensity).toBe(.7);
    world.prepare(renderer, "toon-soft");
    expect({ sun: sun.intensity, ambient: ambient.intensity, sky: sky.intensity }).toEqual(original);
    await world.ready; world.dispose();
  });
  it("leaves a real opening below the clear spring while keeping its bank solid", async () => {
    const scene = new THREE.Scene();
    const world = createCozyEnvironment(scene, { id: "celtic-folk-spring", loadSky: async () => new THREE.DataTexture() })!;
    scene.updateMatrixWorld(true);
    const ground = scene.getObjectByName("meadow-ground")!, path = scene.getObjectByName("garden-path")!;
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObjects([ground, path])).toHaveLength(0);
    ray.ray.origin.x = 1.8;
    expect(ray.intersectObjects([ground, path]).length).toBeGreaterThan(0);
    await world.ready; world.dispose();
  });
  it.each(["shinto-torii", "celtic-folk-spring", "woodfish", "slavic-wreath", "zeniarai-coin-washing"])("keeps the added garden clear of the interaction space and releases its instance buffers: %s", async id => {
    const scene = new THREE.Scene();
    const world = createCozyEnvironment(scene, { id, loadSky: async () => new THREE.DataTexture() })!;
    const planting = scene.getObjectByName("daylight-planting");
    expect(planting).toBeDefined();
    scene.updateMatrixWorld(true);
    const protectedSpace = new THREE.Box3(new THREE.Vector3(-1.85, -.2, -1.2), new THREE.Vector3(1.85, 5.2, 2.2));
    const batches: THREE.InstancedMesh[] = [], release = vi.fn();
    planting!.traverse(object => {
      if (!(object instanceof THREE.InstancedMesh)) return;
      batches.push(object); object.addEventListener("dispose", release);
      object.geometry.computeBoundingBox();
      for (let i = 0; i < object.count; i++) {
        const matrix = new THREE.Matrix4(); object.getMatrixAt(i, matrix); matrix.premultiply(object.matrixWorld);
        const bounds = object.geometry.boundingBox!.clone().applyMatrix4(matrix);
        expect(bounds.intersectsBox(protectedSpace), object.name).toBe(false);
      }
    });
    expect(batches.length).toBeGreaterThan(0);
    expect(batches.length).toBeLessThan(36);
    await world.ready; world.dispose(); world.dispose();
    expect(release).toHaveBeenCalledTimes(batches.length);
  });

  it("keeps the daylight backdrop stable when the local lighting panorama arrives", async () => {
    let resolve!: (texture: THREE.DataTexture) => void;
    const scene = new THREE.Scene();
    const world = createCozyEnvironment(scene, { id: "woodfish", loadSky: () => new Promise(done => { resolve = done; }) });
    const backdrop = scene.background;
    expect(backdrop).toBeInstanceOf(THREE.DataTexture);
    const sky = new THREE.DataTexture();
    resolve(sky); await world!.ready;
    expect(scene.background).toBe(backdrop);
    expect(scene.environment).toBe(sky);
    world!.dispose();
  });

  it("releases its generated daylight backdrop even if the lighting panorama arrives after leaving", async () => {
    let resolve!: (texture: THREE.DataTexture) => void;
    const scene = new THREE.Scene();
    const original = new THREE.Color(0x123456);
    scene.background = original;
    const world = createCozyEnvironment(scene, { id: "crane", loadSky: () => new Promise(done => { resolve = done; }) });
    expect(scene.background).toBeInstanceOf(THREE.DataTexture);
    const releasedBackdrop = vi.spyOn(scene.background as THREE.DataTexture, "dispose");
    world!.dispose(); world!.dispose();
    const sky = new THREE.DataTexture(), releasedSky = vi.spyOn(sky, "dispose");
    resolve(sky); await world!.ready;
    expect(releasedBackdrop).toHaveBeenCalledOnce();
    expect(releasedSky).toHaveBeenCalledOnce();
    expect(scene.background).toBe(original);
    expect(scene.environment).toBeNull();
  });

  it.each([
    ["fijian-woven-fan", "veranda"],
    ["polish-paper-cut", "veranda"],
    ["faroese-wool-knit", "veranda"],
    ["malawi-sansi", "garden"],
    ["japanese-kendama", "garden"],
    ["japanese-koinobori", "garden"],
    ["russian-matryoshka", "garden"],
    ["korean-yutnori", "garden"],
    ["chinese-diabolo", "garden"],
    ["indian-charkha", "garden"],
    ["german-nutcracker", "garden"],
    ["mexican-molinillo", "garden"],
    ["chinese-suanpan", "garden"],
    ["mongolian-felt-ger", "garden"],
    ["peruvian-engraved-gourd", "garden"],
    ["venetian-glass-bead", "veranda"],
    ["korean-bojagi-wrap", "veranda"],
    ["vietnamese-bamboo-dragonfly", "garden"],
    ["turkish-ebru-paper", "veranda"],
    ["indonesian-angklung", "veranda"],
    ["weifang-paper-kite", "garden"],
    ["chinese-shadow-puppet", "courtyard"],
    ["niue-shell-necklace", "veranda"],
    ["uzbek-clay-bowl", "veranda"],
    ["chinese-woodblock-print", "veranda"],
    ["czech-bead-star", "veranda"],
    ["amazigh-woven-rug", "courtyard"],
    ["slovak-wire-bird", "veranda"],
    ["hungarian-embroidery-hoop", "veranda"],
    ["andalusian-ceramic-tile", "courtyard"],
    ["sicilian-painted-cart", "courtyard"],
    ["bai-indigo-cloth", "veranda"],
    ["ndebele-painted-house", "courtyard"],
    ["purepecha-copper-bowl", "veranda"],
    ["welsh-love-spoon", "veranda"],
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
    expect(scene.background).toBeInstanceOf(THREE.DataTexture);
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
    expect(scene.environment).toBe(sky);
    expect(scene.background).not.toBe(sky);
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

  it.each(["faroese-wool-knit", "shinto-torii"])("gives %s a dominant, consistent sun instead of evenly filling its shadows", async id => {
    const scene = new THREE.Scene();
    const ambient = new THREE.AmbientLight(), sky = new THREE.HemisphereLight();
    const sun = new THREE.DirectionalLight(), fill = new THREE.DirectionalLight();
    sun.position.set(3, 2, -4);
    scene.add(ambient, sky, sun, fill);
    const world = createCozyEnvironment(scene, { id, loadSky: async () => new THREE.DataTexture() })!;
    const renderer = { shadowMap: { enabled: false, type: THREE.PCFSoftShadowMap } } as THREE.WebGLRenderer;
    world.prepare(renderer);
    expect(sun.intensity).toBeGreaterThan(3 * (ambient.intensity + sky.intensity + fill.intensity));
    expect(sun.position.x).toBeLessThan(-2);
    expect(sun.position.y).toBeGreaterThan(sun.position.z);
    expect(sun.position.z).toBeGreaterThan(0);
    expect(sun.castShadow).toBe(true); expect(fill.castShadow).toBe(false);
    expect(renderer.shadowMap.enabled).toBe(true);
    const direction = sun.position.clone().normalize();
    sun.position.set(-1, 1, -8); sun.intensity = .1;
    world.prepare(renderer);
    expect(sun.position.clone().normalize().distanceTo(direction)).toBeLessThan(.0001);
    expect(sun.intensity).toBeGreaterThan(3 * (ambient.intensity + sky.intensity + fill.intensity));
    await world.ready; world.dispose();
  });

  it.each(["diya-oil-lamp", "votive-candle-catholic", "lantern", "yeondeunghoe", "chinese-shadow-puppet"])("preserves the night rig and animated flame in %s", async id => {
    const scene = new THREE.Scene();
    const key = new THREE.DirectionalLight(), lamp = new THREE.PointLight(0xffaa44, .73);
    key.position.set(2, 4, -3);
    scene.add(key, lamp);
    const world = createCozyEnvironment(scene, { id, loadSky: async () => new THREE.DataTexture() })!;
    const renderer = { shadowMap: { enabled: false, type: THREE.PCFSoftShadowMap } } as THREE.WebGLRenderer;
    world.prepare(renderer);
    expect(key.position.toArray()).toEqual([2, 4, -3]);
    expect(key.intensity).toBeLessThan(1.5);
    expect(lamp.intensity).toBe(.73);
    lamp.intensity = .26; world.prepare(renderer);
    expect(lamp.intensity).toBe(.26);
    await world.ready; world.dispose();
  });
});

it('keeps the undama coastal horizon free of a river garden and disposes it',async()=>{const s=new THREE.Scene(),env=createCozyEnvironment(s,{id:'udo-undama',loadSky:async()=>new THREE.DataTexture()});expect(env).not.toBeNull();await env!.ready;expect(s.getObjectByName('daylight-planting')).toBeUndefined();expect(s.getObjectByName('stylized-meadow')).toBeUndefined();env!.dispose();expect(s.children).toHaveLength(0)})

it('keeps the complete Chinowa walking corridor clear of surrounding solids',async()=>{
 const scene=new THREE.Scene(),world=createCozyEnvironment(scene,{id:'chinowa-kuguri',loadSky:async()=>new THREE.DataTexture()});expect(world).not.toBeNull();scene.updateMatrixWorld(true)
 const corridor=new THREE.Box3(new THREE.Vector3(-3.65,.05,-1.4),new THREE.Vector3(3.65,2.6,10)),planting=scene.getObjectByName('daylight-planting')!;expect(planting).toBeDefined()
 planting.traverse(o=>{const m=o as THREE.InstancedMesh;if(!m.isInstancedMesh)return;m.geometry.computeBoundingBox();for(let i=0;i<m.count;i++){const matrix=new THREE.Matrix4();m.getMatrixAt(i,matrix);matrix.premultiply(m.matrixWorld);expect(m.geometry.boundingBox!.clone().applyMatrix4(matrix).intersectsBox(corridor),m.name).toBe(false)}})
 await world!.ready;world!.dispose()
})
