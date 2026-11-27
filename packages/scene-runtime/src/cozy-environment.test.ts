import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createCozyEnvironment as createEnvironment } from "./cozy-environment";
import { getEnvironmentRiverbedY, getEnvironmentSurfaceY } from "./environment-profiles";
import * as sceneMotion from "./scene-motion";
import { builtInScenes, isSceneVisibleInApp } from "@wbr/core/daily-scenes";

// Unit tests supply local trees; actual bundled GLBs are covered by the browser audit.
const createCozyEnvironment: typeof createEnvironment = (scene, options) => createEnvironment(scene, {
  ...options, loadTree: options.loadTree ?? (async () => {
    const root = new THREE.Group(); root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial())); return root;
  }),
});

describe("a scene's surrounding world", () => {
  it.each(['woodfish', 'shinto-torii', 'neapolitan-cornicello', 'diya-oil-lamp', 'yeondeunghoe'])('retires KayKit stylized-trees completely, even when imported assets fail: %s', async id => {
    const scene = new THREE.Scene(), loadTree = vi.fn(async () => { throw Error('unavailable'); });
    const world = createCozyEnvironment(scene, { id, loadTree, loadSky: async () => new THREE.DataTexture() })!;
    try {
      await world.ready;
      expect(loadTree).toHaveBeenCalled();
      expect(scene.getObjectByName('stylized-trees')).toBeUndefined();
      expect(scene.getObjectByName('trees-round-leaves')).toBeUndefined();
      expect(scene.getObjectByName('trees-cluster-leaves')).toBeUndefined();
    } finally { world.dispose(); }
  });
  it.each(['shinto-torii', 'neapolitan-cornicello', 'woodfish', 'diya-oil-lamp'])('keeps far garden placements and full contact-shadow strength on production defaults, softening shadows only for explicit debug previews: %s', async id => {
    const camera = new THREE.PerspectiveCamera(42, 1.5, .1, 100);
    camera.position.set(0, 1.45, 7.6); camera.lookAt(0, 1.55, 0); camera.updateMatrixWorld(true);
    const scene = new THREE.Scene(), sun = new THREE.DirectionalLight(); sun.shadow.intensity = .8; scene.add(sun);
    const world = createCozyEnvironment(scene, { id, camera, loadSky: async () => new THREE.DataTexture(), loadTree: async () => {
      const model = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ alphaTest: .5 }));
      mesh.position.y = 1; model.add(mesh); return model;
    } })!;
    const renderer = { shadowMap: { enabled: false, type: THREE.PCFShadowMap } } as THREE.WebGLRenderer;
    await world.ready;
    world.prepare(renderer);
    const defaultRadius = sun.shadow.radius;
    // Production default must never halve main shadow intensity or blur radius to 12.
    expect(sun.shadow.intensity).toBeCloseTo(.8);
    expect(defaultRadius).toBeLessThan(12);
    // Production default trees stay at far authored z <= -6.5 (no camera-aware treePreviewLayout).
    const baseline = scene.getObjectByName('recommended-environment-trees')!;
    expect(baseline.children.length).toBeGreaterThan(0);
    baseline.traverse(obj => {
      if (!(obj instanceof THREE.InstancedMesh)) return;
      const m = new THREE.Matrix4(), p = new THREE.Vector3();
      for (let i = 0; i < obj.count; i++) {
        obj.getMatrixAt(i, m); p.setFromMatrixPosition(m);
        expect(p.z).toBeLessThanOrEqual(-6.4);
      }
    });
    // Explicit debug preview softens shadows temporarily and restores full strength for captures & reset.
    await world.setTreeMethod('cherry'); world.prepare(renderer);
    expect(sun.shadow.intensity).toBeCloseTo(.8 * .52); expect(sun.shadow.radius).toBe(12);
    const restore = world.captureDefaultTrees(); world.prepare(renderer);
    expect(sun.shadow.intensity).toBeCloseTo(.8); expect(sun.shadow.radius).toBe(defaultRadius);
    restore?.(); world.prepare(renderer); expect(sun.shadow.intensity).toBeCloseTo(.8 * .52);
    await world.setTreeMethod('scene'); world.prepare(renderer);
    expect(sun.shadow.intensity).toBeCloseTo(.8); expect(sun.shadow.radius).toBe(defaultRadius);
    world.dispose(); expect(sun.shadow.intensity).toBe(.8); expect(sun.shadow.radius).toBe(defaultRadius);
  });
  it('keeps scene trees as the default and loads both Komorebi variants only when selected', async () => {
    const scene = new THREE.Scene(), loadTree = vi.fn(async () => {
      const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial());
      mesh.position.y = 1; root.add(mesh); return root;
    });
    const world = createCozyEnvironment(scene, { id: 'shinto-torii', loadTree, loadSky: async () => new THREE.DataTexture() })!;
    expect(world.treeRecommendation).toBe('cherry'); expect(loadTree).toHaveBeenCalledTimes(2);
    await world.ready;
    expect(loadTree).toHaveBeenCalledWith('/environments/trees/simple-tree/cherry-round.glb');
    expect(loadTree).toHaveBeenCalledWith('/environments/trees/simple-tree/cherry-cluster.glb');
    await world.setTreeMethod('komorebi');
    expect(loadTree).toHaveBeenCalledTimes(4);
    expect(loadTree).toHaveBeenCalledWith('/environments/trees/komorebi/round.glb');
    expect(loadTree).toHaveBeenCalledWith('/environments/trees/komorebi/cluster.glb');
    await world.setTreeMethod('scene'); expect(loadTree).toHaveBeenCalledTimes(4);
    await world.ready; world.dispose();
  });
  it.each(['woodfish', 'diya-oil-lamp'])('switches only environment trees in day and night without rebuilding the scene: %s', async id => {
    const scene = new THREE.Scene(), subject = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    subject.name = 'cultural-subject'; scene.add(subject);
    const loadTree = vi.fn(async () => {
      const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial());
      mesh.position.y = 1; root.add(mesh); return root;
    });
    const report = vi.fn(), world = createCozyEnvironment(scene, { id, loadTree, onTrees: report, loadSky: async () => new THREE.DataTexture() })!;
    const originalRoot = scene.getObjectByName('cozy-environment');
    expect(world.treeCount).toBeGreaterThan(0);
    await world.ready; expect(loadTree).toHaveBeenCalledTimes(2);
    await world.setTreeMethod('quaternius');
    expect(report).toHaveBeenLastCalledWith({ count: world.treeCount, actual: 'quaternius', status: 'ready' });
    expect(scene.getObjectByName('alternative-environment-trees')!.children.length).toBeGreaterThan(0);
    expect(scene.getObjectByName('cozy-environment')).toBe(originalRoot); expect(subject.visible).toBe(true);
    await world.setTreeMethod('scene'); expect(scene.getObjectByName('alternative-environment-trees')!.children).toHaveLength(0);
    expect(report).toHaveBeenLastCalledWith({ count: world.treeCount, actual: 'scene', status: 'ready' });
    await world.ready; world.dispose(); expect(subject.parent).toBe(scene);
    subject.geometry.dispose(); (subject.material as THREE.Material).dispose();
  });
  it("keeps the workbench clear and reduces far haze only in the shared daylight scenes", async () => {
    const day = new THREE.Scene(), coast = new THREE.Scene();
    const worlds = [
      createCozyEnvironment(day, { id: "furin-wind-chime", loadSky: async () => new THREE.DataTexture() })!,
      createCozyEnvironment(coast, { id: "udo-undama", loadSky: async () => new THREE.DataTexture() })!,
    ];
    try {
      const daylight = day.fog as THREE.Fog, preserved = coast.fog as THREE.Fog;
      expect(THREE.MathUtils.smoothstep(8, daylight.near, daylight.far)).toBe(0);
      const distantHaze = THREE.MathUtils.smoothstep(40, daylight.near, daylight.far);
      expect(distantHaze).toBeGreaterThan(0);
      expect(distantHaze).toBeLessThan(.3);
      expect(THREE.MathUtils.smoothstep(40, preserved.near, preserved.far)).toBeGreaterThan(.5);
      await Promise.all(worlds.map(world => world.ready));
    } finally { worlds.forEach(world => world.dispose()); }
  });

  it.each(["tibetan-prayer-flags", "japanese-koinobori", "tanzaku-tanabata"])("owns distant clouds without intercepting object input: %s", async id => {
    const scene = new THREE.Scene();
    const world = createCozyEnvironment(scene, { id, loadSky: async () => new THREE.DataTexture() })!;
    try {
      const clouds = scene.getObjectByName("toon-cloud-backdrop");
      expect(clouds).toBeDefined();
      scene.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 25, 5), new THREE.Vector3(0, 0, -1));
      expect(ray.intersectObject(clouds!, true)).toHaveLength(0);
      const released = new Set<THREE.BufferGeometry | THREE.Material>();
      clouds!.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (const resource of [object.geometry, object.material as THREE.Material]) released.add(resource);
      });
      const disposals = [...released].map(resource => vi.spyOn(resource, "dispose"));
      await world.ready; world.dispose(); world.dispose();
      expect(scene.getObjectByName("toon-cloud-backdrop")).toBeUndefined();
      disposals.forEach(disposal => expect(disposal).toHaveBeenCalledOnce());
    } finally { world.dispose(); }
  });

  it.each(["tibetan-prayer-flags", "yeondeunghoe"])("freezes cloud drift during previews, pauses and reduced motion: %s", async id => {
    const motion = vi.spyOn(sceneMotion, "readSceneMotion").mockReturnValue({ active: true, reducedMotion: false });
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    const scene = new THREE.Scene();
    const world = createCozyEnvironment(scene, { id, loadSky: async () => new THREE.DataTexture() })!;
    const renderer = { shadowMap: { enabled: false, type: THREE.PCFShadowMap } } as THREE.WebGLRenderer;
    try {
      const layer = scene.getObjectByName("toon-cloud-layer-0") as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
      expect(layer).toBeDefined();
      world.prepare(renderer); clock.mockReturnValue(1020); world.prepare(renderer);
      expect(layer.material.uniforms.uTime.value).toBeCloseTo(.02);
      clock.mockReturnValue(1030); world.prepare(renderer, "gouache", { advanceMotion: false });
      expect(layer.material.uniforms.uTime.value).toBeCloseTo(.02);
      motion.mockReturnValue({ active: false, reducedMotion: false });
      clock.mockReturnValue(1040); world.prepare(renderer);
      expect(layer.material.uniforms.uTime.value).toBeCloseTo(.02);
      motion.mockReturnValue({ active: true, reducedMotion: true });
      clock.mockReturnValue(1060); world.prepare(renderer);
      expect(layer.material.uniforms.uTime.value).toBe(0);
      await world.ready;
    } finally { world.dispose(); motion.mockRestore(); clock.mockRestore(); }
  });

  it.each(["lantern", "chinese-shadow-puppet", "udo-undama", "paper-pinwheel", "weifang-paper-kite"])("preserves coastal and hidden scene backgrounds: %s", async id => {
    const scene = new THREE.Scene();
    const world = createCozyEnvironment(scene, { id, loadSky: async () => new THREE.DataTexture() })!;
    expect(scene.getObjectByName("toon-cloud-backdrop")).toBeUndefined();
    await world.ready; world.dispose();
  });

  it("provides distant clouds throughout the App's shared day and night environments", async () => {
    const preserved = new Set(["udo-undama"]);
    const entries = builtInScenes.filter(entry => isSceneVisibleInApp(entry) && !preserved.has(entry.id));
    expect(entries).toHaveLength(90);
    for (const { id } of entries) {
      const scene = new THREE.Scene();
      const world = createCozyEnvironment(scene, { id, loadSky: async () => new THREE.DataTexture() })!;
      try {
        expect(scene.getObjectByName("toon-cloud-backdrop"), id).toBeDefined();
        await world.ready;
      } finally { world.dispose(); }
    }
  },60000);

  it.each(["brat-bride-cloth", "scottish-first-footing", "diya-oil-lamp", "votive-candle-catholic", "yeondeunghoe"])("keeps the painted night sky while loading and releasing its separate lighting HDR: %s", async id => {
    const scene = new THREE.Scene(), previous = new THREE.Color(0x123456);
    scene.background = previous;
    const lighting = new THREE.DataTexture(), releasedLighting = vi.spyOn(lighting, "dispose");
    const world = createCozyEnvironment(scene, { id, loadSky: async () => lighting })!;
    try {
      const background = scene.background;
      expect(background).toBeInstanceOf(THREE.DataTexture);
      const releasedBackground = vi.spyOn(background as THREE.DataTexture, "dispose");
      await world.ready;
      expect(scene.background).toBe(background);
      expect(scene.environment).toBe(lighting);
      expect(scene.getObjectByName("toon-cloud-backdrop")).toBeDefined();
      world.dispose(); world.dispose();
      expect(releasedBackground).toHaveBeenCalledOnce();
      expect(releasedLighting).toHaveBeenCalledOnce();
      expect(scene.background).toBe(previous);
    } finally { world.dispose(); }
  });

  it("keeps courtyard ground below the Didukh cutaway floor instead of painting over it", async () => {
    const scene=new THREE.Scene()
    const world=createCozyEnvironment(scene,{id:"ukrainian-didukh",loadSky:async()=>new THREE.DataTexture()})!
    scene.updateMatrixWorld(true)
    const ray=new THREE.Raycaster(new THREE.Vector3(.55,1,-.08),new THREE.Vector3(0,-1,0))
    const hits=ray.intersectObject(scene.getObjectByName("cozy-environment")!,true)
    expect(hits.length).toBeGreaterThan(0)
    expect(Math.max(...hits.map(hit=>hit.point.y))).toBeLessThan(-.12)
    await world.ready;world.dispose()
  })

  it("prepares thumbnail lighting without advancing wind or its clock", async () => {
    const motion = vi.spyOn(sceneMotion, "readSceneMotion").mockReturnValue({ active: true, reducedMotion: false });
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    const scene = new THREE.Scene(), sun = new THREE.DirectionalLight(); scene.add(sun);
    const world = createCozyEnvironment(scene, { id: "woodfish", loadSky: async () => new THREE.DataTexture(), loadTree: async () => {
      const root = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ alphaTest: .5 }));
      mesh.position.y = 1; root.add(mesh); return root;
    } })!;
    await world.ready;
    world.setTone('original');
    const renderer = { shadowMap: { enabled: false, type: THREE.PCFShadowMap } } as THREE.WebGLRenderer;
    try {
      world.prepare(renderer); clock.mockReturnValue(1020); world.prepare(renderer);
      const meadow = scene.getObjectByName("windswept-meadow") as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
      const foliage = scene.getObjectByName("recommended-environment-trees")!.children[0] as THREE.InstancedMesh;
      const matrices = foliage.instanceMatrix.array.slice(), intensity = sun.intensity;
      expect(meadow.material.uniforms.meadowTime.value).toBeCloseTo(.02);
      clock.mockReturnValue(1030); world.prepare(renderer, "gouache", { advanceMotion: false });
      expect(sun.intensity).toBeLessThan(intensity);
      expect(meadow.material.uniforms.meadowTime.value).toBeCloseTo(.02);
      expect(foliage.instanceMatrix.array).toEqual(matrices);
      world.prepare(renderer, "toon-soft", { advanceMotion: false });
      expect(sun.intensity).toBe(intensity);
      clock.mockReturnValue(1040); world.prepare(renderer);
      expect(meadow.material.uniforms.meadowTime.value).toBeCloseTo(.04);
      await world.ready;
    } finally { world.dispose(); motion.mockRestore(); clock.mockRestore(); }
  });
  it("softens daylight in gouache and restores the existing rig on switching back", async () => {
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(), ambient = new THREE.AmbientLight(), sky = new THREE.HemisphereLight();
    const lamp = new THREE.PointLight(0xffaa44, .7);
    scene.add(sun, ambient, sky, lamp);
    const world = createCozyEnvironment(scene, { id: "dalarna-wooden-horse", loadSky: async () => new THREE.DataTexture() })!;
    world.setTone('original');
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
  it.each(["shinto-torii", "celtic-folk-spring", "woodfish", "slavic-wreath", "zeniarai-coin-washing", "hindu-coconut-offering"])("keeps the added garden clear of the interaction space and releases its instance buffers: %s", async id => {
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
    ["mezuzah-doorpost", "courtyard"],
    ["yusheng-lohei", "garden"],
    ["ukrainian-didukh", "courtyard"],
    ["sri-lankan-bodhi-puja", "garden"],
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
    expect(sun.intensity).toBeCloseTo(1.12*Math.PI);
    expect(sky.intensity).toBeCloseTo(.64*Math.PI);expect(ambient.intensity).toBe(0);expect(fill.intensity).toBe(0);
    expect(sun.position.x).toBeLessThan(-2);
    expect(sun.position.y).toBeGreaterThan(sun.position.z);
    expect(sun.position.z).toBeGreaterThan(0);
    expect(sun.castShadow).toBe(true); expect(fill.castShadow).toBe(false);
    expect(renderer.shadowMap.enabled).toBe(true);
    const direction = sun.position.clone().normalize();
    sun.position.set(-1, 1, -8); sun.intensity = .1;
    world.prepare(renderer);
    expect(sun.position.clone().normalize().distanceTo(direction)).toBeLessThan(.0001);
    expect(sun.intensity).toBeCloseTo(1.12*Math.PI);
    expect(sky.intensity).toBeCloseTo(.64*Math.PI);expect(ambient.intensity).toBe(0);expect(fill.intensity).toBe(0);
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

it('keeps the undama coastal horizon free of a river garden and environment trees and disposes it',async()=>{const loadTree=vi.fn();const s=new THREE.Scene(),env=createCozyEnvironment(s,{id:'udo-undama',loadTree,loadSky:async()=>new THREE.DataTexture()});expect(env).not.toBeNull();await env!.ready;expect(env!.treeCount).toBe(0);expect(loadTree).not.toHaveBeenCalled();expect(s.getObjectByName('daylight-planting')).toBeUndefined();expect(s.getObjectByName('stylized-meadow')).toBeUndefined();env!.dispose();expect(s.children).toHaveLength(0)})

it('keeps the complete Chinowa walking corridor clear of surrounding solids',async()=>{
 const scene=new THREE.Scene(),world=createCozyEnvironment(scene,{id:'chinowa-kuguri',loadSky:async()=>new THREE.DataTexture()});expect(world).not.toBeNull();scene.updateMatrixWorld(true)
 const corridor=new THREE.Box3(new THREE.Vector3(-3.65,.05,-1.4),new THREE.Vector3(3.65,2.6,10)),planting=scene.getObjectByName('daylight-planting')!;expect(planting).toBeDefined()
 planting.traverse(o=>{const m=o as THREE.InstancedMesh;if(!m.isInstancedMesh)return;m.geometry.computeBoundingBox();for(let i=0;i<m.count;i++){const matrix=new THREE.Matrix4();m.getMatrixAt(i,matrix);matrix.premultiply(m.matrixWorld);expect(m.geometry.boundingBox!.clone().applyMatrix4(matrix).intersectsBox(corridor),m.name).toBe(false)}})
 await world!.ready;world!.dispose()
})

describe('stylized veranda and table timber deck and railing', () => {
  it('builds calm planked veranda deck and railing with preserved bounds, proper grain axes, tone switching and night harmony', async () => {
    const dayScene = new THREE.Scene();
    const nightScene = new THREE.Scene();
    const dayWorld = createCozyEnvironment(dayScene, { id: 'polish-blessing-basket', loadSky: async () => new THREE.DataTexture() })!;
    const nightWorld = createCozyEnvironment(nightScene, { id: 'lantern', loadSky: async () => new THREE.DataTexture() })!;
    try {
      await Promise.all([dayWorld.ready, nightWorld.ready]);
      dayScene.updateMatrixWorld(true);
      nightScene.updateMatrixWorld(true);

      const collect = (scene: THREE.Scene, name: string) => {
        const found: THREE.Mesh[] = [];
        scene.traverse(obj => { if (obj instanceof THREE.Mesh && obj.name === name) found.push(obj); });
        return found;
      };

      const planks = collect(dayScene, 'veranda-deck-plank');
      const edge = collect(dayScene, 'veranda-deck-edge');
      const backing = collect(dayScene, 'veranda-deck-backing');
      const posts = collect(dayScene, 'veranda-rail-post');
      const caps = collect(dayScene, 'veranda-rail-cap');
      const bars = collect(dayScene, 'veranda-rail-bar');
      expect(planks.length).toBe(15);
      expect(edge.length).toBe(1);
      expect(backing.length).toBe(1);
      expect(posts.length).toBe(4);
      expect(caps.length).toBe(4);
      expect(bars.length).toBe(2);

      // Exact outer deck dimensions preserved (floor = -0.04 => top -0.035, bottom -0.155).
      const deckBounds = new THREE.Box3();
      for (const mesh of [...planks, ...edge]) deckBounds.expandByObject(mesh);
      expect(deckBounds.min.x).toBeCloseTo(-6, 3);
      expect(deckBounds.max.x).toBeCloseTo(6, 3);
      expect(deckBounds.min.z).toBeCloseTo(-2.45, 3);
      expect(deckBounds.max.z).toBeCloseTo(2.85, 3);
      expect(deckBounds.min.y).toBeCloseTo(-0.155, 3);
      expect(deckBounds.max.y).toBeCloseTo(-0.035, 3);

      const backingBounds = new THREE.Box3().setFromObject(backing[0]!);
      const meadowGround = dayScene.getObjectByName('meadow-ground')!;
      // Backing sits strictly above meadow-ground (preventing green bleed through seams) and below plank tops.
      expect(backingBounds.max.y).toBeGreaterThan(meadowGround.position.y + 0.001);
      expect(backingBounds.max.y).toBeLessThan(-0.036);

      // Rail placements stay centered at authored x and z coordinates.
      const postXs = posts.map(m => new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).x).sort((a, b) => a - b);
      expect(postXs).toEqual([-4.6, -2.3, 2.3, 4.6].map(x => expect.closeTo(x, 3)));
      for (const m of [...posts, ...bars]) {
        expect(new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).z).toBeCloseTo(-2.5, 3);
      }

      // Grain axes, calmness (quieter & more matte than hero tables), shadow receiving, and environmentRole.
      const plankColors = new Set<number>();
      for (const mesh of planks) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        expect(mesh.receiveShadow).toBe(true);
        expect(mesh.userData.toonSurface?.outline).toBe(false);
        expect(mesh.userData.toonSurface?.roughness).toBeGreaterThanOrEqual(0.85);
        expect(mat.userData.environmentRole).toBe('wood');
        expect(mat.userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'z' });
        expect(mat.userData.craftSurface.strength).toBeLessThanOrEqual(0.2);
        plankColors.add(mat.color.getHex());
      }
      expect(plankColors.size).toBeGreaterThan(2);

      for (const mesh of posts) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        expect(mat.userData.environmentRole).toBe('wood');
        expect(mat.userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'y' });
        expect(mat.userData.craftSurface.strength).toBeLessThanOrEqual(0.25);
      }
      for (const mesh of [...bars, ...edge]) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        expect(mat.userData.environmentRole).toBe('wood');
        expect(mat.userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'x' });
      }
      expect((backing[0]!.material as THREE.MeshStandardMaterial).userData.environmentRole).toBe('trim');
      for (const mesh of caps) {
        expect((mesh.material as THREE.MeshStandardMaterial).userData.environmentRole).toBe('trim');
      }

      // Tone switching updates veranda planks cleanly across komorebi, tiny-delivery, and original; night stays darker.
      const daySample = (planks[0]!.material as THREE.MeshStandardMaterial).color;
      const nightPlank = collect(nightScene, 'veranda-deck-plank')[0]!;
      const nightSample = (nightPlank.material as THREE.MeshStandardMaterial).color;
      const komorebiDay = daySample.getHex();
      const komorebiNight = nightSample.getHex();
      expect(nightSample.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(daySample.getHSL({ h: 0, s: 0, l: 0 }).l);

      dayWorld.setTone('tiny-delivery');
      nightWorld.setTone('tiny-delivery');
      const deliveryDay = daySample.getHex();
      expect(deliveryDay).not.toBe(komorebiDay);
      expect(nightSample.getHex()).not.toBe(komorebiNight);
      expect(nightSample.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(daySample.getHSL({ h: 0, s: 0, l: 0 }).l);

      dayWorld.setTone('original');
      nightWorld.setTone('original');
      expect(daySample.getHex()).not.toBe(deliveryDay);
      expect(daySample.getHex()).not.toBe(komorebiDay);
      expect(nightSample.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(daySample.getHSL({ h: 0, s: 0, l: 0 }).l);

      dayWorld.setTone('komorebi');
      nightWorld.setTone('komorebi');
      expect(daySample.getHex()).toBe(komorebiDay);
      expect(nightSample.getHex()).toBe(komorebiNight);
    } finally {
      dayWorld.dispose();
      nightWorld.dispose();
    }
  });

  it('builds calm planked table surface and vertical front posts for crane with preserved bounds and clean disposal', async () => {
    const scene = new THREE.Scene();
    const world = createCozyEnvironment(scene, { id: 'crane', loadSky: async () => new THREE.DataTexture() })!;
    try {
      await world.ready;
      scene.updateMatrixWorld(true);
      const planks: THREE.Mesh[] = [];
      const posts: THREE.Mesh[] = [];
      let backing: THREE.Mesh | undefined;
      scene.traverse(obj => {
        if (!(obj instanceof THREE.Mesh)) return;
        if (obj.name === 'table-deck-plank') planks.push(obj);
        else if (obj.name === 'table-front-post') posts.push(obj);
        else if (obj.name === 'table-deck-backing') backing = obj;
      });
      expect(planks.length).toBe(7);
      expect(posts.length).toBe(2);
      expect(backing).toBeDefined();

      // Crane floor = -0.65 => slab top = -0.665, bottom = -0.795, width = 5.8, depth = 3.4 centered at z = 0.35.
      const deckBounds = new THREE.Box3();
      for (const mesh of planks) deckBounds.expandByObject(mesh);
      expect(deckBounds.min.x).toBeCloseTo(-2.9, 3);
      expect(deckBounds.max.x).toBeCloseTo(2.9, 3);
      expect(deckBounds.min.z).toBeCloseTo(-1.35, 3);
      expect(deckBounds.max.z).toBeCloseTo(2.05, 3);
      expect(deckBounds.min.y).toBeCloseTo(-0.795, 3);
      expect(deckBounds.max.y).toBeCloseTo(-0.665, 3);
      expect(new THREE.Box3().setFromObject(backing!).max.y).toBeLessThan(-0.666);

      const postXs = posts.map(m => new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).x).sort((a, b) => a - b);
      expect(postXs).toEqual([-2.1, 2.1].map(x => expect.closeTo(x, 3)));
      for (const post of posts) {
        const mat = post.material as THREE.MeshStandardMaterial;
        expect(mat.userData.environmentRole).toBe('wood');
        expect(mat.userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'y' });
      }
      for (const plank of planks) {
        const mat = plank.material as THREE.MeshStandardMaterial;
        expect(mat.userData.environmentRole).toBe('wood');
        expect(mat.userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'z' });
        expect(mat.userData.craftSurface.strength).toBeLessThanOrEqual(0.2);
      }

      const geoDisposals = [...planks, ...posts, backing!].map(m => vi.spyOn(m.geometry, 'dispose'));
      world.dispose();
      world.dispose();
      geoDisposals.forEach(spy => expect(spy).toHaveBeenCalledOnce());
    } finally {
      world.dispose();
    }
  });
});

