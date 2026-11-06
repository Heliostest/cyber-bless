import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createCozyEnvironment as createEnvironment } from './cozy-environment';
const createCozyEnvironment: typeof createEnvironment = (scene,options)=>createEnvironment(scene,{...options,loadTree:options.loadTree??(async()=>{const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial());mesh.position.y=1;root.add(mesh);return root;})});
import { createDebugEnvironmentTone } from './debug-environment-tone';
import { resolveTreeModelSet } from './tree-models';
import { createEnvironmentTone } from './environment-tone';
import { createKomorebiSurface } from './komorebi-surface';
import { createToonSurfaces } from './toon-surfaces';

it('offers Komorebi trees through the existing bundled model resolver', () => {
  expect(resolveTreeModelSet('komorebi')).toEqual({ round: 'komorebi/round.glb', cluster: 'komorebi/cluster.glb' });
});

it.each(['toon-ink','toon-outline','moebius'] as const)('preserves the source pigment and wind material in %s', style=>{
  const scene=new THREE.Scene(),geometry=new THREE.PlaneGeometry(),material=createKomorebiSurface();
  material.vertexColors=true; material.userData.komorebiGrass=true;
  const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
  const surfaces=createToonSurfaces(style),frame=surfaces.apply(scene);
  expect(mesh.material).toBe(material);
  frame.restore();surfaces.dispose();geometry.dispose();material.dispose();
});

it('retains Komorebi tone across scenes and resets only its owning app', () => {
  const registry = createDebugEnvironmentTone(), a = {}, b = {}, apply = vi.fn();
  const release = registry.enable(a);
  registry.register('one', 'one', apply, a);
  registry.select('komorebi', a);
  expect(apply).toHaveBeenLastCalledWith('komorebi');
  const next = vi.fn(); registry.register('two', 'two', next, a);
  expect(next).toHaveBeenLastCalledWith('komorebi');
  const other = vi.fn(); registry.register('one', 'one', other, b);
  expect(other).toHaveBeenLastCalledWith('komorebi');
  release(); expect(next).toHaveBeenLastCalledWith('komorebi');
});

it('keeps Komorebi baked leaf pigments through palette changes and late refreshes', () => {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial({ vertexColors: true });
  material.userData.komorebiPigment = true;
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('color',new THREE.Float32BufferAttribute([.07,.36,.23,.22,.6,.39],3));
  const mesh = new THREE.Mesh(geometry,material); mesh.userData.treeRole='leaves'; root.add(mesh);
  const original = Array.from(geometry.attributes.color.array), tone=createEnvironmentTone(root);
  tone.setTone('tiny-delivery'); expect(Array.from(geometry.attributes.color.array)).not.toEqual(original);
  tone.setTone('komorebi'); tone.refresh(); expect(Array.from(geometry.attributes.color.array)).toEqual(original);
  tone.setTone('original'); expect(Array.from(geometry.attributes.color.array)).toEqual(original);
  geometry.dispose(); material.dispose();
});

it('keeps grass colors independent of control order and capture palette restoration', async () => {
  const scene = new THREE.Scene();
  const world = createCozyEnvironment(scene, { id:'woodfish',loadSky:async()=>new THREE.DataTexture() })!;
  await world.ready; world.setGrassMethod('komorebi');world.setTone('tiny-delivery');
  const mesh = scene.getObjectByName('komorebi-grass-0') as THREE.InstancedMesh;
  const colors = Array.from(mesh.geometry.attributes.color.array), tint = mesh.instanceColor!.array.slice();
  world.setTone('original'); world.setTone('tiny-delivery');
  expect(Array.from(mesh.geometry.attributes.color.array)).toEqual(colors);
  expect(mesh.instanceColor!.array).toEqual(tint);
  world.setTone('komorebi');
  const restore = world.captureDefaultTone(); restore?.();
  world.setTone('tiny-delivery');
  expect(Array.from(mesh.geometry.attributes.color.array)).toEqual(colors);
  world.dispose();
});

it('uses source daylight levels and restores ground material and sky direction for comparisons and disposal', async()=>{
  const scene=new THREE.Scene(),sky=new THREE.HemisphereLight(),sun=new THREE.DirectionalLight(),ambient=new THREE.AmbientLight();
  sky.position.set(.3,1,.2); const direction=sky.position.clone();scene.add(sky,sun,ambient);
  const world=createCozyEnvironment(scene,{id:'woodfish',loadSky:async()=>new THREE.DataTexture()})!;await world.ready;
  const renderer={shadowMap:{enabled:false,type:THREE.PCFShadowMap}} as THREE.WebGLRenderer;
  const prepare=()=>world.prepare(renderer,'toon-soft',{advanceMotion:false});prepare();
  const ground=scene.getObjectByName('meadow-ground') as THREE.Mesh,original=ground.material;
  world.setGrassMethod('komorebi');world.setTone('komorebi');prepare();
  expect(ground.material).toBeInstanceOf(THREE.MeshPhongMaterial);
  expect(sky.intensity).toBeCloseTo(.64*Math.PI);expect(sun.intensity).toBeCloseTo(1.12*Math.PI);expect(ambient.intensity).toBe(0);
  expect(sky.position.toArray()).toEqual([.2,1,.3]);
  world.setGrassMethod('original');expect(ground.material).not.toBe(original);
  const restore=world.captureDefaultGrass();expect(ground.material).toBe(original);restore?.();expect(ground.material).not.toBe(original);
  world.setTone('tiny-delivery');prepare();expect(sky.position).toEqual(direction);
  world.setTone('komorebi');prepare();world.dispose();expect(sky.position).toEqual(direction);
});

it('switches grass in place, keeps the workbench clear and restores captures', async () => {
  const scene = new THREE.Scene(), subject = new THREE.Group(); scene.add(subject);
  const world = createCozyEnvironment(scene, { id: 'woodfish', loadSky: async () => new THREE.DataTexture() })!;
  await world.ready;
  const root = scene.getObjectByName('cozy-environment'), original = scene.getObjectByName('windswept-meadow')!;
  world.setGrassMethod('komorebi');
  const grass = scene.getObjectByName('komorebi-meadow')!;
  expect((scene.getObjectByName('komorebi-grass-0') as THREE.Mesh).material).toBeInstanceOf(THREE.MeshPhongMaterial);
  expect(grass.visible).toBe(true); expect(original.visible).toBe(false);
  expect(scene.getObjectByName('cozy-environment')).toBe(root); expect(subject.parent).toBe(scene);
  const matrix = new THREE.Matrix4(), p = new THREE.Vector3();
  grass.traverse(object => {
    if (!(object instanceof THREE.InstancedMesh)) return;
    for (let i = 0; i < object.count; i++) {
      object.getMatrixAt(i, matrix); p.setFromMatrixPosition(matrix);
      expect(Math.abs(p.x) < 2.45 && p.z > -2.45 && p.z < 3.45).toBe(false);
    }
  });
  world.setGrassMethod('original');expect(original.visible).toBe(true);expect(grass.visible).toBe(false);
  const restore = world.captureDefaultGrass();
  expect(original.visible).toBe(false); expect(grass.visible).toBe(true);
  restore?.(); expect(original.visible).toBe(true);expect(grass.visible).toBe(false);
  world.setGrassMethod('komorebi'); expect(grass.visible).toBe(true);
  world.dispose(); expect(grass.parent).toBeNull();
});
