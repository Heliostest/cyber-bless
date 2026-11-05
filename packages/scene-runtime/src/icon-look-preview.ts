import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { copyCraftSurface } from './craft-surfaces';
import { copyRitualOptics } from './ritual-optics';
import { puffPouchGeometry } from './soft-pouch-geometry';

export const ICON_LOOK_SUBJECTS = ['omamori-cycle', 'woodfish', 'shrine-suzu-bell', 'furin-wind-chime'] as const;

function finish(source: THREE.MeshStandardMaterial, mesh: THREE.Mesh, id: string, owned: THREE.MeshStandardMaterial[]) {
  const material = source.clone();
  owned.push(material);
  copyRitualOptics(source, material);
  copyCraftSurface(source, material);
  const kind = source.userData.craftSurface?.kind;
  material.envMapIntensity = .65;
  if (!source.transparent && !(material instanceof THREE.MeshPhysicalMaterial))
    material.roughness = kind === 'metal' ? .34 : kind === 'wood' ? .62 : kind === 'cord' ? .83 : kind === 'fabric' ? .86 : source.roughness;
  if (id === 'woodfish' && kind === 'wood') {
    // Follow the existing painted-model direction, retaining procedural grain
    // and source AO/normal maps instead of the map's baked pigment.
    if (mesh.userData.toonSurface?.simplifyMap) material.map = null;
    material.color.set(mesh.name === 'Mallet' ? 0xdcb37c : 0xe0ae72);
    material.roughness = .7; material.metalness = 0; material.aoMapIntensity = .95;
  } else if (id === 'omamori-cycle') {
    if (kind === 'fabric') {
      const c = source.color;
      material.color.set(c.r > c.g * 1.15 ? 0xea837c : c.b > c.r * 1.1 ? 0x9cace0 : c.g > c.r ? 0x9db99d : 0xd6b58a);
    } else if (kind === 'cord') material.color.set(0xffecd0);
  } else if (id === 'shrine-suzu-bell' && kind === 'metal') {
    if (source.color.getHSL({ h: 0, s: 0, l: 0 }).l > .4) material.color.set(0xdcb15b);
    material.metalness = .88; material.roughness = source.roughness > .6 ? .58 : .34;
  } else if (id === 'furin-wind-chime' && material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0) {
    material.color.set(0xc8e7fb); material.roughness = .1; material.transmission = .8;
    material.attenuationDistance = 2;
    material.clearcoat = .65; material.clearcoatRoughness = .18; material.envMapIntensity = .9;
  } else if (id === 'furin-wind-chime' && mesh.parent?.name.startsWith('furin-ribbon-joint-')) material.color.set(0xf0a8b6);
  material.name = `${source.name || mesh.name || 'surface'} / icon-look-preview`;
  return material;
}

function isEnvironment(object: THREE.Object3D, scene: THREE.Scene) {
  for (let parent = object.parent; parent && parent !== scene; parent = parent.parent)
    if (parent.name === 'cozy-environment' || parent.userData.environment !== undefined) return true;
  return false;
}

/** Own only derived materials; source materials and maps remain scene-owned. */
export function createIconLookSurfaces(id: string) {
  const cache = new Map<THREE.Mesh, { source: THREE.Material | THREE.Material[]; styled: THREE.Material | THREE.Material[]; owned: THREE.MeshStandardMaterial[] }>();
  const pouches = new Map<THREE.Mesh, { source: THREE.BufferGeometry; styled: THREE.BufferGeometry }>();
  return {
    apply(scene: THREE.Scene) {
      const swaps: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [], live = new Set<THREE.Mesh>();
      const geometrySwaps: [THREE.Mesh, THREE.BufferGeometry][] = [], positions: [THREE.Object3D, number][] = [];
      const restore = () => {
        for (const [mesh, source] of swaps) mesh.material = source;
        for (const [mesh, geometry] of geometrySwaps) mesh.geometry = geometry;
        for (const [object, z] of positions) { object.position.z = z; object.updateMatrixWorld(); }
      };
      try {
        scene.traverse(object => {
          const shapedPouch = object.parent?.children.some(child => child instanceof THREE.Mesh && child.name.startsWith('omamori-pouch-body-') && child.geometry.userData.iconPouchFullness && !pouches.has(child));
          if (!shapedPouch && id === 'omamori-cycle' && object.parent?.name.startsWith('omamori-pouch-') && !object.name.startsWith('omamori-pouch-body-')) {
            let front = object.position.z > .09;
            if (object instanceof THREE.Mesh && !front) {
              object.geometry.computeBoundingBox(); front = object.position.z + (object.geometry.boundingBox?.min.z ?? 0) > .09;
            }
            if (front) { positions.push([object, object.position.z]); object.position.z += .035; object.updateMatrixWorld(); }
          }
          if (!(object instanceof THREE.Mesh) || isEnvironment(object, scene)) return;
          live.add(object);
          if (id === 'omamori-cycle' && object.name.startsWith('omamori-pouch-body-') && !object.geometry.userData.iconPouchFullness) {
            let pouch = pouches.get(object);
            if (!pouch || pouch.source !== object.geometry) {
              pouch?.styled.dispose(); pouch = { source: object.geometry, styled: puffPouchGeometry(object.geometry) }; pouches.set(object, pouch);
            }
            geometrySwaps.push([object, object.geometry]); object.geometry = pouch.styled;
          }
          let entry = cache.get(object);
          if (!entry || entry.source !== object.material) {
            entry?.owned.forEach(material => material.dispose());
            cache.delete(object);
            const owned: THREE.MeshStandardMaterial[] = [];
            const adapt = (source: THREE.Material) => {
              if (!(source instanceof THREE.MeshStandardMaterial)) return source;
              return finish(source, object, id, owned);
            };
            const source = object.material;
            let styled: THREE.Material | THREE.Material[];
            try { styled = Array.isArray(source) ? source.map(adapt) : adapt(source); }
            catch (error) { owned.forEach(material => material.dispose()); throw error; }
            entry = { source, styled, owned };
            cache.set(object, entry);
          }
          const sources = Array.isArray(entry.source) ? entry.source : [entry.source];
          const styled = Array.isArray(entry.styled) ? entry.styled : [entry.styled];
          sources.forEach((source, index) => {
            const target = styled[index];
            if (!(source instanceof THREE.MeshStandardMaterial) || !(target instanceof THREE.MeshStandardMaterial)) return;
            target.opacity = source.opacity; target.visible = source.visible;
            target.emissive.copy(source.emissive); target.emissiveIntensity = source.emissiveIntensity;
          });
          swaps.push([object, object.material]); object.material = entry.styled;
        });
        for (const [mesh, entry] of cache) if (!live.has(mesh)) {
          entry.owned.forEach(material => material.dispose()); cache.delete(mesh);
        }
        for (const [mesh, entry] of pouches) if (!live.has(mesh)) { entry.styled.dispose(); pouches.delete(mesh); }
      } catch (error) { restore(); throw error; }
      return { restore };
    },
    dispose() { cache.forEach(entry => entry.owned.forEach(material => material.dispose())); cache.clear(); pouches.forEach(entry => entry.styled.dispose()); pouches.clear(); },
  };
}