describe('environment surface metadata and outdoor ShadowMaterial suppression', () => {
  it('records environmentId and environmentSurfaceY on scene.userData and restores previous values on dispose', async () => {
    const cleanScene = new THREE.Scene();
    const cleanWorld = createCozyEnvironment(cleanScene, { id: 'welsh-love-spoon', loadSky: async () => new THREE.DataTexture() })!;
    expect(cleanScene.userData.environmentId).toBe('welsh-love-spoon');
    expect(cleanScene.userData.environmentSurfaceY).toBeCloseTo(-0.035, 6);
    await cleanWorld.ready;
    cleanWorld.dispose();
    expect(cleanScene.userData.environmentId).toBeUndefined();
    expect(cleanScene.userData.environmentSurfaceY).toBeUndefined();

    const presetScene = new THREE.Scene();
    presetScene.userData.environmentId = 'prior-id';
    presetScene.userData.environmentSurfaceY = 0.25;
    const presetWorld = createCozyEnvironment(presetScene, { id: 'croatian-licitar-heart', loadSky: async () => new THREE.DataTexture() })!;
    expect(presetScene.userData.environmentId).toBe('croatian-licitar-heart');
    expect(presetScene.userData.environmentSurfaceY).toBeCloseTo(-0.0225, 6);
    await presetWorld.ready;
    presetWorld.dispose();
    expect(presetScene.userData.environmentId).toBe('prior-id');
    expect(presetScene.userData.environmentSurfaceY).toBe(0.25);
  });

  it('matches actual built environment surface geometry across all five environment kinds', async () => {
    const cases: readonly [string, (scene: THREE.Scene) => number][] = [
      ['welsh-love-spoon', scene => new THREE.Box3().setFromObject(scene.getObjectByName('veranda-deck-plank')!).max.y],
      ['phuang-malai', scene => scene.getObjectByName('garden-path')!.position.y],
      ['shrine-suzu-bell', scene => {
        const path = scene.getObjectByName('courtyard-stone-path') as THREE.Mesh;
        const hits = new THREE.Raycaster(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0)).intersectObject(path);
        return hits[0]!.point.y;
      }],
      ['crane', scene => new THREE.Box3().setFromObject(scene.getObjectByName('table-deck-plank')!).max.y],
      ['floating-lantern-loy-krathong', scene => {
        const root = scene.getObjectByName('cozy-environment')!;
        let maxBankY = -Infinity;
        root.traverse(obj => {
          if (obj instanceof THREE.Mesh && obj.position.x === -5) {
            maxBankY = Math.max(maxBankY, new THREE.Box3().setFromObject(obj).max.y);
          }
        });
        return maxBankY;
      }],
    ];

    for (const [id, measureY] of cases) {
      const scene = new THREE.Scene();
      const world = createCozyEnvironment(scene, { id, loadSky: async () => new THREE.DataTexture() })!;
      try {
        await world.ready;
        scene.updateMatrixWorld(true);
        expect(Math.abs(measureY(scene) - getEnvironmentSurfaceY(id)), id).toBeLessThan(0.0025);
        if (id === 'floating-lantern-loy-krathong') {
          expect(scene.getObjectByName('meadow-ground')!.position.y).toBeCloseTo(getEnvironmentRiverbedY(id), 6);
        }
      } finally {
        world.dispose();
      }
    }
  });

  it('hides outdoor ShadowMaterial planes during prepare and restores original visibility on dispose', async () => {
    const scene = new THREE.Scene();
    const visibleShadow = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.ShadowMaterial({ opacity: 0.13 }));
    visibleShadow.name = 'legacy-shadow-plane';
    const hiddenShadow = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.ShadowMaterial({ opacity: 0.12 }));
    hiddenShadow.visible = false;
    const optedInShadow = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.ShadowMaterial({ opacity: 0.12 }));
    optedInShadow.userData.keepInOutdoorEnvironment = true;
    const arrayShadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), [new THREE.ShadowMaterial({ opacity: 0.1 })]);
    const solidProp = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xaa8866 }));
    scene.add(visibleShadow, hiddenShadow, optedInShadow, arrayShadow, solidProp);

    const world = createCozyEnvironment(scene, { id: 'welsh-love-spoon', loadSky: async () => new THREE.DataTexture() })!;
    const renderer = { shadowMap: { enabled: false, type: THREE.PCFShadowMap } } as THREE.WebGLRenderer;
    try {
      await world.ready;
      world.prepare(renderer);

      expect(visibleShadow.visible).toBe(false);
      expect(hiddenShadow.visible).toBe(false);
      expect(optedInShadow.visible).toBe(true);
      expect(arrayShadow.visible).toBe(false);
      expect(solidProp.visible).toBe(true);

      // Re-showing a shadow plane during an animation tick is re-suppressed on the next prepare.
      visibleShadow.visible = true;
      const lateShadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShadowMaterial({ opacity: 0.08 }));
      scene.add(lateShadow);
      world.prepare(renderer);
      expect(visibleShadow.visible).toBe(false);
      expect(lateShadow.visible).toBe(false);

      world.dispose();
      world.dispose();
      expect(visibleShadow.visible).toBe(true);
      expect(hiddenShadow.visible).toBe(false);
      expect(optedInShadow.visible).toBe(true);
      expect(arrayShadow.visible).toBe(true);
      expect(lateShadow.visible).toBe(true);
      expect(solidProp.visible).toBe(true);

      lateShadow.geometry.dispose();
      (lateShadow.material as THREE.Material).dispose();
    } finally {
      world.dispose();
      for (const mesh of [visibleShadow, hiddenShadow, optedInShadow, arrayShadow, solidProp]) {
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(mat => mat.dispose());
      }
    }
  });
});
