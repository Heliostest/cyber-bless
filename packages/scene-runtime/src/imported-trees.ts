import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { TreePlacement } from './stylized-trees';
import type { TreeRenderMethod, TreeRenderReport } from './debug-trees';
import { resolveTreeModelSet, type TreeSpecies } from './tree-models';
import { treePreviewLayout, type TreePreviewShape, type TreePreviewPlacement } from './tree-preview-layout';
import { softenTreeFoliage } from './tree-foliage';
import { applyKomorebiTreeWind } from './komorebi-tree-wind';
import { adaptKomorebiModel } from './komorebi-surface';

declare const process: { env: { EXPO_BASE_URL?: string } };
type Options = { load?: (url: string) => Promise<THREE.Group>; onChange?: (report: TreeRenderReport) => void; invalidate?: () => void; recommendation?: TreeSpecies; camera?: THREE.Camera };

function resources(objects: THREE.Object3D[]) {
  const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  objects.forEach(root => root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometry.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => {
      materials.add(material);
      Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
    });
  }));
  return () => {
    geometry.forEach(item => item.dispose()); materials.forEach(item => item.dispose());
    textures.forEach(item => { item.dispose(); if (typeof item.image?.close === 'function') item.image.close(); });
  };
}

/** Replaces only environment trees. Loads are transactional and own all imported GPU resources. */
export function createTreeRendering(originals: THREE.Object3D[], placements: readonly TreePlacement[], groundY: number, options: Options = {}) {
  const root = new THREE.Group(); root.name = 'alternative-environment-trees';
  const load = options.load ?? (async url => (await new GLTFLoader().loadAsync(url)).scene);
  let disposed = false, generation = 0, actual: TreeRenderMethod = 'original', requested: TreeRenderMethod = 'original';
  let status: TreeRenderReport['status'] = 'ready', release: (() => void) | undefined;
  type Request = { cancelled: boolean; owned: Map<THREE.Group, () => void> };
  let pending: Request | undefined;
  let batches: { mesh: THREE.InstancedMesh; placements: readonly TreePreviewPlacement[]; originals: readonly TreePlacement[]; indices: number[]; local: THREE.Matrix4; shape: TreePreviewShape; matrices: THREE.Matrix4[]; foliage: boolean }[] = [];
  const windTime = { value: 0 };
  function disposeBatch({ mesh }: typeof batches[number]) {
    mesh.customDepthMaterial?.dispose(); mesh.customDistanceMaterial?.dispose(); mesh.dispose();
  }
  let projection = '';
  const originalVisibility = originals.map(object => object.visible), matrix = new THREE.Matrix4(), transform = new THREE.Object3D();
  function report() { if (!disposed) options.onChange?.({ count: placements.length, actual, status }); }
  function clear() {
    batches.forEach(disposeBatch); batches = [];
    release?.(); release = undefined; root.clear();
  }
  function restore() { originals.forEach((object, index) => { object.visible = originalVisibility[index]; }); }
  function releaseRequest(request: Request) {
    request.cancelled = true; request.owned.forEach(dispose => dispose()); request.owned.clear();
  }
  function cancelPending() { if (pending) releaseRequest(pending); pending = undefined; }
  function reframe(force = false) {
    const camera = options.camera;
    if (!camera || !batches.length) return;
    const nextProjection = camera.projectionMatrix.elements.join(',');
    // Keep trees planted during authored walks/orbits. A viewport change gets
    // a new composition, including when the host is paused.
    if (!force && projection === nextProjection) return;
    projection = nextProjection;
    const layouts = new Map<TreePreviewShape, readonly TreePreviewPlacement[]>();
    batches.forEach(batch => {
      if (!layouts.has(batch.shape)) {
        const layout = treePreviewLayout(camera, groundY, batch.shape);
        layouts.set(batch.shape, batch.originals.map((item, index) => layout?.(item, batch.indices[index]) ?? item));
      }
      batch.placements = layouts.get(batch.shape)!;
      batch.placements.forEach((item, index) => {
        transform.position.set(item.x, groundY + .014 + (item.lift ?? 0), item.z);
        transform.rotation.set(0, item.turn, 0); transform.scale.setScalar(item.scale); transform.updateMatrix();
        if (item.orientation) { transform.quaternion.copy(item.orientation); transform.updateMatrix(); }
        const initial = transform.matrix.clone().multiply(batch.local);
        batch.matrices[index] = initial; batch.mesh.setMatrixAt(index, initial);
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.mesh.computeBoundingSphere();
      if (batch.mesh.boundingSphere) batch.mesh.boundingSphere.radius += Math.max(0, ...batch.placements.map(item => item.scale)) * (batch.mesh.userData.komorebiTree ? .04 : .02);
    });
  }
  return {
    root,
    reframe,
    isPreviewVisible() { return !disposed && actual !== 'original' && root.visible; },
    captureOriginal() {
      if (disposed || actual === 'original') return undefined;
      const previewVisible = root.visible, previousVisibility = originals.map(object => object.visible);
      root.visible = false; restore();
      let restored = false;
      return () => {
        if (restored) return; restored = true;
        root.visible = previewVisible;
        originals.forEach((object, index) => { object.visible = previousVisibility[index]; });
      };
    },
    async select(method: TreeRenderMethod) {
      if (disposed || (method === requested && status !== 'error')) return;
      requested = method; const token = ++generation; cancelPending();
      const models = resolveTreeModelSet(method, options.recommendation);
      if (!models) {
        clear(); restore(); actual = 'original'; status = 'ready'; report(); options.invalidate?.(); return;
      }
      status = 'loading'; report();
      const variants = [...new Set(placements.map((item, index) => item.variant ?? (index % 2 ? 'round' : 'cluster')))];
      const base = (process.env.EXPO_BASE_URL || '/').replace(/\/$/, '');
      const request: Request = { cancelled: false, owned: new Map() }; pending = request;
      const next: typeof batches = [];
      try {
        const loading = new Map<string, Promise<THREE.Group>>();
        const loaded = await Promise.all(variants.map(variant => {
          const url = `${base}/environments/trees/${models[variant]}`;
          if (!loading.has(url)) loading.set(url, load(url).then(model => {
            if (method === 'komorebi') adaptKomorebiModel(model);
            const dispose = resources([model]);
            if (disposed || request.cancelled || token !== generation) dispose();
            else request.owned.set(model, dispose);
            return model;
          }));
          return loading.get(url)!;
        }));
        if (disposed || request.cancelled || token !== generation) return;
        const group = new THREE.Group();
        loaded.forEach((model, variantIndex) => {
          model.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(model), height = bounds.max.y - bounds.min.y;
          if (!Number.isFinite(height) || height <= 0) throw Error('Invalid tree bounds');
          const center = bounds.getCenter(new THREE.Vector3());
          const normalize = new THREE.Matrix4().makeScale(1 / height, 1 / height, 1 / height)
            .multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
          const indices = placements.map((item, index) => (item.variant ?? (index % 2 ? 'round' : 'cluster')) === variants[variantIndex] ? index : -1).filter(index => index >= 0);
          const trees = indices.map(index => placements[index]);
          const anchor = new THREE.Vector3(), points: number[] = [], woodPoints: number[] = []; let rootVertices = 0, leafLow = Infinity, leafHigh = -Infinity;
          model.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            const foliage = materials.some(item => item.alphaTest > 0 || /lea[fv]|foliage/i.test(item.name));
            const vertices = object.geometry.getAttribute('position'), point = new THREE.Vector3();
            for (let index = 0; index < vertices.count; index++) {
              point.fromBufferAttribute(vertices, index).applyMatrix4(object.matrixWorld);
              if (!foliage && point.y <= bounds.min.y + height * .025) { anchor.add(point); rootVertices++; }
              point.applyMatrix4(normalize); points.push(point.x, point.y, point.z);
              if (!foliage) woodPoints.push(point.x, point.y, point.z);
              if (foliage) { leafLow = Math.min(leafLow, point.y); leafHigh = Math.max(leafHigh, point.y); }
            }
          });
          if (rootVertices) anchor.divideScalar(rootVertices).applyMatrix4(normalize);
          const canopyBase = Number.isFinite(leafLow) ? THREE.MathUtils.clamp(leafLow + (leafHigh - leafLow) * .2, .30, .65) : .42;
          const selected = method === 'scene' ? options.recommendation : method;
          const shape = { anchor, points: new Float32Array(points), woodPoints: new Float32Array(woodPoints), canopyBase, lean: selected === 'cypress' || selected === 'conifer' ? 0 : .24 };
          model.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            const material = object.material;
            const foliage = (Array.isArray(material) ? material : [material]).some(item => item.alphaTest > 0 || /lea[fv]|foliage/i.test(item.name));
            if (method === 'komorebi') (Array.isArray(material) ? material : [material]).forEach(item => {
              item.userData.komorebiPigment = true;
              if (foliage) softenTreeFoliage(item);
              applyKomorebiTreeWind(item, windTime);
            });
            if (foliage && models.round.startsWith('simple-tree/')) {
              (Array.isArray(material) ? material : [material]).forEach(softenTreeFoliage);
            }
            const mesh = new THREE.InstancedMesh(object.geometry, material, trees.length);
            mesh.userData.komorebiTree = method === 'komorebi';
            if (method === 'komorebi' && object.geometry.hasAttribute('_tree_wind')) {
              const side = (Array.isArray(material) ? material[0] : material).side;
              mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side });
              mesh.customDistanceMaterial = new THREE.MeshDistanceMaterial({ side });
              applyKomorebiTreeWind(mesh.customDepthMaterial, windTime);
              applyKomorebiTreeWind(mesh.customDistanceMaterial, windTime);
            }
            mesh.name = `${method}-${variants[variantIndex]}-${object.name || 'part'}`;
            mesh.castShadow = true;
            // Dense cutout cards retain their authored canopy normals. Receiving
            // every neighbouring card's shadow turns a stylized crown almost black.
            mesh.receiveShadow = !foliage;
            mesh.userData.importedTreeFoliage = foliage;
            mesh.userData.toonSurface = { outline: false, shading: 'smooth' };
            mesh.userData.treeRole = foliage ? 'leaves' : 'wood';
            const local = normalize.clone().multiply(object.matrixWorld), matrices: THREE.Matrix4[] = [];
            trees.forEach((item, index) => {
              transform.position.set(item.x, groundY + .014 + (item.lift ?? 0), item.z);
              transform.rotation.set(0, item.turn, 0); transform.scale.setScalar(item.scale); transform.updateMatrix();
              const initial = transform.matrix.clone().multiply(local); matrices.push(initial); mesh.setMatrixAt(index, initial);
            });
            if (foliage || options.camera) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.computeBoundingSphere();
            if (mesh.boundingSphere) mesh.boundingSphere.radius += Math.max(0, ...trees.map(item => item.scale)) * (method === 'komorebi' ? .04 : .02);
            next.push({ mesh, placements: trees, originals: trees, indices, local, shape, matrices, foliage }); group.add(mesh);
          });
        });
        if (!next.length) throw Error('Tree has no meshes');
        clear(); release = () => releaseRequest(request); pending = undefined; batches = next;
        reframe(true);
        root.add(...group.children.slice()); originals.forEach(object => { object.visible = false; });
        actual = method; status = 'ready';
      } catch {
        if (disposed || token !== generation) return;
        cancelPending(); next.forEach(disposeBatch);
        clear(); restore(); actual = 'original'; status = 'error';
      }
      report(); options.invalidate?.();
    },
    update(time: number, reducedMotion = false) {
      if (disposed) return;
      windTime.value = reducedMotion ? 0 : time;
      if (actual === 'komorebi') return;
      batches.forEach(batch => {
        if (!batch.foliage) return;
        batch.placements.forEach((item, index) => {
          const phase = item.x * .61 + item.z * .37;
          const breeze = reducedMotion ? 0 : (Math.sin(time * .72 + phase) * .0035 + Math.sin(time * 1.13 + phase * 1.8) * .001) * item.scale;
          matrix.makeTranslation(breeze, 0, breeze * .55).multiply(batch.matrices[index]); batch.mesh.setMatrixAt(index, matrix);
        });
        batch.mesh.instanceMatrix.needsUpdate = true;
      });
    },
    dispose() { if (disposed) return; disposed = true; generation++; cancelPending(); clear(); restore(); root.removeFromParent(); },
  };
}