export function applyIconLookLighting(scene: THREE.Scene, id = '') {
  const restores: (() => void)[] = [];
  let directional = 0;
  scene.traverse(object => {
    if (!(object instanceof THREE.Light)) return;
    const color = object.color.clone(), intensity = object.intensity;
    restores.push(() => { object.color.copy(color); object.intensity = intensity; });
    if (object instanceof THREE.HemisphereLight) {
      const ground = object.groundColor.clone(); restores.push(() => object.groundColor.copy(ground));
      object.color.set(0xf2f6ff); object.groundColor.set(0xd4bc9c); object.intensity = .55;
    } else if (object instanceof THREE.AmbientLight) {
      object.color.set(0xfff5e9); object.intensity = .08;
    } else if (object instanceof THREE.DirectionalLight) {
      const radius = object.shadow.radius, strength = object.shadow.intensity;
      restores.push(() => { object.shadow.radius = radius; object.shadow.intensity = strength; });
      object.color.set(directional === 0 ? 0xfff1dc : 0xebf1ff);
      object.intensity = directional === 0 ? 2.3 : .2;
      object.shadow.radius = 6; object.shadow.intensity = id === 'woodfish' ? .95 : .5; directional++;
    }
  });
  return { restore() { for (const restore of restores) restore(); } };
}

/** No preferences or GPU resources outside an explicit comparison host. */
export function createIconLookPreview(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, id: string) {
  const host = renderer.domElement.closest?.<HTMLElement>('[data-icon-look-preview]');
  if (!host || !ICON_LOOK_SUBJECTS.some(subject => subject === id)) return undefined;
  const surfaces = createIconLookSurfaces(id);
  let target: THREE.WebGLRenderTarget | undefined, disposed = false;
  return {
    get enabled() { return !disposed && host.dataset.iconLookPreview === 'icon'; },
    get showCues() { return host.dataset.iconLookCues !== 'hidden'; },
    prepare() {
      if (host.dataset.iconLookFocus !== 'true') return;
      // Both comparison sides use the same view. Keep this camera live for
      // pointer raycasts, rather than changing it only for the rendered frame.
      if (camera instanceof THREE.PerspectiveCamera) {
        const views: Record<string, [number[], number[]]> = {
          'omamori-cycle': [[-.12, 1.75, 3.25], [-.2, 1.33, .25]],
          'shrine-suzu-bell': [[.35, 1.65, 3.65], [0, 1.48, .1]],
          'furin-wind-chime': [[.25, 1.5, 2.4], [0, 1.35, 0]],
        };
        const view = views[id];
        if (view) { camera.position.fromArray(view[0]); camera.lookAt(new THREE.Vector3().fromArray(view[1])); camera.updateMatrixWorld(); }
      }
    },
    render() {
      if (disposed) return;
      if (!target) {
        const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
        try { target = pmrem.fromScene(room, .06); } finally { room.dispose(); pmrem.dispose(); }
      }
      const environment = scene.environment, environmentIntensity = scene.environmentIntensity;
      const toneMapping = renderer.toneMapping, exposure = renderer.toneMappingExposure, shadowType = renderer.shadowMap.type;
      const renderTarget = renderer.getRenderTarget();
      const lights = applyIconLookLighting(scene, id);
      let frame: ReturnType<typeof surfaces.apply> | undefined;
      try {
        frame = surfaces.apply(scene);
        scene.environment = target.texture; scene.environmentIntensity = .3;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.setRenderTarget(null); renderer.render(scene, camera);
      } finally {
        frame?.restore(); lights.restore(); scene.environment = environment; scene.environmentIntensity = environmentIntensity;
        renderer.toneMapping = toneMapping; renderer.toneMappingExposure = exposure; renderer.shadowMap.type = shadowType;
        renderer.setRenderTarget(renderTarget);
      }
    },
    dispose() { if (disposed) return; disposed = true; surfaces.dispose(); target?.dispose(); },
  };
}
