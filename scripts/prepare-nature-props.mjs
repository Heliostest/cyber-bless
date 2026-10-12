import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const source = path.resolve("assets/environments/source/kenney");
const files = { "tree-round": "tree_oak.glb", "tree-pine": "tree_pineTallA.glb",
  bush: "plant_bush.glb", rock: "stone_smallA.glb", flowers: "flower_yellowC.glb" };
const result = {};
const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const types = { 5120: [1, "readInt8"], 5121: [1, "readUInt8"], 5122: [2, "readInt16LE"],
  5123: [2, "readUInt16LE"], 5125: [4, "readUInt32LE"], 5126: [4, "readFloatLE"] };
for (const [name, file] of Object.entries(files)) {
  const bytes = await readFile(path.join(source, file));
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw Error(`Invalid GLB: ${file}`);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binary = bytes.subarray(28 + jsonLength);
  const accessor = index => {
    const value = gltf.accessors[index], view = gltf.bufferViews[value.bufferView];
    const [componentBytes, method] = types[value.componentType];
    const components = sizes[value.type];
    const stride = view.byteStride || componentBytes * components;
    const start = (view.byteOffset || 0) + (value.byteOffset || 0);
    return Array.from({ length: value.count * components }, (_, i) =>
      binary[method](start + Math.floor(i / components) * stride + i % components * componentBytes));
  };
  const parts = [];
  const visit = (index, parent) => {
    const node = gltf.nodes[index];
    const local = node.matrix ? new THREE.Matrix4().fromArray(node.matrix) : new THREE.Matrix4().compose(
      new THREE.Vector3().fromArray(node.translation || [0, 0, 0]),
      new THREE.Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
      new THREE.Vector3().fromArray(node.scale || [1, 1, 1]));
    const matrix = parent.clone().multiply(local);
    if (node.mesh !== undefined) for (const primitive of gltf.meshes[node.mesh].primitives) {
      const original = new THREE.BufferGeometry();
      original.setAttribute("position", new THREE.Float32BufferAttribute(accessor(primitive.attributes.POSITION), 3));
      if (primitive.indices !== undefined) original.setIndex(accessor(primitive.indices));
      original.applyMatrix4(matrix);
      // Weld the flat-shaded foliage so the imported silhouette gets softly rounded lighting.
      const geometry = mergeVertices(original, 0.00001);
      geometry.computeVertexNormals();
      const round = value => Math.round(value * 100000) / 100000;
      parts.push({
        positions: Array.from(geometry.attributes.position.array, round),
        normals: Array.from(geometry.attributes.normal.array, round),
        indices: Array.from(geometry.index.array),
        color: (gltf.materials[primitive.material]?.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1]).slice(0, 3),
      });
      original.dispose(); geometry.dispose();
    }
    node.children?.forEach(child => visit(child, matrix));
  };
  gltf.scenes[gltf.scene || 0].nodes.forEach(index => visit(index, new THREE.Matrix4()));
  const minY = Math.min(...parts.flatMap(part => part.positions.filter((_, i) => i % 3 === 1)));
  for (const part of parts) part.positions = part.positions.map((value, i) => i % 3 === 1 ? Math.round((value - minY) * 100000) / 100000 : value);
  result[name] = { parts };
}
const output = JSON.stringify(result) + "\n";
await writeFile("packages/scene-runtime/src/nature-kit.data.json", output);
console.log(`Prepared ${Object.keys(result).length} Kenney props; ${Buffer.byteLength(output)} bytes, ${Object.values(result).reduce((n, model) => n + model.parts.reduce((m, part) => m + part.indices.length / 3, 0), 0)} triangles.`);
