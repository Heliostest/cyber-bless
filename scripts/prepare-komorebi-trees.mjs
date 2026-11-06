import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import ts from 'typescript';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const directory = new URL('../assets/environments/komorebi/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('source-manifest.json', directory), 'utf8'));
for (const item of manifest.files) {
  const bytes = await readFile(new URL(`source/${item.file}`, directory));
  if (createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw Error(`Changed frozen source: ${item.file}`);
}
// Immutable Babylon math semantics, used only during offline geometry export.
const math = `
import * as THREE from '${new URL('../node_modules/three/build/three.module.js', import.meta.url).href}';
class Vector3 extends THREE.Vector3 {
  static FromArray(v) { return new Vector3(...v); }
  static Cross(a,b) { return new Vector3().crossVectors(a,b); }
  static Dot(a,b) { return a.dot(b); }
  static DistanceSquared(a,b) { return a.distanceToSquared(b); }
  static Lerp(a,b,t) { return new Vector3().lerpVectors(a,b,t); }
  static Up() { return new Vector3(0,1,0); }
  add(v) { return new Vector3(this.x+v.x,this.y+v.y,this.z+v.z); }
  subtract(v) { return new Vector3(this.x-v.x,this.y-v.y,this.z-v.z); }
  scale(t) { return new Vector3(this.x*t,this.y*t,this.z*t); }
  rotateByQuaternionToRef(q,out) { return out.copy(this).applyQuaternion(q); }
}
class Color3 {
  constructor(r,g,b) { this.r=r; this.g=g; this.b=b; }
  static FromHexString(h) { return new Color3(...[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255)); }
  static Lerp(a,b,t) { return new Color3(a.r+(b.r-a.r)*t,a.g+(b.g-a.g)*t,a.b+(b.b-a.b)*t); }
  scale(t) { return new Color3(this.r*t,this.g*t,this.b*t); }
}
const Quaternion = { RotationAxis: (axis,angle) => new THREE.Quaternion().setFromAxisAngle(axis,angle) };
`;
let source = await readFile(new URL('source/src/leafy-tree.ts', directory), 'utf8');
source = source.replace(/^import .*@babylonjs\/core.*$/m, '')
  .replace(/^import skeletons .*$/m, `const skeletons = ${await readFile(new URL('source/src/data/tree-skeletons.json', directory), 'utf8')};`);
const module = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { createLeafyTree } = await import(`data:text/javascript;base64,${Buffer.from(math + module).toString('base64')}`);
// GLTFExporter uses browser FileReader for its final Blob only.
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
};
const output = new URL('../assets/environments/trees/komorebi/', import.meta.url);
await mkdir(output, { recursive: true });
for (const [name, variant] of Object.entries(manifest.trees)) {
  const model = createLeafyTree(variant, true), group = new THREE.Group();
  for (const [role, data] of [['leaves', model.leaves], ['wood', model.branches]]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    // Preserve the source's legacy pigment floats. The runtime source surface
    // converts to linear after light/pigment multiplication, as StandardMaterial does.
    const colors = [];
    for (let i = 0; i < data.colors.length; i += 4) {
      colors.push(...data.colors.slice(i, i + 3));
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('_tree_wind', new THREE.Float32BufferAttribute(data.wind, 4));
    geometry.setIndex(data.indices);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: role === 'leaves' ? THREE.DoubleSide : THREE.FrontSide });
    material.name = role;
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `komorebi-${role}`; group.add(mesh);
  }
  const bytes = Buffer.from(await new GLTFExporter().parseAsync(group, { binary: true }));
  const file = new URL(`${name}.glb`, output);
  if (process.argv.includes('--check')) {
    if (!bytes.equals(await readFile(file))) throw Error(`Generated model differs: ${name}`);
  } else await writeFile(file, bytes);
  group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  console.log(`${name}: ${bytes.length} bytes, source variant ${variant}`);
}
await writeFile(new URL('LICENSE.txt', output), await readFile(new URL('source/scripts/vendor/ez-tree/LICENSE', directory)));
