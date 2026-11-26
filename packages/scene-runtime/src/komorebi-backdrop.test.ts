import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createKomorebiBackdrop, KOMOREBI_BACKDROP_PIGMENTS, type BackdropRole } from './komorebi-backdrop';
import { createCozyEnvironment as createEnvironment } from './cozy-environment';

const createCozyEnvironment: typeof createEnvironment = (scene, options) =>
  createEnvironment(scene, {
    ...options,
    loadTree:
      options.loadTree ??
      (async () => {
        const root = new THREE.Group();
        root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial()));
        return root;
      }),
  });

describe('Komorebi daylight backdrop calibration', () => {
  const compilePhongShader = (material: THREE.MeshPhongMaterial) => {
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <beginnormal_vertex>\n#include <begin_vertex>',
      fragmentShader:
        '#include <color_fragment>\n#include <normal_fragment_begin>\n#include <lights_phong_fragment>\nvec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;\n#include <opaque_fragment>',
    };
    material.onBeforeCompile(shader as never, {} as never);
    return shader;
  };

  it('calibrates tagged backdrop roles with flower-only bounce lift, preserves stonePath meshes, restores PBR, and disposes cleanly', () => {
    const root = new THREE.Group();
    const roles: BackdropRole[] = ['sand', 'stone', 'foliage', 'flower', 'bloom', 'blossomHeart', 'hill', 'distantHill'];
    const flowerRoles = new Set<BackdropRole>(['flower', 'bloom', 'blossomHeart']);
    expect(KOMOREBI_BACKDROP_PIGMENTS.sand).toBe(0xc8b48c);
    const detailMap = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const tagged = roles.map(role => {
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
      material.userData.backdropRole = role;
      if (role === 'sand') material.userData.komorebiDetailMap = detailMap;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
      root.add(mesh);
      return { role, material, mesh };
    });

    const untaggedMat = new THREE.MeshStandardMaterial({ color: 0xaa8866 });
    const untagged = new THREE.Mesh(new THREE.BoxGeometry(), untaggedMat);
    root.add(untagged);

    // Materials that already own Komorebi pigments are never double-wrapped.
    const pigmentOwnedMat = new THREE.MeshStandardMaterial({ color: 0xe2c3a2 });
    pigmentOwnedMat.userData.backdropRole = 'flower';
    pigmentOwnedMat.userData.komorebiPigment = true;
    const pigmentOwned = new THREE.Mesh(new THREE.BoxGeometry(), pigmentOwnedMat);
    root.add(pigmentOwned);

    // Even if a material carries backdropRole, a userData.stonePath mesh must never be remapped.
    const stonePathMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    stonePathMat.userData.backdropRole = 'stone';
    const stonePath = new THREE.Mesh(new THREE.BoxGeometry(), stonePathMat);
    stonePath.name = 'courtyard-stone-path';
    stonePath.userData.stonePath = true;
    root.add(stonePath);

    const backdrop = createKomorebiBackdrop(root);
    expect(backdrop.enabled).toBe(false);

    backdrop.setEnabled(true);
    expect(backdrop.enabled).toBe(true);
    const expected = new THREE.Color();
    const swappedSurfaces: THREE.Material[] = [];
    for (const { role, material, mesh } of tagged) {
      expect(mesh.material).not.toBe(material);
      expect(mesh.material).toBeInstanceOf(THREE.MeshPhongMaterial);
      const surface = mesh.material as THREE.MeshPhongMaterial;
      expect(surface.name).toBe(`Komorebi backdrop ${role}`);
      expect(surface.userData.komorebiSurface).toBe(true);
      expect(surface.userData.komorebiPigment).toBe(true);
      expected.setHex(KOMOREBI_BACKDROP_PIGMENTS[role], THREE.LinearSRGBColorSpace);
      expect(surface.color.equals(expected)).toBe(true);
      if (role === 'sand') expect(surface.map).toBe(detailMap);

      const compiled = compilePhongShader(surface);
      if (flowerRoles.has(role)) {
        expect(surface.customProgramCacheKey()).toBe('komorebi-backdrop-flower-v1');
        expect(compiled.vertexShader).toContain(
          'objectNormal = normalize(vec3(objectNormal.x * 0.55, abs(objectNormal.y) * 0.5 + 0.55, objectNormal.z * 0.55));',
        );
        expect(compiled.fragmentShader).toContain(
          'vec3 outgoingLight=mix(vec3(.38,.44,.48),vec3(1.0),clamp(reflectedLight.directDiffuse+reflectedLight.indirectDiffuse,0.0,1.0))*kmPigment',
        );
      } else {
        expect(surface.customProgramCacheKey()).toBe('komorebi-source-diffuse-v1');
        expect(compiled.vertexShader).not.toContain('abs(objectNormal.y)');
        expect(compiled.fragmentShader).not.toContain('mix(vec3(.38,.44,.48)');
        expect(compiled.fragmentShader).toContain(
          'vec3 outgoingLight=clamp(reflectedLight.directDiffuse+reflectedLight.indirectDiffuse,0.0,1.0)*kmPigment',
        );
      }
      swappedSurfaces.push(surface);
    }
    expect(untagged.material).toBe(untaggedMat);
    expect(pigmentOwned.material).toBe(pigmentOwnedMat);
    expect(stonePath.material).toBe(stonePathMat);

    // Disabling restores the original PBR materials.
    backdrop.setEnabled(false);
    expect(backdrop.enabled).toBe(false);
    for (const { material, mesh } of tagged) expect(mesh.material).toBe(material);

    // Re-enabling reuses cached surfaces without recreating them.
    backdrop.setEnabled(true);
    tagged.forEach(({ mesh }, i) => expect(mesh.material).toBe(swappedSurfaces[i]));

    const disposals = swappedSurfaces.map(surface => vi.spyOn(surface, 'dispose'));
    backdrop.dispose();
    backdrop.dispose();
    for (const { material, mesh } of tagged) expect(mesh.material).toBe(material);
    disposals.forEach(spy => expect(spy).toHaveBeenCalledOnce());

    tagged.forEach(({ mesh, material }) => { mesh.geometry.dispose(); material.dispose(); });
    untagged.geometry.dispose(); untaggedMat.dispose();
    pigmentOwned.geometry.dispose(); pigmentOwnedMat.dispose();
    stonePath.geometry.dispose(); stonePathMat.dispose();
    detailMap.dispose();
  });

  it('calibrates daylight courtyard backdrops and clouds while leaving the shipped stone path untouched', async () => {
    const scene = new THREE.Scene();
    const world = createCozyEnvironment(scene, { id: 'shinto-torii', loadSky: async () => new THREE.DataTexture() })!;
    const renderer = { shadowMap: { enabled: false, type: THREE.PCFShadowMap } } as THREE.WebGLRenderer;
    try {
      await world.ready;
      world.prepare(renderer, 'toon-soft', { advanceMotion: false });

      const road = scene.getObjectByName('courtyard-stone-path') as THREE.Mesh | undefined;
      expect(road).toBeInstanceOf(THREE.Mesh);
      expect(road!.userData.stonePath).toBe(true);
      expect(road!.castShadow).toBe(false);
      expect((road!.material as THREE.Material).name).toBe('Courtyard stylized stone path (Komorebi)');
      expect((road!.material as THREE.Material).userData.backdropRole).toBeUndefined();
      expect((road!.material as THREE.MeshPhongMaterial).customProgramCacheKey()).toBe('komorebi-source-diffuse-v1');

      // Daylight clouds use display-referred Komorebi daylight shade.
      const cloud = scene.getObjectByName('toon-cloud-layer-0') as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
      expect(cloud.material.uniforms.uShadeAmount.value).toBeGreaterThan(0);

      // KayKit stylized-trees fallback is retired; default trees come from Simple Tree.
      expect(scene.getObjectByName('trees-round-leaves')).toBeUndefined();
      expect(scene.getObjectByName('recommended-environment-trees')).toBeDefined();

      // Kenney planting props use Komorebi backdrop surfaces in daylight Komorebi tone,
      // with sky-bounce + softened normals applied strictly to flower petals and centres.
      const planting = scene.getObjectByName('daylight-planting')!;
      const propMaterials: THREE.MeshPhongMaterial[] = [];
      const flowerMaterials: THREE.MeshPhongMaterial[] = [];
      const nonFlowerMaterials: THREE.MeshPhongMaterial[] = [];
      planting.traverse(object => {
        if (object instanceof THREE.Mesh && object.name.startsWith('nature-')) {
          const mat = object.material as THREE.MeshPhongMaterial;
          propMaterials.push(mat);
          if (/^Komorebi backdrop (flower|bloom|blossomHeart)$/.test(mat.name)) flowerMaterials.push(mat);
          else nonFlowerMaterials.push(mat);
        }
      });
      expect(propMaterials.length).toBeGreaterThan(0);
      expect(flowerMaterials.map(mat => mat.name)).toEqual(
        expect.arrayContaining(['Komorebi backdrop flower', 'Komorebi backdrop bloom', 'Komorebi backdrop blossomHeart']),
      );
      expect(nonFlowerMaterials.map(mat => mat.name)).toEqual(
        expect.arrayContaining(['Komorebi backdrop foliage', 'Komorebi backdrop stone']),
      );
      propMaterials.forEach(mat => {
        expect(mat).toBeInstanceOf(THREE.MeshPhongMaterial);
        expect(mat.name).toMatch(/^Komorebi backdrop /);
      });
      flowerMaterials.forEach(mat => expect(mat.customProgramCacheKey()).toBe('komorebi-backdrop-flower-v1'));
      nonFlowerMaterials.forEach(mat => expect(mat.customProgramCacheKey()).toBe('komorebi-source-diffuse-v1'));

      // Leaving Komorebi restores PBR backdrop props and disables cloud shade without altering stone-path vertex colors.
      const roadColors = Array.from(road!.geometry.attributes.color!.array);
      world.setTone('tiny-delivery');
      expect(cloud.material.uniforms.uShadeAmount.value).toBe(0);
      planting.traverse(object => {
        if (object instanceof THREE.Mesh && object.name.startsWith('nature-')) {
          expect(object.material).toBeInstanceOf(THREE.MeshStandardMaterial);
        }
      });
      expect(Array.from(road!.geometry.attributes.color!.array)).toEqual(roadColors);

      world.setTone('komorebi');
      expect(cloud.material.uniforms.uShadeAmount.value).toBeGreaterThan(0);
      expect((road!.material as THREE.Material).name).toBe('Courtyard stylized stone path (Komorebi)');
      expect(Array.from(road!.geometry.attributes.color!.array)).toEqual(roadColors);
    } finally {
      world.dispose();
    }
  });

  it('keeps backdrop calibration, daylight canopy hue, and cloud daylight shade off at night', async () => {
    const scene = new THREE.Scene();
    const world = createCozyEnvironment(scene, { id: 'diya-oil-lamp', loadSky: async () => new THREE.DataTexture() })!;
    try {
      await world.ready;
      const road = scene.getObjectByName('courtyard-stone-path') as THREE.Mesh;
      expect(road.userData.stonePath).toBe(true);
      const cloud = scene.getObjectByName('toon-cloud-layer-0') as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
      expect(cloud.material.uniforms.uShadeAmount.value).toBe(0);
      expect(scene.getObjectByName('trees-round-leaves')).toBeUndefined();
      // Night backdrop props remain PBR MeshStandardMaterial.
      const root = scene.getObjectByName('cozy-environment')!;
      let backdropProps = 0;
      root.traverse(object => {
        if (object instanceof THREE.Mesh && !Array.isArray(object.material) && object.material.userData.backdropRole) {
          expect(object.material).toBeInstanceOf(THREE.MeshStandardMaterial);
          backdropProps++;
        }
      });
      expect(backdropProps).toBeGreaterThan(0);
    } finally {
      world.dispose();
    }
  });

  it('calibrates daylight garden sand pads and spring rocks without flower bounce lift, and restores PBR outside Komorebi', async () => {
    const scene = new THREE.Scene();
    const world = createCozyEnvironment(scene, { id: 'celtic-folk-spring', loadSky: async () => new THREE.DataTexture() })!;
    try {
      await world.ready;
      const pad = scene.getObjectByName('garden-path') as THREE.Mesh;
      expect(pad.material).toBeInstanceOf(THREE.MeshPhongMaterial);
      const padSurface = pad.material as THREE.MeshPhongMaterial;
      expect(padSurface.name).toBe('Komorebi backdrop sand');
      expect(padSurface.userData.komorebiSurface).toBe(true);
      expect(padSurface.customProgramCacheKey()).toBe('komorebi-source-diffuse-v1');
      const expectedSand = new THREE.Color().setHex(0xc8b48c, THREE.LinearSRGBColorSpace);
      expect(padSurface.color.equals(expectedSand)).toBe(true);

      // Spring-ring rocks and planting stones stay on the base Komorebi surface without bounce lift.
      const root = scene.getObjectByName('cozy-environment')!;
      const stoneSurfaces: THREE.MeshPhongMaterial[] = [];
      root.traverse(object => {
        if (object instanceof THREE.Mesh && !Array.isArray(object.material) && object.material.name === 'Komorebi backdrop stone') {
          stoneSurfaces.push(object.material as THREE.MeshPhongMaterial);
        }
      });
      expect(stoneSurfaces.length).toBeGreaterThanOrEqual(14);
      stoneSurfaces.forEach(mat => expect(mat.customProgramCacheKey()).toBe('komorebi-source-diffuse-v1'));

      world.setTone('original');
      expect(pad.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      world.setTone('komorebi');
      expect((pad.material as THREE.Material).name).toBe('Komorebi backdrop sand');
    } finally {
      world.dispose();
    }
  });
});
